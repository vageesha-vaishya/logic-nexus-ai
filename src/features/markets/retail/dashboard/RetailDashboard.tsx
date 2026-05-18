import { PortfolioTierView } from './PortfolioTierView';
import type { RiskProfile } from '../types';

interface RetailDashboardProps {
  profile: RiskProfile;
}

export function RetailDashboard({ profile }: RetailDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your Portfolio</h2>
          <p className="text-xs text-muted-foreground capitalize">
            {profile.risk_tag} · {profile.experience_level.replace(/_/g, '-')} investor
          </p>
        </div>
      </div>
      <PortfolioTierView profileGoals={profile.goals} />
    </div>
  );
}
