import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Star, Activity, User, Truck, Clock } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';

interface LeadScoringCardProps {
  leadId: string;
  score: number;
  status: string;
  estimatedValue: number | null;
  lastActivityDate: string | null;
  source: string;
  title?: string | null; // Needed for demographic calculation
}

interface ScoreBreakdown {
  demographic: number;
  behavioral: number;
  logistics: number;
  decay: number;
}

export function LeadScoringCard({ leadId, score, status, estimatedValue, lastActivityDate, source, title }: LeadScoringCardProps) {
  const { supabase } = useCRM();
  const [breakdown, setBreakdown] = useState<ScoreBreakdown>({
    demographic: 0,
    behavioral: 0,
    logistics: 0,
    decay: 0
  });

  const getScoreGrade = (score: number) => {
    if (score >= 80) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-500/10' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-500/10' };
    if (score >= 40) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-500/10' };
    return { grade: 'D', color: 'text-red-600', bg: 'bg-red-500/10' };
  };

  const { grade, color, bg } = getScoreGrade(score);
  const percentage = Math.min((score / 100) * 100, 100);

  useEffect(() => {
    calculateBreakdown();
  }, [leadId, score, estimatedValue, title]);

  const calculateBreakdown = async () => {
    try {
      // Use default weights since lead_score_config table doesn't exist
      const weights = {
        demographic: { title_cxo: 20, title_vp: 15, title_manager: 10 },
        behavioral: { email_opened: 5, link_clicked: 10, page_view: 2, form_submission: 20 },
        logistics: { high_value_cargo: 20, urgent_shipment: 15 },
        decay: { weekly_percentage: 10 }
      };

      // Fetch Activities from activities table
      const { data: activities } = await supabase
        .from('activities')
        .select('activity_type')
        .eq('lead_id', leadId);

      // 1. Demographic Score
      let demoScore = 0;
      if (title) {
        const t = title.toLowerCase();
        if (t.includes('cxo') || t.includes('chief') || t.includes('ceo') || t.includes('cto')) demoScore += weights.demographic.title_cxo || 0;
        else if (t.includes('vp') || t.includes('president') || t.includes('director')) demoScore += weights.demographic.title_vp || 0;
        else if (t.includes('manager') || t.includes('lead')) demoScore += weights.demographic.title_manager || 0;
      }

      // 2. Logistics Score
      let logScore = 0;
      if (estimatedValue && estimatedValue > 50000) logScore += weights.logistics.high_value_cargo || 0;

      // 3. Behavioral Score
      let behScore = 0;
      if (activities) {
        activities.forEach((a: any) => {
          const actType = a.activity_type as keyof typeof weights.behavioral;
          if (weights.behavioral[actType]) {
            behScore += weights.behavioral[actType];
          }
        });
      }

      // 4. Decay (Simplified visual approximation)
      let decayAmount = 0;
      if (lastActivityDate) {
        const last = new Date(lastActivityDate);
        const now = new Date();
        const diffWeeks = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24 * 7));
        if (diffWeeks > 0) {
            // This is just an estimation for display. The real score already includes decay.
            // We can infer decay if we want, or just show 0 if recent.
            // Actually, we can't easily calculate exact decay amount without history of scores.
            // So we will just leave it as 0 or calculate what it WOULD be if score was sum of parts.
            const totalRaw = demoScore + logScore + behScore;
            if (score < totalRaw) {
                decayAmount = totalRaw - score;
            }
        }
      }

      setBreakdown({
        demographic: demoScore,
        behavioral: behScore,
        logistics: logScore,
        decay: decayAmount
      });

    } catch (error) {
      console.error('Error calculating score breakdown:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Lead Score
        </CardTitle>
        <CardDescription>AI-powered qualification score</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{score}</span>
              <span className="text-muted-foreground">/ 100</span>
            </div>
            <Badge className={`${bg} ${color}`}>
              Grade {grade}
            </Badge>
          </div>
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${bg}`}>
            <Star className={`h-8 w-8 ${color}`} />
          </div>
        </div>

        <Progress value={percentage} className="h-2" />

        <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3 w-3" /> Demographic
                </div>
                <div className="font-medium">{breakdown.demographic} pts</div>
            </div>
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Activity className="h-3 w-3" /> Behavioral
                </div>
                <div className="font-medium">{breakdown.behavioral} pts</div>
            </div>
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="h-3 w-3" /> Logistics
                </div>
                <div className="font-medium">{breakdown.logistics} pts</div>
            </div>
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" /> Decay
                </div>
                <div className="font-medium text-red-500">-{breakdown.decay} pts</div>
            </div>
        </div>

        <div className="space-y-2 text-sm border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status Impact:</span>
            <Badge variant="outline">{status}</Badge>
          </div>
          {estimatedValue && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Value Impact:</span>
              <span className="font-medium text-green-600">
                ${estimatedValue.toLocaleString()}
              </span>
            </div>
          )}
          {lastActivityDate && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Activity:</span>
              <span className="text-xs">
                {new Date(lastActivityDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}