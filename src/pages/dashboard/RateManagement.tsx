import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  LineChart, 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Ship, 
  Plane, 
  Truck, 
  Train,
  Loader2 
} from 'lucide-react';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';
import { RateSheetsTab } from '@/components/rates/RateSheetsTab';
import { useTransportModes, getTransportModeIcon } from '@/hooks/useTransportModes';

export default function RateManagement() {
  const [activeTab, setActiveTab] = useState('analysis');
  const { invokeAiAdvisor } = useAiAdvisor();
  const { toast } = useToast();
  const { modes, loading: modesLoading } = useTransportModes();

  // Analysis State
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState('ocean');
  const [commodity, setCommodity] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!origin || !destination || !commodity) {
      toast({
        title: "Missing Information",
        description: "Please fill in Origin, Destination, and Commodity.",
        variant: "destructive"
      });
      return;
    }

    if (!modesLoading && modes.length > 0) {
      const validCodes = new Set(modes.map(m => String(m.code)));
      if (!validCodes.has(mode)) {
        toast({
          title: "Invalid Transport Mode",
          description: "Please select a valid transport mode from the list.",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);
    setAnalysisResult(null);

    try {
      const payload = {
        origin,
        destination,
        mode,
        commodity,
        weight: 1000, // Default for analysis
        unit: 'kg'
      };

      const { data, error } = await invokeAiAdvisor({
        action: 'generate_smart_quotes',
        payload
      });

      if (error) throw error;

      if (data) {
        setAnalysisResult(data);
        toast({
          title: "Analysis Complete",
          description: "Market analysis and rate benchmarks generated successfully."
        });
      }
    } catch (err: any) {
      console.error("Analysis Error:", err);
      toast({
        title: "Analysis Failed",
        description: err.message || "Could not generate analysis.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rate Management</h1>
          <p className="text-muted-foreground">
            Analyze market rates, manage carrier contracts, and optimize pricing strategies.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Rate Analysis
            </TabsTrigger>
            <TabsTrigger value="sheets" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Rate Sheets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Market Rate Analysis</CardTitle>
                  <CardDescription>
                    Use AI to analyze current market trends and generate benchmark rates for specific routes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-4 items-end">
                    <div className="space-y-2">
                      <Label>Transport Mode</Label>
                      <Select value={mode} onValueChange={setMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {modesLoading ? (
                            <SelectItem value="__loading" disabled>Loading...</SelectItem>
                          ) : modes.length === 0 ? (
                            <SelectItem value="__empty" disabled>No modes available</SelectItem>
                          ) : (
                            modes.map(m => (
                              <SelectItem key={m.id} value={m.code}>
                                <div className="flex items-center gap-2">
                                  {(() => { const Icon = getTransportModeIcon(m.icon_name); return <Icon className="h-4 w-4" />; })()}
                                  {m.name}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Origin (City/Port Code)</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="e.g. CNSHA or Shanghai" 
                          className="pl-9" 
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Destination (City/Port Code)</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="e.g. USLAX or Los Angeles" 
                          className="pl-9" 
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Commodity</Label>
                      <Input 
                        placeholder="e.g. Electronics" 
                        value={commodity}
                        onChange={(e) => setCommodity(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleAnalyze} disabled={loading} className="w-full md:w-auto">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing Market...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Generate Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {analysisResult && (
                <>
                  {/* Market Insights Card */}
                  <Card className="col-span-4 md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <SparklesIcon className="h-5 w-5 text-indigo-500" />
                        AI Market Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg text-sm leading-relaxed">
                        {analysisResult.market_analysis || "No market analysis available."}
                      </div>
                      
                      {analysisResult.confidence_score && (
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-sm font-medium">Confidence Score</span>
                          <Badge variant={analysisResult.confidence_score > 0.8 ? "default" : "secondary"}>
                            {(analysisResult.confidence_score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Anomalies & Risks Card */}
                  <Card className="col-span-4 md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Risk & Anomalies
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analysisResult.anomalies && analysisResult.anomalies.length > 0 ? (
                        <ul className="space-y-2">
                          {analysisResult.anomalies.map((anomaly: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-100 dark:border-amber-900/50">
                              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                              <span>{anomaly}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                          <p>No significant anomalies detected.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Benchmark Rates Table */}
                  <Card className="col-span-4">
                    <CardHeader>
                      <CardTitle>Benchmark Rate Options</CardTitle>
                      <CardDescription>Generated scenarios based on current market conditions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {analysisResult.options?.map((opt: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="font-bold text-primary">{i + 1}</span>
                              </div>
                              <div>
                                <h4 className="font-semibold">{opt.tier ? opt.tier.replace('_', ' ').toUpperCase() : 'STANDARD RATE'}</h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{opt.carrier_name || 'Generic Carrier'}</span>
                                  <span>•</span>
                                  <span>{opt.transit_time?.details || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: opt.currency || 'USD' }).format(opt.total_amount)}
                              </div>
                              <Badge variant="outline" className="mt-1">
                                {opt.service_type || mode.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sheets">
            <RateSheetsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M9 3v4" />
      <path d="M3 9h4" />
      <path d="M3 5h4" />
    </svg>
  )
}
