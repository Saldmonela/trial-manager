-- Make family_id nullable for standalone upgrade orders (not tied to any family)
ALTER TABLE public.join_requests 
ALTER COLUMN family_id DROP NOT NULL;

-- Add product_type to join_requests so we know the order type
ALTER TABLE public.join_requests
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'slot';
