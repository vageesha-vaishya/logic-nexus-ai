export { RetailMode } from './RetailMode';
export { OnboardingWizard } from './onboarding/OnboardingWizard';
export { RetailDashboard } from './dashboard/RetailDashboard';
export { RetailSignalFeed } from './feed/RetailSignalFeed';
export { ExecutionBottomSheet } from './feed/ExecutionBottomSheet';

export { useRiskProfile, useUpsertRiskProfile } from './hooks/useRiskProfile';
export { usePortfolioTiers, useUpsertPortfolioTier } from './hooks/usePortfolioTiers';
export { useRetailSignals } from './hooks/useRetailSignals';

export {
  computeRiskTag,
  TIER_DEFAULTS,
  GOALS,
} from './types';

export type {
  ExperienceLevel,
  Goal,
  GoalId,
  PortfolioTier,
  RetailSignal,
  RiskProfile,
  RiskTag,
  SignalExplanations,
  TierName,
  UpsertRiskProfileInput,
  UpsertTierInput,
} from './types';
