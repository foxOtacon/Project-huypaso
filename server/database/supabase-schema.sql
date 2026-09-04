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

CREATE TABLE IF NOT EXISTS user_addresses (
  address_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  label VARCHAR(80) NOT NULL,
  recipient_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS user_addresses_default_idx ON user_addresses(user_id, is_default);

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
    product_hook TEXT,
    product_story TEXT,
    product_highlights TEXT,
    product_benefits TEXT,
    product_usage TEXT,
    product_details TEXT,
    stock_quantity INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_by BIGINT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_gallery (
  gallery_id BIGSERIAL PRIMARY KEY,
  image_url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS site_gallery_order_idx ON site_gallery(sort_order, gallery_id);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'suspended'));

UPDATE products
SET status = 'active'
WHERE status IS NULL OR status NOT IN ('active', 'suspended');

ALTER TABLE products ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE products ALTER COLUMN status SET NOT NULL;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products
ADD CONSTRAINT products_status_check CHECK (status IN ('active', 'suspended'));

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

CREATE TABLE IF NOT EXISTS payment_settings (
    payment_setting_id SMALLINT PRIMARY KEY DEFAULT 1
        CHECK (payment_setting_id = 1),
    promptpay_number VARCHAR(30),
    account_name VARCHAR(150),
    qr_image_url VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL
);

ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(150);

CREATE TABLE IF NOT EXISTS bank_transfer_accounts (
    bank_transfer_account_id BIGSERIAL PRIMARY KEY,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL UNIQUE,
    account_name VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent migration for editable public site content.
-- Run this file in the Supabase SQL editor for an existing database.

CREATE TABLE IF NOT EXISTS site_content (
    content_key VARCHAR(80) PRIMARY KEY,
    content_html TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL
);

INSERT INTO site_content (content_key, content_html)
VALUES (
    'history',
    $history$
<p>บ้านห้วยหยวกป่าโซ ตั้งอยู่หมู่ที่ 9 ตำบลแม่สลองใน อำเภอแม่ฟ้าหลวง จังหวัดเชียงราย ก่อตั้งขึ้นเมื่อปี พ.ศ. 2512 โดยนายป่าโซ มาเยอะ ได้นำประชาชนจากหลายพื้นที่เข้ามาตั้งถิ่นฐานร่วมกัน ได้แก่ บ้านพญาไพร บ้านโป่งไฮ บ้านนาโต่ และบ้านเล่าลิ่ว</p>
<ul>
  <li>ในช่วงแรก ชุมชนตั้งอยู่บนสันเขาใกล้ชายแดนไทย–เมียนมา แต่ด้วยพื้นที่ห่างไกลจากแหล่งน้ำและจำนวนประชากรเพิ่มขึ้น ทำให้การอุปโภคบริโภคและการทำเกษตรประสบปัญหากับความไม่เพียงพอ จึงมีการย้ายถิ่นฐานไปทางทิศตะวันออกประมาณ 6 กิโลเมตร และก่อตั้งหมู่บ้านในพื้นที่ปัจจุบันเมื่อปี พ.ศ. 2519</li>
  <li>หมู่บ้านตั้งอยู่บนพื้นที่ภูเขาสูงประมาณ 1,200–1,500 เมตรจากระดับน้ำทะเล มีภูมิประเทศที่ซับซ้อนและลาดชัน ประชากรประกอบด้วยกลุ่มชาติพันธุ์อาข่า ลาหู่ และจีนฮ่อ ซึ่งมีภาษา ศาสนา ประเพณี และวัฒนธรรมที่แตกต่างกัน แต่สามารถอยู่ร่วมกันได้อย่างกลมกลืน จึงเป็นชุมชนที่มีความหลากหลายทางวัฒนธรรมและเอกลักษณ์เฉพาะตัว</li>
  <li>อาชีพดั้งเดิมของชาวบ้านคือการทำนาขั้นบันได เลี้ยงสัตว์ และปลูกพืชเพื่อบริโภค ต่อมาได้เริ่มปลูกชาและกาแฟอาราบิกาเป็นพืชเศรษฐกิจ เนื่องจากสภาพอากาศเย็นและพื้นที่สูงเหมาะสมต่อการเพาะปลูก จนกลายเป็นผลิตภัณฑ์สำคัญที่ช่วยเสริมรายได้ให้กับครัวเรือนในชุมชน</li>
  <li>เมื่อวันที่ 14 มกราคม พ.ศ. 2546 สมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถพระบรมราชชนนีพันปีหลวง เสด็จทอดพระเนตรพื้นที่ป่าและลุ่มน้ำแม่คำ ซึ่งขณะนั้นประสบปัญหาป่าเสื่อมโทรม จึงทรงมีพระราชดำริให้จัดตั้งสถานีพัฒนาการเกษตรที่สูงตามพระราชดำริ บ้านห้วยหยวกป่าโซ เพื่อส่งเสริมการใช้ที่ดินอย่างเหมาะสม พัฒนาการเกษตรแบบครบวงจร ลดการใช้สารเคมี และฟื้นฟูทรัพยากรป่าไม้และแหล่งต้นน้ำ</li>
</ul>
<p>ปัจจุบันบ้านห้วยหยวกป่าโซเป็นชุมชนบนพื้นที่สูงที่โดดเด่นด้วยความหลากหลายทางชาติพันธุ์ วิถีชีวิต วัฒนธรรม และภูมิปัญญาท้องถิ่น ชาวบ้านยังคงประกอบอาชีพเกษตรกรรมควบคู่กับการอนุรักษ์ธรรมชาติ โดยเฉพาะการปลูกชาและกาแฟอาราบิกา ซึ่งได้รับการพัฒนาเป็นผลิตภัณฑ์ของชุมชนและเป็นแหล่งรายได้สำคัญที่ช่วยยกระดับคุณภาพชีวิตของประชาชนในหมู่บ้าน</p>
$history$
)
ON CONFLICT (content_key) DO NOTHING;

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

CREATE INDEX IF NOT EXISTS user_product_views_user_recent_idx
    ON user_product_views (user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS user_product_views_product_recent_idx
    ON user_product_views (product_id, viewed_at DESC);

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

-- Password reset links store only a one-way hash of the emailed token.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    reset_token_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active ON password_reset_tokens(token_hash, expires_at) WHERE used_at IS NULL;

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

-- Support tickets and two-way contact replies.
CREATE TABLE IF NOT EXISTS contacts (
    contact_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'general',
    order_id BIGINT REFERENCES orders(order_id) ON DELETE SET NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    ticket_status VARCHAR(30) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reply_at TIMESTAMPTZ
);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'general';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(order_id) ON DELETE SET NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ticket_status VARCHAR(30) NOT NULL DEFAULT 'new';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS contact_replies (
    reply_id BIGSERIAL PRIMARY KEY,
    contact_id BIGINT NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE,
    sender_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    sender_role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_ticket_status ON contacts(ticket_status);
CREATE INDEX IF NOT EXISTS idx_contact_replies_contact_id ON contact_replies(contact_id);
