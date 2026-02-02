import { Badge } from '@/components/ui/badge';
import { VendorStatus, OnboardingStatus } from '@/types/vendor';

interface VendorStatusBadgeProps {
  status: VendorStatus;
  onboardingStatus?: OnboardingStatus;
}

export function VendorStatusBadge({ status, onboardingStatus }: VendorStatusBadgeProps) {
  // If onboarding is not complete, show onboarding status
  if (status === 'pending' && onboardingStatus && onboardingStatus !== 'approved') {
    const onboardingColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: 'outline',
      invited: 'secondary',
      pending_docs: 'secondary',
      in_review: 'default', // Using default (primary color) for review
      rejected: 'destructive',
      suspended: 'destructive',
    };
    
    return (
      <Badge variant={onboardingColors[onboardingStatus] || 'outline'} className="capitalize">
        {onboardingStatus.replace('_', ' ')}
      </Badge>
    );
  }

  // Otherwise show active/inactive status
  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: 'default', // We can use a custom green class if needed, but default is fine
    inactive: 'secondary',
    pending: 'outline',
  };

  return (
    <Badge variant={statusColors[status] || 'outline'} className="capitalize">
      {status}
    </Badge>
  );
}
