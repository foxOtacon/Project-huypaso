-- Central website gallery for village atmosphere and other public images.
CREATE TABLE IF NOT EXISTS site_gallery (
    gallery_id BIGSERIAL PRIMARY KEY,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS site_gallery_order_idx ON site_gallery(sort_order, gallery_id);
