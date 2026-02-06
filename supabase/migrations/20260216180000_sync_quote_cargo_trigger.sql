
-- Migration to add sync trigger to quote_cargo_configurations
-- ensuring container_type/size text and IDs are kept in sync
-- Reuses existing sync_shipment_container_columns function which is generic enough

CREATE TRIGGER trg_sync_container_cols_quote_cargo
BEFORE INSERT OR UPDATE ON public.quote_cargo_configurations
FOR EACH ROW
EXECUTE FUNCTION public.sync_shipment_container_columns();
