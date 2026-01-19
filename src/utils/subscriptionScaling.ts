
export interface ScalingPlan {
  price_monthly: number;
  user_scaling_factor: number;
  min_users: number;
  max_users: number | null;
}

export interface ScaledResult {
  valid: boolean;
  reason?: string;
  monthly_price: number;
  annual_price: number; // extrapolated
  effective_user_count: number;
}

/**
 * Calculates the scaled price based on user count and plan parameters.
 * Formula: Total = Base Price + (User Count * Scaling Factor)
 */
export function calculateScaledPrice(
  plan: ScalingPlan,
  userCount: number
): ScaledResult {
  const { price_monthly, user_scaling_factor, min_users, max_users } = plan;
  
  // Validation checks
  if (userCount < 0) {
    return {
      valid: false,
      reason: 'User count cannot be negative',
      monthly_price: price_monthly,
      annual_price: price_monthly * 12,
      effective_user_count: userCount
    };
  }

  if (min_users > 0 && userCount < min_users) {
    return {
      valid: false,
      reason: `User count ${userCount} is below the plan minimum of ${min_users}`,
      monthly_price: price_monthly + (min_users * (user_scaling_factor || 0)),
      annual_price: (price_monthly + (min_users * (user_scaling_factor || 0))) * 12,
      effective_user_count: userCount
    };
  }

  if (max_users !== null && max_users > 0 && userCount > max_users) {
    return {
      valid: false,
      reason: `User count ${userCount} exceeds the plan maximum of ${max_users}`,
      monthly_price: price_monthly + (max_users * (user_scaling_factor || 0)),
      annual_price: (price_monthly + (max_users * (user_scaling_factor || 0))) * 12,
      effective_user_count: userCount
    };
  }

  const factor = user_scaling_factor || 0;
  const scaledMonthly = price_monthly + (userCount * factor);

  return {
    valid: true,
    monthly_price: scaledMonthly,
    annual_price: scaledMonthly * 12,
    effective_user_count: userCount
  };
}
