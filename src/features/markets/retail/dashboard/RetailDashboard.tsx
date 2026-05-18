import { Badge } from '@/components/ui/badge';

import { PortfolioTierView } from './PortfolioTierView';
import type { RiskProfile, RiskTag } from '../types';

interface RetailDashboardProps {
  profile: RiskProfile;
}

const RISK_TAG_LABEL: Record<RiskTag, string> = {
  conservative: 'Conservative',
  moderate:     'Moderate',
  aggressive:   'Aggressive',
};

const EXPERIENCE_LABEL: Record<RiskProfile['experience_level'], string> = {
  beginner:      'Beginner',
  casual:        'Casual',
  self_directed: 'Self-directed',
};

export function RetailDashboard({ profile }: RetailDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Your Portfolio</h2>
          <p className="text-xs text-muted-foreground">
            {EXPERIENCE_LABEL[profile.experience_level]} investor
            {profile.goals.length > 0 && (
              <>
                {' · '}
                {profile.goals.length} active goal{profile.goals.length === 1 ? '' : 's'}
              </>
            )}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {RISK_TAG_LABEL[profile.risk_tag]}
        </Badge>
      </div>

      <PortfolioTierView />
    </div>
  );
}
