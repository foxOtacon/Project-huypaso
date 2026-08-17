CREATE DATABASE IF NOT EXISTS village_products;
USE village_products;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    phone VARCHAR(20),
    address TEXT,
    status ENUM('active','suspended') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name TEXT NOT NULL,
    category_id INT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(50) NOT NULL,
    image_url VARCHAR(255),
    production_source TEXT,
    stock_quantity INT NOT NULL DEFAULT 0,
    status ENUM('active','suspended') NOT NULL DEFAULT 'active',
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_category
    FOREIGN KEY (category_id)
    REFERENCES categories(category_id),

    CONSTRAINT fk_products_user
    FOREIGN KEY (created_by)
    REFERENCES users(user_id)
);

CREATE TABLE cart (
    cart_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cart_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
);

CREATE TABLE cart_items (
    cart_item_id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_cartitems_cart
    FOREIGN KEY (cart_id)
    REFERENCES cart(cart_id),
    CONSTRAINT fk_cartitems_product
    FOREIGN KEY (product_id)
    REFERENCES products(product_id)
);

CREATE TABLE orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    order_status ENUM(
        'pending',
        'shipping',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',
    shipping_name VARCHAR(150),
    shipping_phone VARCHAR(20),
    shipping_address TEXT,
    tracking_number VARCHAR(100),
    shipping_carrier VARCHAR(100),
    tracking_url VARCHAR(255),
    order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
);

CREATE TABLE order_items (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_orderitems_order
    FOREIGN KEY (order_id)
    REFERENCES orders(order_id),
    CONSTRAINT fk_orderitems_product
    FOREIGN KEY (product_id)
    REFERENCES products(product_id)
);

CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    slip_image VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_method ENUM(
        'promptpay',
        'bank_transfer'
    ) NOT NULL,
    payment_status ENUM(
        'pending',
        'approved',
        'rejected'
    ) NOT NULL DEFAULT 'pending',
    transaction_ref TEXT,
    payment_date DATETIME NULL,
    CONSTRAINT fk_payments_order
    FOREIGN KEY (order_id)
    REFERENCES orders(order_id)
);

CREATE TABLE news (
    news_id INT AUTO_INCREMENT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    category VARCHAR(100),
    status ENUM('draft','published') NOT NULL DEFAULT 'draft',
    created_by INT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_news_user
    FOREIGN KEY (created_by)
    REFERENCES users(user_id)
);

CREATE TABLE sales_prediction (
    prediction_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    predicted_quantity INT NOT NULL DEFAULT 0,
    predicted_month DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prediction_product
    FOREIGN KEY (product_id)
    REFERENCES products(product_id)
);

CREATE TABLE user_product_views (
    view_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    view_count INT NOT NULL DEFAULT 1,
    viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_views_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id),
    CONSTRAINT fk_views_product
    FOREIGN KEY (product_id)
    REFERENCES products(product_id),
    INDEX user_product_views_user_recent_idx (user_id, viewed_at),
    INDEX user_product_views_product_recent_idx (product_id, viewed_at)
);

CREATE TABLE IF NOT EXISTS shipping_carriers (
    carrier_id INT AUTO_INCREMENT PRIMARY KEY,
    carrier_name VARCHAR(120) NOT NULL UNIQUE,
    tracking_url VARCHAR(255),
    description TEXT,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
