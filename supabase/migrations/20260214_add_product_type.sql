-- Add product_type column to families table
ALTER TABLE public.families 
ADD COLUMN product_type text DEFAULT 'slot' CHECK (product_type IN ('slot', 'account_ready', 'account_custom'));
