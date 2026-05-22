/**
 * Compute the wizard step the user should resume at, given the existing
 * DB state. Pure derivation — no writes.
 *
 * Order matches design doc §"End-to-end flow":
 *   welcome   ← retail_profile.disclosure_accepted_at missing
 *   risk_quiz ← quiz_answers empty or risk_tag null
 *   goals     ← goals jsonb empty
 *   tiers     ← no portfolio_tiers rows
 *   starter   ← starter_template_slug null
 *   nominee   ← retail_profile.nominee null AND not skipped
 *   summary   ← onboarding_complete false
 *
 * If onboarding_complete is true, returns null — caller should redirect
 * away from the wizard.
 */
import type { RiskProfile } from '../types';
import type { PortfolioTier } from '../types';
import type { RetailProfile } from './useRetailProfile';
import type { WizardStepId } from './types';

export interface ResumeInputs {
  riskProfile:   RiskProfile  | null | undefined;
  retailProfile: RetailProfile | null | undefined;
  tiers:         PortfolioTier[] | undefined;
}

export function computeResumeStep(inputs: ResumeInputs): WizardStepId | null {
  const { riskProfile, retailProfile, tiers } = inputs;

  if (riskProfile?.onboarding_complete) return null;

  if (!retailProfile?.disclosure_accepted_at) return 'welcome';

  const quizDone =
    riskProfile &&
    riskProfile.quiz_answers &&
    Object.keys(riskProfile.quiz_answers).length > 0 &&
    Boolean(riskProfile.risk_tag);
  if (!quizDone) return 'risk_quiz';

  const goalsDone = riskProfile && Array.isArray(riskProfile.goals) && riskProfile.goals.length > 0;
  if (!goalsDone) return 'goals';

  const tiersDone = Array.isArray(tiers) && tiers.length >= 3;
  if (!tiersDone) return 'tiers';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const starterDone = Boolean((riskProfile as any)?.starter_template_slug);
  if (!starterDone) return 'starter';

  const nomineeNode = retailProfile?.nominee ?? null;
  const nomineeResolved =
    nomineeNode &&
    (nomineeNode.skipped === true || Boolean(nomineeNode.name));
  if (!nomineeResolved) return 'nominee';

  return 'summary';
}
