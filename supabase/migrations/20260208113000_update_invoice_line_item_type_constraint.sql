
-- Update invoice_line_items type check constraint to include 'fees'
ALTER TABLE public.invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_type_check;

ALTER TABLE public.invoice_line_items 
  ADD CONSTRAINT invoice_line_items_type_check 
  CHECK (type IN ('service', 'product', 'tax', 'fees', 'adjustment'));
