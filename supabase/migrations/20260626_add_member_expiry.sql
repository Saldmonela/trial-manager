-- Migration: Add member_type and expiry_date columns to members table
-- Description: Enables distinguishing between personal and customer/buyer accounts, and tracking expiry dates for buyers.

ALTER TABLE members ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'pembeli' CHECK (member_type IN ('pribadi', 'pembeli'));
ALTER TABLE members ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
