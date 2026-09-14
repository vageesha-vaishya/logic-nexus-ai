import { Badge } from '@/components/ui/badge';
import { RiskRating } from '@/types/vendor';

interface RiskBadgeProps {
  rating: RiskRating;
}

export function RiskBadge({ rating }: RiskBadgeProps) {
  const colors: Record<RiskRating, string> = {
    low: 'bg-status-success text-status-success-foreground hover:bg-status-success/80 border-status-success-border',
    medium: 'bg-status-warning text-status-warning-foreground hover:bg-status-warning/80 border-status-warning-border',
    high: 'bg-status-warning text-status-warning-foreground hover:bg-status-warning/80 border-status-warning-border',
    critical: 'bg-status-danger text-status-danger-foreground hover:bg-status-danger/80 border-status-danger-border',
  };

  return (
    <Badge variant="outline" className={`capitalize ${colors[rating] || ''}`}>
      {rating} Risk
    </Badge>
  );
}
