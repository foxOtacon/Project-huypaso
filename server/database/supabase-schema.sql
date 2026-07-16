-- Supabase/Postgres-compatible schema for Village Products
-- This file is intended for use with the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    phone VARCHAR(20),
    address VARCHAR(200),
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
    product_name VARCHAR(200) NOT NULL,
    category_id BIGINT NOT NULL REFERENCES categories(category_id),
    description TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(50) NOT NULL,
    image_url VARCHAR(255),
    planting_date DATE,
    harvest_date DATE,
    production_source VARCHAR(200),
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
    transaction_ref VARCHAR(200),
    payment_date TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS news (
    news_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
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

CREATE TABLE IF NOT EXISTS user_product_views (
    view_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    product_id BIGINT NOT NULL REFERENCES products(product_id),
    view_count INT NOT NULL DEFAULT 1,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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