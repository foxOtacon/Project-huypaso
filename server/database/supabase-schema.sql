-- Supabase/Postgres-compatible schema for Village Products
-- This file is intended for use with the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    phone VARCHAR(20),
    address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    category_id BIGSERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    product_id BIGSERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    category_id BIGINT NOT NULL REFERENCES categories(category_id),
    description TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(50) NOT NULL,
    image_url VARCHAR(255),
    production_source TEXT,
    stock_quantity INT NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart (
    cart_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
    cart_item_id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT NOT NULL REFERENCES cart(cart_id),
    product_id BIGINT NOT NULL REFERENCES products(product_id),
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS orders (
    order_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    order_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending','shipping','completed','cancelled')),
    shipping_name VARCHAR(150),
    shipping_phone VARCHAR(20),
    shipping_address TEXT,
    tracking_number VARCHAR(100),
    shipping_carrier VARCHAR(100),
    tracking_url VARCHAR(255),
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id),
    product_id BIGINT NOT NULL REFERENCES products(product_id),
    quantity INT NOT NULL DEFAULT 1,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id),
    slip_image VARCHAR(255),
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('promptpay','bank_transfer')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','approved','rejected')),
    transaction_ref TEXT,
    payment_date TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS news (
    news_id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    category VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    created_by BIGINT REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_prediction (
    prediction_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(product_id),
    predicted_quantity INT NOT NULL DEFAULT 0,
    predicted_month DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_runs (
    run_id BIGSERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    requested_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    n8n_execution_id VARCHAR(100),
    result_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_product_views (
    view_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    product_id BIGINT NOT NULL REFERENCES products(product_id),
    view_count INT NOT NULL DEFAULT 1,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_prediction_product_month_unique
    ON sales_prediction (product_id, predicted_month);

CREATE INDEX IF NOT EXISTS analysis_runs_created_at_idx
    ON analysis_runs (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS analysis_runs_single_active_idx
    ON analysis_runs ((1))
    WHERE status IN ('queued', 'running');

CREATE OR REPLACE FUNCTION public.get_sales_analysis_data()
RETURNS JSONB
LANGUAGE SQL
SET search_path TO public
AS $function$
  WITH sales_history AS (
    SELECT
      oi.product_id,
      DATE_TRUNC('month', o.order_date)::date AS sales_month,
      SUM(oi.quantity)::int AS quantity_sold,
      SUM(oi.quantity * oi.price)::numeric(12,2) AS revenue,
      COUNT(DISTINCT o.order_id)::int AS order_count,
      COUNT(DISTINCT o.user_id)::int AS customer_count
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE o.order_status <> 'cancelled'
      AND o.order_date >=
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '12 months'
    GROUP BY oi.product_id, DATE_TRUNC('month', o.order_date)
  ),
  product_behavior AS (
    SELECT
      product_id,
      SUM(view_count)::int AS total_views,
      COUNT(DISTINCT user_id)::int AS unique_viewers
    FROM user_product_views
    WHERE viewed_at >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY product_id
  )
  SELECT jsonb_build_object(
    'products',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'product_id', p.product_id,
        'product_name', p.product_name,
        'price', p.price,
        'stock_quantity', p.stock_quantity,
        'unit', p.unit
      ) ORDER BY p.product_id)
      FROM products p
    ), '[]'::jsonb),
    'sales_history',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sales_month, s.product_id)
      FROM sales_history s
    ), '[]'::jsonb),
    'product_behavior',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(b) ORDER BY b.product_id)
      FROM product_behavior b
    ), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.get_sales_analysis_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_analysis_data() TO service_role;

CREATE TABLE IF NOT EXISTS shipping_carriers (
    carrier_id BIGSERIAL PRIMARY KEY,
    carrier_name VARCHAR(120) NOT NULL UNIQUE,
    tracking_url VARCHAR(255),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shipping_carriers (carrier_name, tracking_url, description)
VALUES
  ('ไปรษณีย์ไทย (Thailand Post)', 'https://track.thailandpost.co.th/', 'ขนส่งเจ้าหลักของรัฐที่มีเครือข่ายครอบคลุมพื้นที่มากที่สุดทั่วประเทศ'),
  ('KEX Express (Kerry)', 'https://th.kex-express.com/th/track/', 'ผู้นำด้านการจัดส่งพัสดุด่วน จุดบริการเยอะ และบริการเก็บเงินปลายทาง (COD) ที่รวดเร็ว'),
  ('Flash Express', 'https://www.flashexpress.co.th/tracking/', 'ขนส่งเอกชนที่เติบโตเร็ว ให้บริการรับพัสดุถึงหน้าบ้านฟรีและเปิดทำการทุกวัน'),
  ('J&T Express', 'https://www.jtexpress.co.th/index/query/gzquery.html', 'ขนส่งพัสดุยอดนิยมสำหรับพ่อค้าแม่ค้าออนไลน์ จัดส่งรวดเร็วและครอบคลุมทั่วภูมิภาค'),
  ('Best Express', 'https://www.best-inc.co.th/track', 'ผู้ให้บริการขนส่งที่โดดเด่นด้วยเครือข่ายแฟรนไชส์และราคาที่แข่งขันได้'),
  ('SCG Express', 'https://www.scgexpress.co.th/tracking/', 'เน้นการขนส่งด่วนแบบพรีเมียม และบริการจัดส่งสินค้าควบคุมอุณหภูมิ')
ON CONFLICT (carrier_name) DO UPDATE SET
  tracking_url = EXCLUDED.tracking_url,
  description = EXCLUDED.description,
  status = 'active';
