import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  LayoutGrid, 
  List as ListIcon, 
  Columns, 
  Sparkles, 
  Ship, 
  Plane, 
  Truck, 
  CheckCircle2, 
  Leaf, 
  ArrowRight,
  Info,
  Edit2,
  DollarSign,
  Timer,
  ShieldCheck,
  Map as MapIcon,
  LayoutList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { QuoteLegsVisualizer } from '../quick-quote/QuoteLegsVisualizer';
import { QuoteDetailView } from '../quick-quote/QuoteDetailView';
import { QuoteMapVisualizer } from '../quick-quote/QuoteMapVisualizer';
import { mapOptionToQuote } from '@/lib/quote-mapper';

interface OptionOverviewProps {
  options: any[];
  selectedId?: string;
  onSelect: (id: string) => void;
  marketAnalysis?: string | null;
  confidenceScore?: number | null;
  anomalies?: any[];
}

export function QuoteOptionsOverview({ 
  options, 
  selectedId, 
  onSelect, 
  marketAnalysis, 
  confidenceScore,
  anomalies 
}: OptionOverviewProps) {
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'table'>('card');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOption, setDetailsOption] = useState<any>(null);

  const handleViewDetails = (e: React.MouseEvent, opt: any) => {
    e.stopPropagation();
    setDetailsOption(opt);
    setDetailsOpen(true);
  };

  const getModeIcon = (mode: string) => {
    if (!mode) return <Ship className="h-4 w-4" />;
    const m = mode.toLowerCase();
    if (m.includes('air')) return <Plane className="h-4 w-4" />;
    if (m.includes('road') || m.includes('truck')) return <Truck className="h-4 w-4" />;
    return <Ship className="h-4 w-4" />;
  };

  const formatCurrency = (amount: number, currency: any) => {
    const code = typeof currency === 'object' ? currency?.code : currency;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code || 'USD' }).format(amount);
  };

  const getReliabilityColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getTierBadge = (tier: string) => {
    if (!tier) return null;
    switch (tier) {
        case 'contract': return <Badge className="bg-green-600">Contract</Badge>;
        case 'spot': return <Badge className="bg-blue-600">Spot</Badge>;
        case 'best_value': return <Badge className="bg-purple-600"><Sparkles className="w-3 h-3 mr-1"/> Best Value</Badge>;
        case 'cheapest': return <Badge className="bg-emerald-600"><DollarSign className="w-3 h-3 mr-1"/> Cheapest</Badge>;
        case 'fastest': return <Badge className="bg-amber-600"><Timer className="w-3 h-3 mr-1"/> Fastest</Badge>;
        case 'greenest': return <Badge className="bg-green-500"><Leaf className="w-3 h-3 mr-1"/> Eco-Friendly</Badge>;
        case 'reliable': return <Badge className="bg-blue-500"><ShieldCheck className="w-3 h-3 mr-1"/> Most Reliable</Badge>;
        default: return <Badge variant="outline">{tier}</Badge>;
    }
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelect(id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* AI Analysis Section */}
      {marketAnalysis && (
        <Card className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-indigo-100 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <CardTitle className="text-lg font-semibold text-indigo-900">AI Market Analysis</CardTitle>
              </div>
              {confidenceScore && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Confidence Score:</span>
                  <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                      style={{ width: `${confidenceScore}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-indigo-700">{confidenceScore}%</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-indigo-800/90 leading-relaxed">
              {marketAnalysis}
            </p>
            {anomalies && anomalies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {anomalies.map((anomaly: any, i: number) => (
                  <Badge key={i} variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-800 text-xs">
                    Alert: {typeof anomaly === 'string' ? anomaly : anomaly.description || 'Route anomaly detected'}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* View Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Rate Options ({options.length})</h3>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <Button 
            variant={viewMode === 'card' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-7 px-2"
            onClick={() => setViewMode('card')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" /> Cards
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-7 px-2"
            onClick={() => setViewMode('list')}
          >
            <ListIcon className="h-4 w-4 mr-1" /> List
          </Button>
          <Button 
            variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-7 px-2"
            onClick={() => setViewMode('table')}
          >
            <Columns className="h-4 w-4 mr-1" /> Grid
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {/* Card View */}
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {options.map((rawOpt) => {
              const opt = mapOptionToQuote(rawOpt);
              if (!opt) return null;
              return (
              <Card 
                key={opt.id} 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md border-2",
                  selectedId === opt.id ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/20"
                )}
                onClick={() => onSelect(opt.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-lg mr-1">{opt.carrier_name}</h4>
                        {getTierBadge(opt.tier)}
                        {opt.ai_generated && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] px-1 h-5">
                            AI Generated
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{opt.option_name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary">
                        {formatCurrency(opt.total_amount, opt.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Estimate</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block">Service</span>
                      <div className="font-medium flex items-center gap-1">
                        {getModeIcon(opt.mode)}
                        {opt.service_type || 'Standard'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block">Transit Time</span>
                      <div className="font-medium">{opt.transit_time?.details || opt.transit_time || `${opt.total_transit_days || '-'} days`}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t grid grid-cols-2 gap-2">
                    {opt.reliability_score && (
                      <div className={cn("px-2 py-1 rounded text-xs font-medium border flex items-center justify-between", getReliabilityColor(opt.reliability_score))}>
                        <span>Reliability</span>
                        <span>{opt.reliability_score}/10</span>
                      </div>
                    )}
                    {opt.total_co2_kg > 0 && (
                      <div className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200 flex items-center justify-between">
                        <span className="flex items-center gap-1"><Leaf className="h-3 w-3" /> CO2</span>
                        <span>{opt.total_co2_kg} kg</span>
                      </div>
                    )}
                  </div>
                  
                  {/* AI Explanation */}
                  {opt.ai_explanation && (
                    <div className="text-xs text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 flex items-start gap-2">
                      <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{opt.ai_explanation}</span>
                    </div>
                  )}

                  {/* Visual Legs */}
                  {opt.legs && opt.legs.length > 0 && (
                    <QuoteLegsVisualizer legs={opt.legs} />
                  )}

                  <div className="pt-2 flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 text-xs h-7"
                      onClick={(e) => handleViewDetails(e, opt)}
                    >
                      <Info className="h-3 w-3" /> Details
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="gap-1 text-xs h-7"
                      onClick={(e) => handleEdit(e, opt.id)}
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ); })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="space-y-2">
            {options.map((rawOpt) => {
              const opt = mapOptionToQuote(rawOpt);
              if (!opt) return null;
              return (
              <div 
                key={opt.id}
                onClick={() => onSelect(opt.id)}
                className={cn(
                  "group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedId === opt.id ? "bg-primary/5 border-primary" : "bg-card hover:bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                    {getModeIcon(opt.mode)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{opt.carrier_name}</h4>
                      {getTierBadge(opt.tier)}
                      {opt.ai_generated && <Sparkles className="h-3 w-3 text-purple-500" />}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{opt.option_name}</span>
                      <span>•</span>
                      <span>{opt.service_type || 'Standard'}</span>
                      <span>•</span>
                      <span>{opt.transit_time?.details || opt.transit_time || `${opt.total_transit_days} days`}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {opt.reliability_score && (
                    <div className="text-right hidden sm:block">
                      <span className="text-xs text-muted-foreground block">Reliability</span>
                      <span className={cn("text-sm font-medium", 
                        opt.reliability_score >= 80 ? "text-green-600" : "text-yellow-600"
                      )}>{opt.reliability_score}/10</span>
                    </div>
                  )}
                  <div className="text-right min-w-[100px]">
                    <span className="text-lg font-bold text-primary block">
                      {formatCurrency(opt.total_amount, opt.currency)}
                    </span>
                  </div>
                  <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ); })}
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Option Name</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Transit Time</TableHead>
                  <TableHead>Reliability</TableHead>
                  <TableHead>CO2</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {options.map((rawOpt) => {
                  const opt = mapOptionToQuote(rawOpt);
                  if (!opt) return null;
                  return (
                  <TableRow 
                    key={opt.id} 
                    className={cn("cursor-pointer", selectedId === opt.id && "bg-muted/50")}
                    onClick={() => onSelect(opt.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {opt.carrier_name || opt.carrier?.name || 'Unknown Carrier'}
                        {opt.ai_generated && <Sparkles className="h-3 w-3 text-purple-500" />}
                        {getTierBadge(opt.tier)}
                      </div>
                    </TableCell>
                    <TableCell>{opt.option_name}</TableCell>
                    <TableCell>{opt.service_type || '-'}</TableCell>
                    <TableCell>{opt.transit_time?.details || opt.transit_time || `${opt.total_transit_days || '-'} days`}</TableCell>
                    <TableCell>
                      {opt.reliability_score ? (
                        <Badge variant="outline" className={cn("font-normal", getReliabilityColor(opt.reliability_score).split(' ')[1])}>
                          {opt.reliability_score}/10
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{opt.total_co2_kg ? `${opt.total_co2_kg} kg` : '-'}</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(opt.total_amount, opt.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => handleViewDetails(e, opt)}
                          title="View Charge Breakdown"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 hover:text-primary"
                          onClick={(e) => handleEdit(e, opt.id)}
                          title="Edit Configuration"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {selectedId === opt.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                    </TableCell>
                  </TableRow>
                ); })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quote Option Details</DialogTitle>
            <DialogDescription>
              Comprehensive breakdown of charges and routing for {detailsOption?.carrier_name || detailsOption?.carrier?.name || 'Unknown Carrier'} - {detailsOption?.option_name}
            </DialogDescription>
          </DialogHeader>

          {detailsOption && (
            <div className="space-y-6">
                <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="details" className="text-xs h-7"><LayoutList className="w-3 h-3 mr-2"/>Cost & Leg Breakdown</TabsTrigger>
                        <TabsTrigger value="map" className="text-xs h-7"><MapIcon className="w-3 h-3 mr-2"/>Route Map</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details">
                        <QuoteDetailView 
                            quote={mapOptionToQuote(detailsOption)} 
                        />
                    </TabsContent>

                    <TabsContent value="map">
                        <QuoteMapVisualizer 
                            origin={detailsOption.legs?.[0]?.origin_location || "Origin"} 
                            destination={detailsOption.legs?.[detailsOption.legs.length - 1]?.destination_location || "Destination"}
                            legs={detailsOption.legs || []}
                        />
                    </TabsContent>
                </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}