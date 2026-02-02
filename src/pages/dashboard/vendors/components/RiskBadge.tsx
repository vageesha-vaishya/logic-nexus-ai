import { Badge } from '@/components/ui/badge';
import { RiskRating } from '@/types/vendor';

interface RiskBadgeProps {
  rating: RiskRating;
}

export function RiskBadge({ rating }: RiskBadgeProps) {
  const colors: Record<RiskRating, string> = {
    low: 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200',
    critical: 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200',
  };

  return (
    <Badge variant="outline" className={`capitalize ${colors[rating] || ''}`}>
      {rating} Risk
    </Badge>
  );
}
