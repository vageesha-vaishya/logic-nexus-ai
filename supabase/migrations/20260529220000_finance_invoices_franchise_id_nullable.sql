-- Relax finance.invoices.franchise_id to nullable. The LIKE-inherited
-- NOT NULL from public.invoices was unnecessarily strict for cross-
-- module-consumer-generated draft invoices, where the source shipment
-- often lacks a franchise_id (all 4 currently-delivered shipments have
-- NULL franchise_id in prod). The dual-write from public.invoices
-- still writes whatever public has, so real-franchise invoices keep
-- their real franchise.

ALTER TABLE finance.invoices ALTER COLUMN franchise_id DROP NOT NULL;
