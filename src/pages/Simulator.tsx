import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TraceTable } from '@/components/TraceTable';
import { ProfileDiffView } from '@/components/ProfileDiffView';
import { RecommendationsView } from '@/components/RecommendationsView';
import { runSimulation } from '@/lib/api';
import type { Profile, SimulationEvent, SimulationResult } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Play, RotateCcw, FileJson } from 'lucide-react';

const DEFAULT_PROFILE: Profile = {
  customer_id: 'C123',
  static_data: { age: 30, employment: 'salaried', hasHomeLoan: false },
  behavioral: { salaryCreditsPerMonth: 1, rentPaymentsPerMonth: 1, marketplaceVisits: 4 },
  scores: { financialStability: 52, homeOwnershipIntent: 35, creditReadiness: 40, digitalEngagement: 20 },
  tags: [],
  last_updated: new Date().toISOString(),
};

const DEFAULT_EVENTS: SimulationEvent[] = [
  { type: 'SALARY_CREDIT', payload: { amount: 65000 } },
  { type: 'TRANSFER_POSTED', payload: { counterpartyLabel: 'Rent - Mr. Sharma', frequency: 'monthly' } },
];

export default function Simulator() {
  const { toast } = useToast();
  
  const [profileJson, setProfileJson] = useState(JSON.stringify(DEFAULT_PROFILE, null, 2));
  const [eventsJson, setEventsJson] = useState(JSON.stringify(DEFAULT_EVENTS, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState('trace');

  async function handleRun() {
    try {
      const profile = JSON.parse(profileJson) as Profile;
      const events = JSON.parse(eventsJson) as SimulationEvent[];

      setLoading(true);
      const simResult = await runSimulation(profile, events);
      setResult(simResult);
      setActiveTab('trace');
    } catch (error) {
      console.error('Simulation failed:', error);
      toast({
        title: 'Error',
        description: error instanceof SyntaxError ? 'Invalid JSON' : 'Simulation failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setProfileJson(JSON.stringify(DEFAULT_PROFILE, null, 2));
    setEventsJson(JSON.stringify(DEFAULT_EVENTS, null, 2));
    setResult(null);
  }

  function loadExample(type: string) {
    if (type === 'high-salary') {
      setEventsJson(JSON.stringify([
        { type: 'SALARY_CREDIT', payload: { amount: 150000 } },
      ], null, 2));
    } else if (type === 'renter') {
      setEventsJson(JSON.stringify([
        { type: 'TRANSFER_POSTED', payload: { counterpartyLabel: 'House Rent Payment', frequency: 'monthly' } },
      ], null, 2));
    } else if (type === 'combo') {
      setEventsJson(JSON.stringify(DEFAULT_EVENTS, null, 2));
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Simulator</h1>
          <p className="text-muted-foreground mt-1">
            Test rules against customer profiles and see recommendations
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Panel */}
          <div className="space-y-4">
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Customer Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={profileJson}
                  onChange={(e) => setProfileJson(e.target.value)}
                  className="font-mono text-sm min-h-[200px]"
                  placeholder="Enter customer profile JSON..."
                />
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileJson className="h-5 w-5" />
                    Recent Events
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadExample('high-salary')}
                    >
                      High Salary
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadExample('renter')}
                    >
                      Renter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadExample('combo')}
                    >
                      Combo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={eventsJson}
                  onChange={(e) => setEventsJson(e.target.value)}
                  className="font-mono text-sm min-h-[150px]"
                  placeholder="Enter events JSON array..."
                />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleRun} disabled={loading} className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                {loading ? 'Running...' : 'Run Simulation'}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {/* Results Panel */}
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Results</CardTitle>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="text-center py-12 text-muted-foreground">
                  Run a simulation to see results
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="trace" className="flex-1">Trace</TabsTrigger>
                    <TabsTrigger value="diff" className="flex-1">Profile Diff</TabsTrigger>
                    <TabsTrigger value="recs" className="flex-1">Recommendations</TabsTrigger>
                    <TabsTrigger value="why" className="flex-1">Why</TabsTrigger>
                  </TabsList>

                  <div className="mt-4">
                    <TabsContent value="trace" className="mt-0">
                      <TraceTable trace={result.trace} />
                    </TabsContent>

                    <TabsContent value="diff" className="mt-0">
                      <ProfileDiffView
                        before={result.originalProfile}
                        after={result.newProfile}
                      />
                    </TabsContent>

                    <TabsContent value="recs" className="mt-0">
                      <RecommendationsView recommendations={result.recommendations} />
                    </TabsContent>

                    <TabsContent value="why" className="mt-0">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <pre className="text-sm whitespace-pre-wrap">{result.narrative}</pre>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
