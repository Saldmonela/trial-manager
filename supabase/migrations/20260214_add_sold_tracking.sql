-- Add sold tracking columns to families table for Ready Account purchases
ALTER TABLE public.families 
ADD COLUMN sold_to_name TEXT,
ADD COLUMN sold_to_email TEXT,
ADD COLUMN sold_at TIMESTAMPTZ;
