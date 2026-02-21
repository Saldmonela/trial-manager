-- Migration: Add pricing columns to families table

ALTER TABLE families 
ADD COLUMN IF NOT EXISTS price_monthly numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_annual numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'IDR';

-- Comment on columns
COMMENT ON COLUMN families.price_monthly IS 'Price for 1 slot per month';
COMMENT ON COLUMN families.price_annual IS 'Price for 1 slot per year';
