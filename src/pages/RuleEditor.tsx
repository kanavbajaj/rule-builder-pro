// RuleEditor.tsx - Fixed Apply & Save functionality
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusChip } from '@/components/StatusChip';
import { HumanPreview } from '@/components/HumanPreview';
import { ConditionBuilder } from '@/components/ConditionBuilder';
import { EffectBuilder } from '@/components/EffectBuilder';
import {
  fetchRule,
  createRule,
  updateRule,
  publishRule,
  disableRule,
} from '@/lib/api';
import type { Rule, RuleEvent } from '@/lib/types';
import { RULE_EVENTS } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Save,
  Rocket,
  AlertCircle,
  ArrowLeft,
  History,
  Power,
  Info,
  Wand2,
  Sparkles,
} from 'lucide-react';
import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ConditionSchema = z.object({
  source: z.string().min(1, 'Source field is required'),
  operator: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const EffectSchema = z.union([
  z.object({
    type: z.literal('scoreDelta'),
    score: z.string().min(1, 'Score name is required'),
    delta: z.number(),
  }),
  z.object({
    type: z.literal('addTag'),
    tag: z.string().min(1, 'Tag is required'),
  }),
  z.object({
    type: z.literal('removeTag'),
    tag: z.string().min(1, 'Tag is required'),
  }),
]);

const RuleDraftSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  priority: z.number().int().min(1).max(100),
  event: z.string().min(1, 'Event is required'),
  conditions: z.array(ConditionSchema).min(1, 'At least one condition required'),
  effects: z.array(EffectSchema).min(1, 'At least one effect required'),
  scopes: z.record(z.any()).default({}),
  metadata: z.record(z.any()).default({}),
  status: z.literal('DRAFT'),
  version: z.number().int(),
});

// ============================================================================
// AI HELPER FUNCTIONS
// ============================================================================

/**
 * Build system prompt for Gemini AI
 */
function buildSystemPrompt(allowedEvents: string[]): string {
  return `You are an expert assistant that generates rule configurations for a decision engine system.

YOUR TASK:
Generate a complete rule configuration based on the user's natural language description.

OUTPUT FORMAT:
- Return ONLY a valid JSON object
- NO markdown code fences, NO explanatory text, NO comments
- The JSON must strictly follow the schema below

SCHEMA:
{
  "name": "string - clear, descriptive rule name",
  "priority": number (1-100, default 50),
  "event": "string - MUST be one of: ${allowedEvents.join(', ')}",
  "conditions": [
    {
      "source": "string - field path like 'customer.salary_credit' or 'txn.amount'",
      "operator": "string - optional comparison operator like 'gte', 'lt', 'eq'",
      "value": "string | number | boolean - the value to compare against"
    }
  ],
  "effects": [
    {
      "type": "scoreDelta",
      "score": "string - score name like 'stability', 'credit_score'",
      "delta": number - positive or negative change
    },
    {
      "type": "addTag",
      "tag": "string - tag name like 'high_value', 'risky'"
    },
    {
      "type": "removeTag",
      "tag": "string - tag to remove"
    }
  ],
  "scopes": {},
  "metadata": {},
  "status": "DRAFT",
  "version": 1
}

STRICT REQUIREMENTS:
1. event MUST be exactly one of these values: ${allowedEvents.join(', ')}
2. Include at least ONE condition
3. Include at least ONE effect
4. Use appropriate data types (numbers for numeric values, strings for text, booleans for true/false)
5. Set status to "DRAFT" and version to 1
6. Keep scopes and metadata as empty objects {}

EXAMPLES OF FIELD PATHS:
- customer.salary_credit
- customer.age
- txn.amount
- txn.merchant_category
- account.balance

EXAMPLES OF OPERATORS:
- gte (greater than or equal)
- lte (less than or equal)
- gt (greater than)
- lt (less than)
- eq (equals)
- ne (not equals)

Return ONLY the JSON object, nothing else.`;
}

/**
 * Extract JSON from AI response, handling markdown fences
 */
function extractJson(text: string): any {
  let cleaned = text.trim();

  // Remove markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```\n?/g, '').replace(/```\n?$/g, '');
  }

  // Find JSON object boundaries
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No valid JSON object found in AI response');
  }

  const jsonStr = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON:', jsonStr);
    throw new Error('AI returned malformed JSON');
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RuleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  // Loading states
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Dialog states
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [releaseNote, setReleaseNote] = useState('');

  // Rule state
  const [rule, setRule] = useState<Partial<Rule>>({
    name: '',
    priority: 50,
    event: undefined,
    conditions: [],
    effects: [],
    scopes: {},
    metadata: {},
    status: 'DRAFT',
    version: 1,
  });

  // Validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // AI states
  const [aiQuery, setAiQuery] = useState('');
  const [aiDraft, setAiDraft] = useState<Partial<Rule> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (!isNew && id) {
      loadRule(id);
    }
  }, [id, isNew]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  async function loadRule(ruleId: string) {
    try {
      setLoading(true);
      const data = await fetchRule(ruleId);
      if (data) {
        setRule(data);
      } else {
        toast({
          title: 'Rule not found',
          description: 'The requested rule does not exist',
          variant: 'destructive',
        });
        navigate('/rules');
      }
    } catch (error) {
      console.error('Failed to load rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rule. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  function validateRule(ruleToValidate: Partial<Rule>): string[] {
    const errors: string[] = [];

    // Basic validations
    if (!ruleToValidate.name?.trim()) {
      errors.push('Rule name is required');
    }
    if (!ruleToValidate.event) {
      errors.push('Event type is required');
    }
    if (!ruleToValidate.conditions?.length) {
      errors.push('At least one condition is required');
    }
    if (!ruleToValidate.effects?.length) {
      errors.push('At least one effect is required');
    }

    // Validate each condition
    ruleToValidate.conditions?.forEach((c, i) => {
      if (!c.source) {
        errors.push(`Condition ${i + 1}: Field is required`);
      }
      if (c.value === '' || c.value === undefined || c.value === null) {
        errors.push(`Condition ${i + 1}: Value is required`);
      }
    });

    // Validate each effect
    ruleToValidate.effects?.forEach((e: any, i: number) => {
      if (e.type === 'scoreDelta') {
        if (!e.score) {
          errors.push(`Effect ${i + 1}: Score name is required`);
        }
        if (e.delta === undefined || e.delta === null) {
          errors.push(`Effect ${i + 1}: Delta value is required`);
        }
      }
      if (e.type === 'addTag' || e.type === 'removeTag') {
        if (!e.tag) {
          errors.push(`Effect ${i + 1}: Tag is required`);
        }
      }
    });

    return errors;
  }

  function validate(): string[] {
    return validateRule(rule);
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  async function handleSave() {
    const errors = validate();
    setValidationErrors(errors);

    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        const created = await createRule(rule);
        toast({
          title: 'Success',
          description: 'Rule created successfully',
        });
        navigate(`/rules/${created.id}`);
      } else {
        await updateRule(id!, rule);
        toast({
          title: 'Success',
          description: 'Rule saved successfully',
        });
        await loadRule(id!);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save rule';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    const errors = validate();
    setValidationErrors(errors);

    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before publishing',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPublishing(true);
      if (isNew) {
        const created = await createRule(rule);
        await publishRule(created.id, releaseNote);
        toast({
          title: 'Success',
          description: 'Rule published successfully',
        });
        navigate(`/rules/${created.id}`);
      } else {
        await updateRule(id!, rule);
        await publishRule(id!, releaseNote);
        toast({
          title: 'Success',
          description: 'Rule published successfully',
        });
        await loadRule(id!);
      }
      setPublishDialogOpen(false);
      setReleaseNote('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to publish rule';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  }

  async function handleDisable() {
    try {
      await disableRule(id!);
      toast({
        title: 'Success',
        description: 'Rule disabled successfully',
      });
      await loadRule(id!);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disable rule',
        variant: 'destructive',
      });
    }
  }

  // ============================================================================
  // AI DRAFT GENERATION
  // ============================================================================

  async function draftWithAI() {
    if (!aiQuery.trim()) {
      toast({
        title: 'Input required',
        description: 'Please describe the rule you want to create',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAiLoading(true);
      setAiDraft(null);

      // Get API key
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
            'VITE_GEMINI_API_KEY is not configured. Please add it to your .env file.'
        );
      }

      const allowedEvents = RULE_EVENTS.map((e) => e.value);

      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: buildSystemPrompt(allowedEvents),
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent output
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json', // Request JSON response
        },
      });

      // Build user prompt with context
      let userPrompt = `Generate a rule based on this request:\n\n${aiQuery}`;

      // Add current rule context if editing
      if (rule.name || rule.event || rule.conditions?.length || rule.effects?.length) {
        userPrompt += `\n\nCurrent rule context (use as reference):\n${JSON.stringify(
            {
              name: rule.name || 'Not set',
              event: rule.event || 'Not set',
              priority: rule.priority,
              conditions: rule.conditions || [],
              effects: rule.effects || [],
            },
            null,
            2
        )}`;
      }

      console.log('🤖 Generating rule with Gemini AI...');

      // Generate content
      const result = await model.generateContent(userPrompt);
      const response = result.response;
      const rawText = response.text();

      console.log('📥 Received response from AI');

      // Extract and parse JSON
      const draft = extractJson(rawText);

      // Validate with Zod
      const parsed = RuleDraftSchema.safeParse(draft);
      if (!parsed.success) {
        console.error('❌ Validation errors:', parsed.error.errors);
        const errorMessages = parsed.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
        throw new Error(`AI returned invalid rule format: ${errorMessages}`);
      }

      // Ensure event is allowed
      if (!allowedEvents.includes(parsed.data.event)) {
        throw new Error(
            `Unsupported event "${parsed.data.event}". Allowed events: ${allowedEvents.join(', ')}`
        );
      }

      console.log('✅ Rule validated successfully');
      setAiDraft(parsed.data as Partial<Rule>);

      toast({
        title: 'AI Draft Ready',
        description: 'Review the generated rule and apply it if it looks good',
      });
    } catch (err: any) {
      console.error('❌ AI Draft Error:', err);

      let errorMessage = 'Failed to generate rule';

      if (err.message?.includes('API_KEY') || err.message?.includes('API key')) {
        errorMessage = 'Invalid API key. Please check your VITE_GEMINI_API_KEY';
      } else if (err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'API quota exceeded. Please check your Google AI Studio quota';
      } else if (err.message?.includes('PERMISSION_DENIED')) {
        errorMessage = 'API access denied. Please verify your API key permissions';
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast({
        title: 'AI Draft Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setAiLoading(false);
    }
  }

  /**
   * Apply AI-generated draft to the editor
   */
  async function applyAIDraft(withSave = false) {
    if (!aiDraft) return;

    const merged: Partial<Rule> = {
      ...rule,
      ...aiDraft,
      priority: aiDraft.priority ?? rule.priority ?? 50,
      event: aiDraft.event ?? rule.event,
      scopes: aiDraft.scopes ?? {},
      metadata: aiDraft.metadata ?? {},
      status: 'DRAFT',
      version: aiDraft.version ?? rule.version ?? 1,
    };

    setRule(merged);
    setValidationErrors([]); // Clear any existing validation errors

    // Clear AI state
    setAiDraft(null);
    setAiQuery('');

    if (withSave) {
      // Validate the merged rule
      const errors = validateRule(merged);
      setValidationErrors(errors);

      if (errors.length > 0) {
        toast({
          title: 'Validation Error',
          description: 'Please fix the errors before saving',
          variant: 'destructive',
        });
        return;
      }

      try {
        setSaving(true);
        toast({
          title: 'Applying & Saving',
          description: 'Saving your rule...',
        });

        if (isNew) {
          const created = await createRule(merged);
          toast({
            title: 'Success',
            description: 'Rule created and saved successfully',
          });
          navigate(`/rules/${created.id}`);
        } else {
          await updateRule(id!, merged);
          toast({
            title: 'Success',
            description: 'Rule saved successfully',
          });
          await loadRule(id!);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save rule';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    } else {
      toast({
        title: 'Draft Applied',
        description: 'Draft applied to editor',
      });
    }
  }

  /**
   * Clear AI draft
   */
  function clearAIDraft() {
    setAiDraft(null);
    setAiQuery('');
    toast({
      title: 'Draft Cleared',
      description: 'AI draft has been cleared',
    });
  }

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const isEditable = rule.status !== 'ACTIVE';

  if (loading) {
    return (
        <Layout>
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading rule...</div>
          </div>
        </Layout>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
      <Layout>
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* ===== HEADER ===== */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/rules">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">
                    {isNew ? 'New Rule' : rule.name}
                  </h1>
                  {!isNew && <StatusChip status={rule.status!} />}
                </div>
                {!isNew && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Version {rule.version}
                    </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isNew && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/rules/${id}/history`}>
                      <History className="h-4 w-4 mr-2" />
                      History
                    </Link>
                  </Button>
              )}
              {rule.status === 'ACTIVE' && (
                  <Button variant="outline" size="sm" onClick={handleDisable}>
                    <Power className="h-4 w-4 mr-2" />
                    Disable
                  </Button>
              )}
            </div>
          </div>

          {/* ===== ACTIVE RULE BANNER ===== */}
          {rule.status === 'ACTIVE' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This rule is currently active. To make changes, please disable it first or
                  create a new version.
                </AlertDescription>
              </Alert>
          )}

          {/* ===== VALIDATION ERRORS ===== */}
          {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Please fix the following errors:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {validationErrors.map((error, i) => (
                        <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
          )}

          {/* ===== AI DRAFT CARD ===== */}
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Rule Generator
                <span className="text-xs font-normal text-muted-foreground ml-2">
                Powered by Gemini 1.5 Flash
              </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="aiQuery" className="text-sm font-semibold">
                  Describe your rule in plain English
                </Label>
                <Textarea
                    id="aiQuery"
                    placeholder="Example: If a customer's monthly salary credit is greater than or equal to 50,000 and their transaction amount is less than 5,000, add a 'stable_customer' tag and increase their stability score by 10 points"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    rows={4}
                    disabled={!isEditable || aiLoading}
                    className="resize-none"
                />
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Tips for best results:</strong>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      <li>Mention the trigger event (e.g., "when a transaction occurs")</li>
                      <li>
                        Specify field conditions with operators (e.g., "salary_credit ≥ 50000")
                      </li>
                      <li>
                        Describe desired effects (e.g., "add tag 'premium', increase score by 5")
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                    onClick={draftWithAI}
                    disabled={!isEditable || aiLoading || !aiQuery.trim()}
                    className="min-w-[140px]"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {aiLoading ? 'Generating...' : 'Generate Rule'}
                </Button>

                {aiDraft && (
                    <>
                      <Button
                          variant="secondary"
                          onClick={() => applyAIDraft(false)}
                          disabled={!isEditable}
                      >
                        Apply to Editor
                      </Button>
                      <Button
                          variant="outline"
                          onClick={() => applyAIDraft(true)}
                          disabled={!isEditable || saving}
                      >
                        {saving ? 'Saving...' : 'Apply & Save'}
                      </Button>
                      <Button variant="ghost" onClick={clearAIDraft} disabled={!isEditable}>
                        Clear
                      </Button>
                    </>
                )}
              </div>

              {/* AI Draft Preview */}
              {aiDraft && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Generated Rule Preview
                      </Label>
                      <span className="text-xs text-muted-foreground">
                    Review carefully before applying
                  </span>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Name
                    </span>
                        <p className="text-sm font-medium mt-1">{aiDraft.name}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Event
                      </span>
                          <p className="text-sm mt-1">{aiDraft.event}</p>
                        </div>
                        <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Priority
                      </span>
                          <p className="text-sm mt-1">{aiDraft.priority}</p>
                        </div>
                      </div>

                      <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Conditions
                    </span>
                        <p className="text-sm mt-1">
                          {aiDraft.conditions?.length || 0} condition(s)
                        </p>
                      </div>

                      <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Effects
                    </span>
                        <p className="text-sm mt-1">{aiDraft.effects?.length || 0} effect(s)</p>
                      </div>

                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          View Full JSON ▼
                        </summary>
                        <pre className="mt-2 bg-background rounded p-3 text-xs overflow-auto max-h-60 border">
                      {JSON.stringify(aiDraft, null, 2)}
                    </pre>
                      </details>
                    </div>
                  </div>
              )}
            </CardContent>
          </Card>

          {/* ===== FORM SECTIONS ===== */}
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Rule Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="name"
                        value={rule.name}
                        onChange={(e) => setRule({ ...rule, name: e.target.value })}
                        placeholder="e.g., High salary credit boosts stability"
                        disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">
                      Priority <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="priority"
                        type="number"
                        value={rule.priority}
                        onChange={(e) =>
                            setRule({ ...rule, priority: Number(e.target.value) })
                        }
                        min={1}
                        max={100}
                        disabled={!isEditable}
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher priority rules are evaluated first (1-100)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event">
                    Trigger Event <span className="text-destructive">*</span>
                  </Label>
                  <Select
                      value={rule.event || undefined}
                      onValueChange={(v) => setRule({ ...rule, event: v as RuleEvent })}
                      disabled={!isEditable}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an event that will trigger this rule" />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_EVENTS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>
                            {e.label}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The event that will trigger this rule to be evaluated
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Conditions <span className="text-destructive">*</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Define when this rule should apply
                </p>
              </CardHeader>
              <CardContent>
                <ConditionBuilder
                    conditions={rule.conditions || []}
                    onChange={(conditions) => setRule({ ...rule, conditions })}
                />
              </CardContent>
            </Card>

            {/* Effects */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Effects <span className="text-destructive">*</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Define what happens when conditions are met
                </p>
              </CardHeader>
              <CardContent>
                <EffectBuilder
                    effects={rule.effects || []}
                    onChange={(effects) => setRule({ ...rule, effects })}
                />
              </CardContent>
            </Card>

            {/* Human-readable Preview */}
            <HumanPreview rule={rule} />

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button variant="outline" asChild>
                <Link to="/rules">Cancel</Link>
              </Button>

              {isEditable && (
                  <>
                    <Button variant="secondary" onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Draft'}
                    </Button>
                    <Button onClick={() => setPublishDialogOpen(true)} disabled={publishing}>
                      <Rocket className="h-4 w-4 mr-2" />
                      Publish
                    </Button>
                  </>
              )}
            </div>
          </div>
        </div>

        {/* ===== PUBLISH DIALOG ===== */}
        <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish Rule</DialogTitle>
              <DialogDescription>
                Publishing this rule will make it active and it will start affecting customer
                profiles immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="releaseNote">Release Note (optional)</Label>
                <Textarea
                    id="releaseNote"
                    value={releaseNote}
                    onChange={(e) => setReleaseNote(e.target.value)}
                    placeholder="Describe what changed in this version..."
                    rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePublish} disabled={publishing}>
                <Rocket className="h-4 w-4 mr-2" />
                {publishing ? 'Publishing...' : 'Publish'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
  );
}