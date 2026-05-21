-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515024241; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Enable RLS on partitions so direct-partition queries also respect security.
-- Parent table's RLS handles parent-routed queries; this covers direct-partition access.
ALTER TABLE markets.price_history_y2025 ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.price_history_y2026 ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.price_history_y2027 ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_history_y2025_authenticated_read ON markets.price_history_y2025
  FOR SELECT TO authenticated USING (true);
CREATE POLICY price_history_y2026_authenticated_read ON markets.price_history_y2026
  FOR SELECT TO authenticated USING (true);
CREATE POLICY price_history_y2027_authenticated_read ON markets.price_history_y2027
  FOR SELECT TO authenticated USING (true);