import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { fetchProduct, createProduct, updateProduct } from '@/lib/api';
import type { Product } from '@/lib/types';
import { KNOWN_SCORES } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ScoreEntry {
  score: string;
  value: number;
}

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
