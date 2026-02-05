import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchStats, fetchRules, fetchAuditLogs } from '@/lib/api';
import type { Rule, AuditLog } from '@/lib/types';
import { StatusChip } from '@/components/StatusChip';
import { EventPill } from '@/components/EventPill';
import { PriorityBadge } from '@/components/PriorityBadge';
import {
  FileCode2,
  FlaskConical,
  Activity,
  Package,
  ArrowRight,
  History,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeRules: 0,
    draftRules: 0,
    inactiveRules: 0,
    totalProducts: 0,
  });
  const [recentRules, setRecentRules] = useState<Rule[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, rulesData, logsData] = await Promise.all([
          fetchStats(),
          fetchRules(),
          fetchAuditLogs(),
        ]);
        setStats(statsData);
        setRecentRules(rulesData.slice(0, 5));
        setRecentLogs(logsData.slice(0, 5));
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage personalization rules and test recommendations
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Rules
              </CardTitle>
              <Activity className="h-4 w-4 text-status-active" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeRules}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently in production
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Draft Rules
              </CardTitle>
              <FileCode2 className="h-4 w-4 text-status-draft" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.draftRules}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pending review
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inactive Rules
              </CardTitle>
              <FileCode2 className="h-4 w-4 text-status-inactive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.inactiveRules}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Disabled or archived
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Products
              </CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                In recommendation engine
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-primary" />
                Rules Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create and manage personalization rules that update customer scores and tags.
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/rules/new">
                    Create Rule
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/rules">
                    View All Rules
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-accent" />
                Rule Simulator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Test rules against customer profiles and see recommendations with full explainability.
              </p>
              <Button variant="outline" asChild>
                <Link to="/simulate">
                  Open Simulator
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Rules */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">Recent Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : recentRules.length === 0 ? (
                <div className="text-sm text-muted-foreground">No rules yet</div>
              ) : (
                <div className="space-y-3">
                  {recentRules.map((rule) => (
                    <Link
                      key={rule.id}
                      to={`/rules/${rule.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <PriorityBadge priority={rule.priority} />
                        <div>
                          <div className="font-medium text-sm">{rule.name}</div>
                          <EventPill event={rule.event} className="mt-1" />
                        </div>
                      </div>
                      <StatusChip status={rule.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Log */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : recentLogs.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity yet</div>
              ) : (
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <div className="text-sm">
                          <span className="font-medium">{log.actor}</span>
                          {' '}
                          <span className="text-muted-foreground">
                            {log.action.toLowerCase()}
                          </span>
                          {' '}
                          <span className="text-primary">
                            {log.entity_type.toLowerCase()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
