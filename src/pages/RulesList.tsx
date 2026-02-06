import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusChip } from '@/components/StatusChip';
import { PriorityBadge } from '@/components/PriorityBadge';
import { EventPill } from '@/components/EventPill';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { fetchRules, disableRule, cloneRule, deleteRule } from '@/lib/api';
import type { Rule, RuleStatus, RuleEvent } from '@/lib/types';
import { RULE_EVENTS } from '@/lib/types';
import {
  Plus,
  Search,
  Edit2,
  Copy,
  History,
  Power,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function RulesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void;
  } | null>(null);
  const { toast } = useToast();

  const statusFilter = searchParams.get('status') || '';
  const eventFilter = searchParams.get('event') || '';
  const searchQuery = searchParams.get('q') || '';

  useEffect(() => {
    loadRules();
  }, [statusFilter, eventFilter, searchQuery]);

  async function loadRules() {
    try {
      setLoading(true);
      const data = await fetchRules({
        status: statusFilter || undefined,
        event: eventFilter || undefined,
        q: searchQuery || undefined,
      });
      setRules(data);
    } catch (error) {
      console.error('Failed to load rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function updateFilters(key: string, value: string) {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  }

  async function handleDisable(rule: Rule) {
    setConfirmDialog({
      open: true,
      title: 'Disable Rule',
      description: `Are you sure you want to disable "${rule.name}"? It will stop affecting customer profiles.`,
      onConfirm: async () => {
        try {
          await disableRule(rule.id);
          toast({ title: 'Rule disabled' });
          loadRules();
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to disable rule',
            variant: 'destructive',
          });
        }
        setConfirmDialog(null);
      },
    });
  }

  async function handleClone(rule: Rule) {
    try {
      const cloned = await cloneRule(rule.id);
      toast({ title: 'Rule cloned', description: `Created "${cloned.name}"` });
      loadRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clone rule',
        variant: 'destructive',
      });
    }
  }

  async function handleDelete(rule: Rule) {
    setConfirmDialog({
      open: true,
      title: 'Delete Rule',
      description: `Are you sure you want to permanently delete "${rule.name}"? This action cannot be undone.`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteRule(rule.id);
          toast({ title: 'Rule deleted' });
          loadRules();
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to delete rule',
            variant: 'destructive',
          });
        }
        setConfirmDialog(null);
      },
    });
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rules</h1>
            <p className="text-muted-foreground mt-1">
              Manage personalization rules
            </p>
          </div>
          <Button asChild>
            <Link to="/rules/new">
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => updateFilters('q', e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter || '__all__'}
            onValueChange={(v) => updateFilters('status', v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={eventFilter || '__all__'}
            onValueChange={(v) => updateFilters('event', v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Events</SelectItem>
              {RULE_EVENTS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Event</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    No rules found
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <Link
                        to={`/rules/${rule.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {rule.name}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        v{rule.version}
                      </div>
                    </td>
                    <td>
                      <EventPill event={rule.event} />
                    </td>
                    <td>
                      <PriorityBadge priority={rule.priority} />
                    </td>
                    <td>
                      <StatusChip status={rule.status} />
                    </td>
                    <td className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(rule.updated_at), { addSuffix: true })}
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/rules/${rule.id}`}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleClone(rule)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Clone
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/rules/${rule.id}/history`}>
                              <History className="h-4 w-4 mr-2" />
                              History
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {rule.status === 'ACTIVE' && (
                            <DropdownMenuItem onClick={() => handleDisable(rule)}>
                              <Power className="h-4 w-4 mr-2" />
                              Disable
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(rule)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
    </Layout>
  );
}
