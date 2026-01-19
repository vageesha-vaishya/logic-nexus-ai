-- Add user scaling columns to subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS user_scaling_factor numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_users integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_users integer DEFAULT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN subscription_plans.user_scaling_factor IS 'Multiplier for price adjustment based on user count';
COMMENT ON COLUMN subscription_plans.min_users IS 'Minimum users required for this plan';
COMMENT ON COLUMN subscription_plans.max_users IS 'Maximum users allowed for this plan (NULL = unlimited)';
