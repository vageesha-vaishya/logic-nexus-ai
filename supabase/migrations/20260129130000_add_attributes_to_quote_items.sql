-- Migration: 20260129130000_add_attributes_to_quote_items.sql
-- Description: Superseded by 20260129143000_fix_quote_items_routing.sql
-- This file is intentionally left empty/no-op to prevent errors with missing public.quote_items_extension

DO $$
BEGIN
    RAISE NOTICE 'Skipping 20260129130000 as it is superseded by 20260129143000';
END $$;
