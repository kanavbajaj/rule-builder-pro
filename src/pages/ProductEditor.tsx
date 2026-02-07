import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchProduct, createProduct, updateProduct } from '@/lib/api';
import type { Product } from '@/lib/types';
import { KNOWN_SCORES } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Wand2, Sparkles, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';

interface ScoreEntry {
  score: string;
  value: number;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ScoreEntrySchema = z.object({
  score: z.string().min(1),
  value: z.number().min(0).max(100),
});

const WeightEntrySchema = z.object({
  score: z.string().min(1),
  value: z.number(),
});

const ProductDraftSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  active: z.boolean().default(true),
  required_scores: z.array(ScoreEntrySchema).default([]),
  weight_by_score: z.array(WeightEntrySchema).default([]),
  exclusions: z.array(z.string()).default([]),
});

// ============================================================================
// AI HELPER FUNCTIONS
// ============================================================================

/**
 * Build system prompt for Gemini AI
 */
function buildSystemPrompt(availableScores: string[]): string {
  return `You are an expert assistant that generates product configurations for a financial product recommendation engine.

YOUR TASK:
Generate a complete product configuration based on the user's natural language description of a financial product.

AVAILABLE PROFILE SCORES:
${availableScores.join(', ')}

SCORE DESCRIPTIONS:
- financialStability: Overall financial health and stability (0-100)
- homeOwnershipIntent: Intent/readiness to own a home (0-100)
- creditReadiness: Creditworthiness and loan repayment capability (0-100)
- digitalEngagement: Digital savviness and online banking usage (0-100)

INTELLIGENT MAPPING GUIDE:

PRODUCT TYPE → SCORE REQUIREMENTS:
- "Home Loan" / "Mortgage" / "Housing Loan":
  * High homeOwnershipIntent (≥ 60-80)
  * High financialStability (≥ 50-70)
  * High creditReadiness (≥ 60-75)
  
- "Personal Loan" / "Consumer Loan":
  * High creditReadiness (≥ 50-70)
  * Moderate financialStability (≥ 40-60)
  
- "Credit Card" / "Premium Credit Card":
  * High creditReadiness (≥ 60-80)
  * For premium: High financialStability (≥ 70)
  * For digital cards: High digitalEngagement (≥ 60)
  
- "Savings Account" / "Digital Savings":
  * Low/No strict requirements
  * For digital: High digitalEngagement (≥ 50)
  
- "Investment Products" / "Wealth Management":
  * Very high financialStability (≥ 70-85)
  * High creditReadiness (≥ 60)
  
- "Auto Loan" / "Vehicle Loan":
  * High creditReadiness (≥ 55-70)
  * Moderate financialStability (≥ 45-60)
  
- "Education Loan" / "Student Loan":
  * Moderate creditReadiness (≥ 40-60)
  * Consider lower thresholds for students

RANKING WEIGHTS (importance multipliers):
Map which scores matter most for ranking eligible profiles:
- Home Loan: financialStability × 2.0, creditReadiness × 1.5, homeOwnershipIntent × 2.5
- Personal Loan: creditReadiness × 2.0, financialStability × 1.5
- Credit Card: creditReadiness × 2.5, digitalEngagement × 1.0
- Investment: financialStability × 3.0, creditReadiness × 1.0
- Auto Loan: creditReadiness × 2.0, financialStability × 1.5

EXCLUSION TAGS:
Common tags that would exclude profiles:
- existing_home_loan, existing_personal_loan, existing_credit_card
- defaulted_loan, bankruptcy, fraud_risk
- blacklisted, churned_customer
- underage (for certain products)

VAGUE PROMPT INTERPRETATION:
- "Premium product" → Higher thresholds (70-85 range)
- "Entry-level product" → Lower thresholds (30-50 range)
- "Mid-tier product" → Moderate thresholds (50-70 range)
- "Digital-first" → High digitalEngagement weight
- "For first-time buyers" → Lower requirements, specific exclusions
- "For existing customers" → May have upgrade exclusions

OUTPUT FORMAT:
Return ONLY a valid JSON object with NO markdown code fences, NO explanatory text.

SCHEMA:
{
  "name": "string - clear product name",
  "active": boolean (default true),
  "required_scores": [
    {
      "score": "string - one of: ${availableScores.join(', ')}",
      "value": number (0-100, threshold for eligibility)
    }
  ],
  "weight_by_score": [
    {
      "score": "string - one of: ${availableScores.join(', ')}",
      "value": number (typically 0.5-3.0, how much this score affects ranking)
    }
  ],
  "exclusions": [
    "string - tag names that would disqualify a profile"
  ]
}

STRICT REQUIREMENTS:
1. name must be a clear, customer-facing product name
2. All scores in required_scores and weight_by_score must be from: ${availableScores.join(', ')}
3. Threshold values must be 0-100
4. Weight values are typically 0.5-3.0 (higher = more important)
5. Include at least ONE required score for most products (unless it's truly open to all)
6. Include weights for scores that matter for ranking
7. Include relevant exclusion tags if applicable

EXAMPLES:

Vague: "Premium home loan for high earners"
→ {
  "name": "Premium Home Loan",
  "active": true,
  "required_scores": [
    {"score": "financialStability", "value": 75},
    {"score": "creditReadiness", "value": 70},
    {"score": "homeOwnershipIntent", "value": 65}
  ],
  "weight_by_score": [
    {"score": "financialStability", "value": 2.5},
    {"score": "homeOwnershipIntent", "value": 3.0},
    {"score": "creditReadiness", "value": 1.5}
  ],
  "exclusions": ["existing_home_loan", "defaulted_loan"]
}

Vague: "Digital credit card for tech-savvy users"
→ {
  "name": "Digital Smart Credit Card",
  "active": true,
  "required_scores": [
    {"score": "creditReadiness", "value": 60},
    {"score": "digitalEngagement", "value": 70}
  ],
  "weight_by_score": [
    {"score": "creditReadiness", "value": 2.0},
    {"score": "digitalEngagement", "value": 2.5}
  ],
  "exclusions": ["existing_credit_card", "fraud_risk"]
}

Vague: "Entry-level savings account"
→ {
  "name": "Basic Savings Account",
  "active": true,
  "required_scores": [],
  "weight_by_score": [
    {"score": "digitalEngagement", "value": 1.0},
    {"score": "financialStability", "value": 0.5}
  ],
  "exclusions": []
}

Return ONLY the JSON object, nothing else.`;
}

/**
 * Extract JSON from AI response
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

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [requiredScores, setRequiredScores] = useState<ScoreEntry[]>([]);
  const [weights, setWeights] = useState<ScoreEntry[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');

  // AI states
  const [aiQuery, setAiQuery] = useState('');
  const [aiDraft, setAiDraft] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      loadProduct(id);
    }
  }, [id, isNew]);

  async function loadProduct(productId: string) {
    try {
      const data = await fetchProduct(productId);
      if (data) {
        setName(data.name);
        setActive(data.active);
        setRequiredScores(
            Object.entries(data.required_scores || {}).map(([score, value]) => ({ score, value }))
        );
        setWeights(
            Object.entries(data.weight_by_score || {}).map(([score, value]) => ({ score, value }))
        );
        setExclusions(data.exclusions || []);
      } else {
        toast({ title: 'Product not found', variant: 'destructive' });
        navigate('/products');
      }
    } catch (error) {
      console.error('Failed to load product:', error);
      toast({ title: 'Error', description: 'Failed to load product', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function validate(): string[] {
    const errors: string[] = [];
    if (!name.trim()) errors.push('Product name is required');
    requiredScores.forEach((entry, i) => {
      if (!entry.score) errors.push(`Required Score ${i + 1}: Score name is required`);
      if (entry.value < 0 || entry.value > 100) errors.push(`Required Score ${i + 1}: Threshold must be 0-100`);
    });
    weights.forEach((entry, i) => {
      if (!entry.score) errors.push(`Weight ${i + 1}: Score name is required`);
    });
    return errors;
  }

  function toProduct(): Partial<Product> {
    const required_scores: Record<string, number> = {};
    requiredScores.forEach((e) => { if (e.score) required_scores[e.score] = e.value; });

    const weight_by_score: Record<string, number> = {};
    weights.forEach((e) => { if (e.score) weight_by_score[e.score] = e.value; });

    return { name, active, required_scores, weight_by_score, exclusions };
  }

  async function handleSave() {
    const errors = validate();
    setValidationErrors(errors);
    if (errors.length > 0) {
      toast({ title: 'Validation Error', description: 'Please fix the errors', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        const created = await createProduct(toProduct());
        toast({ title: 'Product created' });
        navigate(`/products/${created.id}`);
      } else {
        await updateProduct(id!, toProduct());
        toast({ title: 'Product saved' });
        loadProduct(id!);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save product';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ============================================================================
  // AI DRAFT GENERATION
  // ============================================================================

  async function generateWithAI() {
    if (!aiQuery.trim()) {
      toast({
        title: 'Input required',
        description: 'Please describe the product you want to create',
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
        throw new Error('VITE_GEMINI_API_KEY is not configured. Please add it to your .env file.');
      }

      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: buildSystemPrompt(KNOWN_SCORES),
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      });

      console.log('🤖 Generating product configuration with Gemini AI...');

      // Generate content
      const result = await model.generateContent(aiQuery);
      const response = result.response;
      const rawText = response.text();

      console.log('📥 Received response from AI');

      // Extract and parse JSON
      const draft = extractJson(rawText);

      // Validate with Zod
      const parsed = ProductDraftSchema.safeParse(draft);
      if (!parsed.success) {
        console.error('❌ Validation errors:', parsed.error.errors);
        const errorMessages = parsed.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
        throw new Error(`AI returned invalid product format: ${errorMessages}`);
      }

      console.log('✅ Product validated successfully');
      setAiDraft(parsed.data);

      toast({
        title: 'AI Draft Ready',
        description: 'Review the generated product configuration and apply it if it looks good',
      });
    } catch (err: any) {
      console.error('❌ AI Draft Error:', err);

      let errorMessage = 'Failed to generate product configuration';

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
        title: 'AI Generation Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setAiLoading(false);
    }
  }

  /**
   * Apply AI-generated draft
   */
  async function applyAIDraft(withSave = false) {
    if (!aiDraft) return;

    // Apply the draft values
    setName(aiDraft.name);
    setActive(aiDraft.active ?? true);
    setRequiredScores(aiDraft.required_scores || []);
    setWeights(aiDraft.weight_by_score || []);
    setExclusions(aiDraft.exclusions || []);
    setValidationErrors([]);

    // Clear AI state
    setAiDraft(null);
    setAiQuery('');

    if (withSave) {
      // Build product from draft
      const required_scores: Record<string, number> = {};
      (aiDraft.required_scores || []).forEach((e: ScoreEntry) => {
        if (e.score) required_scores[e.score] = e.value;
      });

      const weight_by_score: Record<string, number> = {};
      (aiDraft.weight_by_score || []).forEach((e: ScoreEntry) => {
        if (e.score) weight_by_score[e.score] = e.value;
      });

      const productData = {
        name: aiDraft.name,
        active: aiDraft.active ?? true,
        required_scores,
        weight_by_score,
        exclusions: aiDraft.exclusions || [],
      };

      // Validate
      const errors: string[] = [];
      if (!aiDraft.name?.trim()) errors.push('Product name is required');

      if (errors.length > 0) {
        setValidationErrors(errors);
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
          description: 'Saving your product configuration...',
        });

        if (isNew) {
          const created = await createProduct(productData);
          toast({
            title: 'Success',
            description: 'Product created and saved successfully',
          });
          navigate(`/products/${created.id}`);
        } else {
          await updateProduct(id!, productData);
          toast({
            title: 'Success',
            description: 'Product saved successfully',
          });
          await loadProduct(id!);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save product';
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
        description: 'Product configuration applied to editor',
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

  // Scores that haven't been used yet in a given list
  function availableScores(usedEntries: ScoreEntry[], currentIndex: number) {
    const usedSet = new Set(usedEntries.filter((_, i) => i !== currentIndex).map((e) => e.score));
    return KNOWN_SCORES.filter((s) => !usedSet.has(s));
  }

  function addExclusion() {
    const tag = newExclusion.trim();
    if (tag && !exclusions.includes(tag)) {
      setExclusions([...exclusions, tag]);
      setNewExclusion('');
    }
  }

  if (loading) {
    return (
        <Layout>
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </Layout>
    );
  }

  return (
      <Layout>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/products">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {isNew ? 'New Product' : name}
                </h1>
                {!isNew && (
                    <Badge variant={active ? 'default' : 'secondary'} className="mt-1">
                      {active ? 'Active' : 'Inactive'}
                    </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1">
                    {validationErrors.map((error, i) => (
                        <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
          )}

          {/* ===== AI PRODUCT GENERATOR ===== */}
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Product Generator
                <span className="text-xs font-normal text-muted-foreground ml-2">
                Powered by Gemini 2.0 Flash
              </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="aiQuery" className="text-sm font-semibold">
                  Describe your product in plain English
                </Label>
                <Textarea
                    id="aiQuery"
                    placeholder="Try: 'Premium home loan for high earners' or 'Digital credit card for tech-savvy users' or 'Entry-level savings account'"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    rows={3}
                    disabled={aiLoading}
                    className="resize-none"
                />
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>AI can intelligently configure:</strong>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      <li><strong>Vague prompts:</strong> "Premium home loan" or "Digital savings for young adults"</li>
                      <li><strong>Score thresholds:</strong> Minimum requirements for eligibility</li>
                      <li><strong>Ranking weights:</strong> Which scores matter most for recommendations</li>
                      <li><strong>Exclusion tags:</strong> Who shouldn't see this product</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                    onClick={generateWithAI}
                    disabled={aiLoading || !aiQuery.trim()}
                    className="min-w-[160px]"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {aiLoading ? 'Generating...' : 'Generate Product'}
                </Button>

                {aiDraft && (
                    <>
                      <Button
                          variant="secondary"
                          onClick={() => applyAIDraft(false)}
                      >
                        Apply to Editor
                      </Button>
                      <Button
                          variant="outline"
                          onClick={() => applyAIDraft(true)}
                          disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Apply & Save'}
                      </Button>
                      <Button variant="ghost" onClick={clearAIDraft}>
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
                        Generated Product Preview
                      </Label>
                      <span className="text-xs text-muted-foreground">
                    Review carefully before applying
                  </span>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Product Name
                    </span>
                        <p className="text-sm font-medium mt-1">{aiDraft.name}</p>
                      </div>

                      <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Status
                    </span>
                        <p className="text-sm mt-1">
                          <Badge variant={aiDraft.active ? 'default' : 'secondary'}>
                            {aiDraft.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </p>
                      </div>

                      <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Required Score Thresholds
                    </span>
                        {aiDraft.required_scores?.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {aiDraft.required_scores.map((entry: ScoreEntry, i: number) => (
                                  <div key={i} className="text-sm flex items-center gap-2">
                                    <Badge variant="outline">{entry.score}</Badge>
                                    <span className="text-muted-foreground">≥ {entry.value}</span>
                                  </div>
                              ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground mt-1">None (open to all)</p>
                        )}
                      </div>

                      <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Ranking Weights
                    </span>
                        {aiDraft.weight_by_score?.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {aiDraft.weight_by_score.map((entry: ScoreEntry, i: number) => (
                                  <div key={i} className="text-sm flex items-center gap-2">
                                    <Badge variant="outline">{entry.score}</Badge>
                                    <span className="text-muted-foreground">× {entry.value}</span>
                                  </div>
                              ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground mt-1">No weights defined</p>
                        )}
                      </div>

                      {aiDraft.exclusions?.length > 0 && (
                          <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Exclusion Tags
                      </span>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {aiDraft.exclusions.map((tag: string) => (
                                  <Badge key={tag} variant="destructive" className="text-xs">
                                    {tag}
                                  </Badge>
                              ))}
                            </div>
                          </div>
                      )}

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

          {/* Basic Info */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="productName">Product Name</Label>
                  <Input
                      id="productName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Home Loan"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={active} onCheckedChange={setActive} id="active" />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Required Scores (Thresholds) */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Required Score Thresholds</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Minimum profile scores needed for this product to be shown
                  </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRequiredScores([...requiredScores, { score: '', value: 50 }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Threshold
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {requiredScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    No score thresholds defined. Product will be visible to all profiles.
                  </p>
              ) : (
                  <div className="space-y-3">
                    {requiredScores.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          <Select
                              value={entry.score || undefined}
                              onValueChange={(v) => {
                                const updated = [...requiredScores];
                                updated[index] = { ...updated[index], score: v };
                                setRequiredScores(updated);
                              }}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select score" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableScores(requiredScores, index).map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">≥</span>
                          <Input
                              type="number"
                              value={entry.value}
                              onChange={(e) => {
                                const updated = [...requiredScores];
                                updated[index] = { ...updated[index], value: Number(e.target.value) };
                                setRequiredScores(updated);
                              }}
                              min={0}
                              max={100}
                              className="w-24"
                          />
                          <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setRequiredScores(requiredScores.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Weights */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ranking Weights</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    How much each score contributes to the product's ranking
                  </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWeights([...weights, { score: '', value: 1 }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Weight
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {weights.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    No weights defined. Product ranking will be unweighted.
                  </p>
              ) : (
                  <div className="space-y-3">
                    {weights.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          <Select
                              value={entry.score || undefined}
                              onValueChange={(v) => {
                                const updated = [...weights];
                                updated[index] = { ...updated[index], score: v };
                                setWeights(updated);
                              }}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select score" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableScores(weights, index).map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">×</span>
                          <Input
                              type="number"
                              value={entry.value}
                              onChange={(e) => {
                                const updated = [...weights];
                                updated[index] = { ...updated[index], value: Number(e.target.value) };
                                setWeights(updated);
                              }}
                              step={0.1}
                              className="w-24"
                          />
                          <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setWeights(weights.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Exclusion Tags */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">Exclusion Tags</CardTitle>
              <p className="text-sm text-muted-foreground">
                Profiles with any of these tags will be excluded from seeing this product
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                    value={newExclusion}
                    onChange={(e) => setNewExclusion(e.target.value)}
                    placeholder="e.g., existing_home_loan"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExclusion())}
                    className="max-w-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={addExclusion}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {exclusions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {exclusions.map((tag) => (
                        <Badge key={tag} variant="destructive" className="gap-1 pr-1">
                          {tag}
                          <button
                              type="button"
                              onClick={() => setExclusions(exclusions.filter((t) => t !== tag))}
                              className="ml-1 rounded-full hover:bg-destructive-foreground/20 p-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" asChild>
              <Link to="/products">Cancel</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : isNew ? 'Create Product' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Layout>
  );
}