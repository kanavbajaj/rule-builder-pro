import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { fetchRule, createRule, updateRule, publishRule, disableRule } from '@/lib/api';
import type { Rule, Condition, Effect, RuleEvent } from '@/lib/types';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RuleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [releaseNote, setReleaseNote] = useState('');

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

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isNew && id) {
      loadRule(id);
    }
  }, [id, isNew]);

  async function loadRule(ruleId: string) {
    try {
      const data = await fetchRule(ruleId);
      if (data) {
        setRule(data);
      } else {
        toast({
          title: 'Rule not found',
          variant: 'destructive',
        });
        navigate('/rules');
      }
    } catch (error) {
      console.error('Failed to load rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rule',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function validate(): string[] {
    const errors: string[] = [];
    
    if (!rule.name?.trim()) {
      errors.push('Rule name is required');
    }
    if (!rule.event) {
      errors.push('Event type is required');
    }
    if (!rule.conditions?.length) {
      errors.push('At least one condition is required');
    }
    if (!rule.effects?.length) {
      errors.push('At least one effect is required');
    }
    
    // Validate conditions
    rule.conditions?.forEach((c, i) => {
      if (!c.source) errors.push(`Condition ${i + 1}: Field is required`);
      if (c.value === '' || c.value === undefined) errors.push(`Condition ${i + 1}: Value is required`);
    });

    // Validate effects
    rule.effects?.forEach((e, i) => {
      if (e.type === 'scoreDelta' && !e.score) {
        errors.push(`Effect ${i + 1}: Score name is required`);
      }
      if ((e.type === 'addTag' || e.type === 'removeTag') && !e.tag) {
        errors.push(`Effect ${i + 1}: Tag is required`);
      }
    });

    return errors;
  }

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
        toast({ title: 'Rule created' });
        navigate(`/rules/${created.id}`);
      } else {
        await updateRule(id!, rule);
        toast({ title: 'Rule saved' });
        loadRule(id!);
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
      
      // Save first if new
      if (isNew) {
        const created = await createRule(rule);
        await publishRule(created.id, releaseNote);
        toast({ title: 'Rule published' });
        navigate(`/rules/${created.id}`);
      } else {
        // Save changes first
        await updateRule(id!, rule);
        await publishRule(id!, releaseNote);
        toast({ title: 'Rule published' });
        loadRule(id!);
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
      toast({ title: 'Rule disabled' });
      loadRule(id!);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disable rule',
        variant: 'destructive',
      });
    }
  }

  const isEditable = rule.status !== 'ACTIVE';

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

        {/* Active rule banner */}
        {rule.status === 'ACTIVE' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This rule is active. To edit, clone it or disable it first.
            </AlertDescription>
          </Alert>
        )}

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

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    value={rule.name}
                    onChange={(e) => setRule({ ...rule, name: e.target.value })}
                    placeholder="e.g., Salary credit boosts stability"
                    disabled={!isEditable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={rule.priority}
                    onChange={(e) => setRule({ ...rule, priority: Number(e.target.value) })}
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
                <Label htmlFor="event">Trigger Event</Label>
                <Select
                  value={rule.event || undefined}
                  onValueChange={(v) => setRule({ ...rule, event: v as RuleEvent })}
                  disabled={!isEditable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_EVENTS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Conditions */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <ConditionBuilder
                conditions={rule.conditions || []}
                onChange={(conditions) => setRule({ ...rule, conditions })}
              />
            </CardContent>
          </Card>

          {/* Effects */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">Effects</CardTitle>
            </CardHeader>
            <CardContent>
              <EffectBuilder
                effects={rule.effects || []}
                onChange={(effects) => setRule({ ...rule, effects })}
              />
            </CardContent>
          </Card>

          {/* Preview */}
          <HumanPreview rule={rule} />

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" asChild>
              <Link to="/rules">Cancel</Link>
            </Button>
            {isEditable && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  onClick={() => setPublishDialogOpen(true)}
                  disabled={publishing}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Publish
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Rule</DialogTitle>
            <DialogDescription>
              This will make the rule active and it will start affecting customer profiles.
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
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
