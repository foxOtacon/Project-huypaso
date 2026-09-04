-- Add optional village coordinates without changing existing site content.
ALTER TABLE public.site_content
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);