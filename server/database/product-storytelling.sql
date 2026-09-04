ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_hook TEXT,
  ADD COLUMN IF NOT EXISTS product_story TEXT,
  ADD COLUMN IF NOT EXISTS product_highlights TEXT,
  ADD COLUMN IF NOT EXISTS product_benefits TEXT,
  ADD COLUMN IF NOT EXISTS product_usage TEXT,
  ADD COLUMN IF NOT EXISTS product_details TEXT;