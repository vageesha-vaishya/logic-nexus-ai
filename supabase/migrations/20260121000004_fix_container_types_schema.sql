-- Migration: Fix Container Types Schema
-- Description: Adds missing 'description' column to container_types if it doesn't exist (legacy schema support)
-- Author: Trae AI
-- Date: 2026-01-21

BEGIN;

DO $$
BEGIN
    ALTER TABLE public.container_types ADD COLUMN IF NOT EXISTS description TEXT;
END $$;

COMMIT;
