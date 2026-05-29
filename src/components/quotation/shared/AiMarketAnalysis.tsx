import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

interface AiMarketAnalysisProps {
  analysis: string;
  confidenceScore?: number | null;
  anomalies?: any[];
}

export function AiMarketAnalysis({ analysis, confidenceScore, anomalies }: AiMarketAnalysisProps) {
  if (!analysis) return null;

  return (
    <Card className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border-indigo-100 shadow-sm mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg font-semibold text-indigo-900">AI Market Analysis</CardTitle>
          </div>
          {confidenceScore !== undefined && confidenceScore !== null && (
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
          {analysis}
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
  );
}
