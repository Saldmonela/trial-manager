-- Migration: Add storage_used column to members table
-- Description: Enables tracking storage space on a per-member basis.

ALTER TABLE members ADD COLUMN IF NOT EXISTS storage_used NUMERIC DEFAULT 0;
