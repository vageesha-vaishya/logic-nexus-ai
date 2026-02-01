-- Migration: Add FATAL to log_level enum
-- Date: 2026-02-01

-- Add 'FATAL' to the enum if it doesn't exist
ALTER TYPE public.log_level ADD VALUE IF NOT EXISTS 'FATAL' AFTER 'CRITICAL';
