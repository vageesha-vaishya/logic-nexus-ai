
import { describe, it, expect } from 'vitest';
import { calculateScaledPrice, ScalingPlan } from './subscriptionScaling';

describe('calculateScaledPrice', () => {
  it('should calculate base price with no users and no scaling', () => {
    const plan: ScalingPlan = {
      price_monthly: 100,
      user_scaling_factor: 0,
      min_users: 0,
      max_users: null
    };
    const result = calculateScaledPrice(plan, 0);
    expect(result.valid).toBe(true);
    expect(result.monthly_price).toBe(100);
  });

  it('should add scaling factor for users', () => {
    const plan: ScalingPlan = {
      price_monthly: 100,
      user_scaling_factor: 10, // $10 per user
      min_users: 0,
      max_users: null
    };
    const result = calculateScaledPrice(plan, 5);
    expect(result.valid).toBe(true);
    expect(result.monthly_price).toBe(100 + (5 * 10)); // 150
  });

  it('should validate min users', () => {
    const plan: ScalingPlan = {
      price_monthly: 100,
      user_scaling_factor: 10,
      min_users: 5,
      max_users: null
    };
    
    // Below min
    const invalid = calculateScaledPrice(plan, 3);
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('below the plan minimum');

    // At min
    const valid = calculateScaledPrice(plan, 5);
    expect(valid.valid).toBe(true);
    expect(valid.monthly_price).toBe(100 + (5 * 10));
  });

  it('should validate max users', () => {
    const plan: ScalingPlan = {
      price_monthly: 100,
      user_scaling_factor: 10,
      min_users: 0,
      max_users: 20
    };
    
    // Above max
    const invalid = calculateScaledPrice(plan, 21);
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('exceeds the plan maximum');

    // At max
    const valid = calculateScaledPrice(plan, 20);
    expect(valid.valid).toBe(true);
    expect(valid.monthly_price).toBe(100 + (20 * 10));
  });

  it('should handle zero base price (pure per-user)', () => {
    const plan: ScalingPlan = {
      price_monthly: 0,
      user_scaling_factor: 25,
      min_users: 0,
      max_users: null
    };
    const result = calculateScaledPrice(plan, 4);
    expect(result.valid).toBe(true);
    expect(result.monthly_price).toBe(100);
  });
});
