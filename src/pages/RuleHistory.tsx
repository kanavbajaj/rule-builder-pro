import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { fetchRule, fetchRuleVersions, rollbackRule } from '@/lib/api';
import type { Rule, RuleVersion } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RotateCcw, Eye } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function RuleHistory() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [rule, setRule] = useState<Rule | null>(null);
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<RuleVersion | null>(null);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  async function loadData(ruleId: string) {
    try {
      const [ruleData, versionsData] = await Promise.all([
        fetchRule(ruleId),
        fetchRuleVersions(ruleId),
      ]);
      setRule(ruleData);
      setVersions(versionsData);
    } catch (error) {
      console.error('Failed to load history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rule history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRollback() {
    if (!id || rollbackVersion === null) return;

    try {
      await rollbackRule(id, rollbackVersion);
      toast({ title: 'Rule rolled back' });
      loadData(id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to rollback rule',
        variant: 'destructive',
      });
    } finally {
      setRollbackDialogOpen(false);
      setRollbackVersion(null);
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

  if (!rule) {
    return (
      <Layout>
        <div className="text-center py-12 text-muted-foreground">
          Rule not found
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/rules/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{rule.name}</h1>
            <p className="text-sm text-muted-foreground">
              Version History • Current: v{rule.version}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Version List */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">Published Versions</CardTitle>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No published versions yet
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedVersion?.id === version.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Version {version.version}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(version.created_at), 'PPp')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVersion(version);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRollbackVersion(version.version);
                              setRollbackDialogOpen(true);
                            }}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Rollback
                          </Button>
                        </div>
                      </div>
                      {version.release_note && (
                        <div className="text-sm text-muted-foreground mt-2 border-t border-border pt-2">
                          {version.release_note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Version Details */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedVersion ? `Version ${selectedVersion.version} Details` : 'Select a Version'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedVersion ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <div className="font-medium">{selectedVersion.snapshot.name}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Event</label>
                    <div className="font-medium">{selectedVersion.snapshot.event}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <div className="font-medium">{selectedVersion.snapshot.priority}</div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Conditions</label>
                    <pre className="mt-1 p-3 rounded-lg bg-muted text-xs font-mono overflow-auto">
                      {JSON.stringify(selectedVersion.snapshot.conditions, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Effects</label>
                    <pre className="mt-1 p-3 rounded-lg bg-muted text-xs font-mono overflow-auto">
                      {JSON.stringify(selectedVersion.snapshot.effects, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  Select a version from the list to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={rollbackDialogOpen}
        onOpenChange={setRollbackDialogOpen}
        title="Rollback Rule"
        description={`Are you sure you want to rollback to version ${rollbackVersion}? This will create a new draft with the selected version's configuration.`}
        confirmLabel="Rollback"
        onConfirm={handleRollback}
      />
    </Layout>
  );
}
