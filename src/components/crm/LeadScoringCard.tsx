import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Star } from 'lucide-react';

interface LeadScoringCardProps {
  score: number;
  status: string;
  estimatedValue: number | null;
  lastActivityDate: string | null;
  source: string;
}

export function LeadScoringCard({ score, status, estimatedValue, lastActivityDate, source }: LeadScoringCardProps) {
  const getScoreGrade = (score: number) => {
    if (score >= 80) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-500/10' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-500/10' };
    if (score >= 40) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-500/10' };
    return { grade: 'D', color: 'text-red-600', bg: 'bg-red-500/10' };
  };

  const { grade, color, bg } = getScoreGrade(score);
  const percentage = Math.min((score / 100) * 100, 100);

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

        <div className="space-y-2 text-sm">
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
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Source Impact:</span>
            <Badge variant="outline">{source}</Badge>
          </div>
          {lastActivityDate && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Activity:</span>
              <span className="text-xs">
                {new Date(lastActivityDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
          <p className="font-medium">Score Breakdown:</p>
          <ul className="space-y-0.5 text-muted-foreground">
            <li>• Status progress: Up to 50 points</li>
            <li>• Deal value: Up to 30 points</li>
            <li>• Recent engagement: Up to 15 points</li>
            <li>• Lead source quality: Up to 15 points</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
