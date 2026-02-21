-- Add billing_cycle column to join_requests table
ALTER TABLE public.join_requests 
ADD COLUMN billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual'));
