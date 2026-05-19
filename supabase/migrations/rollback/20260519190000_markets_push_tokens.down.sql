-- Rollback for T24c push_tokens extensions. Leaves the base table from
-- the earlier migration intact — we only drop what T24c added.
DROP INDEX IF EXISTS markets.push_tokens_user_lastseen_idx;
ALTER TABLE markets.push_tokens DROP COLUMN IF EXISTS last_seen_at;
