import { useState } from 'react';
import './ProductDetailModal.css';

const FALLBACK_HIGHLIGHTS = [
  { icon: '', title: 'คัดสรรจากธรรมชาติ' },
  { icon: '', title: 'พิถีพิถันทุกขั้นตอน' },
  { icon: '', title: 'ชงง่ายในทุกวัน' },
  { icon: '', title: 'กลิ่นและรสชาติเป็นเอกลักษณ์' },
];

const FALLBACK_BENEFITS = [
  'ช่วยให้รู้สึกผ่อนคลาย',
  'ให้ความอบอุ่นแก่ร่างกาย',
  'มีกลิ่นหอมจากธรรมชาติ',
  'เหมาะสำหรับดื่มในชีวิตประจำวัน',
];

function parseList(value, fallback) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length) return lines;
    }
  }
  return fallback;
}

function parseStructuredValue(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

const DETAIL_LABELS = {
  source: 'แหล่งผลิต',
  storage: 'การเก็บรักษา',
  type: 'ประเภทสินค้า',
  note: 'หมายเหตุ',
};

function StructuredContent({ value, fallback }) {
  const structuredValue = parseStructuredValue(value);
  if (!structuredValue) return <p className="catalog-detail-preserve-lines">{value || fallback}</p>;

  if (Array.isArray(structuredValue)) {
    return (
      <ol className="catalog-detail-steps">
        {structuredValue.map((step, index) => {
          const description = typeof step === 'string' ? step : step.description || step.detail || '';
          const stepNumber = typeof step === 'object' && step.step ? step.step : index + 1;
          return <li key={`${stepNumber}-${description}`}><span>{stepNumber}</span><p>{description}</p></li>;
        })}
      </ol>
    );
  }

  return (
    <dl className="catalog-detail-structured-list">
      {Object.entries(structuredValue).map(([key, entry]) => (
        <div key={key}>
          <dt>{DETAIL_LABELS[key] || key}</dt>
          <dd>{String(entry)}</dd>
        </div>
      ))}
    </dl>
  );
}

function getStory(product) {
  return product.product_story || `จากชุมชนบนพื้นที่สูง สู่ผลิตภัณฑ์ที่เต็มไปด้วยความตั้งใจ ${product.product_name || 'ของเรา'} คัดสรรวัตถุดิบอย่างใส่ใจและผ่านกระบวนการอย่างพิถีพิถัน เพื่อส่งต่อรสชาติและเรื่องราวของชุมชนในทุกครั้งที่ได้สัมผัส`;
}

function normalizeHighlight(highlight) {
  if (typeof highlight === 'string') return { title: highlight };
  return { title: highlight.title || '' };
}

export default function ProductDetailModal({
  product,
  categoryName,
  imageUrl,
  onClose,
  onAddToCart,
  added = false,
}) {
  const [quantity, setQuantity] = useState(1);
  const [openPanel, setOpenPanel] = useState('');
  const stock = Number(product.stock_quantity || 0);
  const highlights = parseList(product.product_highlights, FALLBACK_HIGHLIGHTS).map(normalizeHighlight).filter(({ title }) => title);
  const benefits = parseList(product.product_benefits, FALLBACK_BENEFITS);
  const usage = product.product_usage || 'ชงด้วยน้ำร้อนตามปริมาณที่เหมาะสม แล้วค่อย ๆ ดื่มเพื่อสัมผัสกลิ่นหอมและรสชาติที่เป็นเอกลักษณ์';
  const details = product.product_details || [
    product.production_source ? `แหล่งผลิต: ${product.production_source}` : '',
    `หน่วยจำหน่าย: ${product.unit || 'หน่วย'}`,
  ].filter(Boolean).join('\n');

  function togglePanel(panel) {
    setOpenPanel((current) => (current === panel ? '' : panel));
  }

  return (
    <div className="catalog-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="catalog-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="catalog-modal-close" aria-label="ปิดรายละเอียดสินค้า" onClick={onClose}>×</button>
        <div className="catalog-detail-media">
          <img src={imageUrl} alt={product.product_name} loading="lazy" decoding="async" />
          <span className="catalog-media-caption">ผลผลิตจากชุมชนห้วยหยวกป่าโซ</span>
        </div>

        <div className="catalog-detail-content">
          <div className="catalog-card-meta">
            <span>{categoryName || 'สินค้าเกษตร'}</span>
            <span>{stock > 0 ? 'พร้อมส่ง' : 'หมดสต็อก'}</span>
          </div>
          <h2 id="catalog-detail-title">{product.product_name}</h2>
          <p className="catalog-product-hook">{product.product_hook || 'จากธรรมชาติ สู่ช่วงเวลาแห่งความผ่อนคลาย'}</p>
          <p className="catalog-product-description">{product.description || 'ผลิตภัณฑ์คุณภาพจากชุมชนห้วยหยวกป่าโซ'}</p>

          <div className="catalog-product-story-intro">
            <span aria-hidden="true">🌿</span>
            <div><strong>เรื่องราวของสินค้า</strong><p>{getStory(product)}</p></div>
          </div>

          <div className="catalog-product-highlights" aria-label="จุดเด่นสินค้า">
            {highlights.slice(0, 4).map((highlight) => (
              <article key={highlight.title}>
                <strong>{highlight.title}</strong>
              </article>
            ))}
          </div>

          <div className="catalog-product-accordions">
            <Accordion title="จุดเด่นและคุณประโยชน์" panel="benefits" openPanel={openPanel} onToggle={togglePanel}>
              <ul>{benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
            </Accordion>
            <Accordion title="วิธีใช้ / วิธีชง" panel="usage" openPanel={openPanel} onToggle={togglePanel}>
              <StructuredContent value={usage} fallback="ชงด้วยน้ำร้อนตามปริมาณที่เหมาะสม แล้วค่อย ๆ ดื่มเพื่อสัมผัสกลิ่นหอมและรสชาติที่เป็นเอกลักษณ์" />
            </Accordion>
            <Accordion title="รายละเอียดสินค้าเพิ่มเติม" panel="details" openPanel={openPanel} onToggle={togglePanel}>
              <StructuredContent value={details} fallback="สินค้าคุณภาพจากชุมชน คัดสรรและจัดเตรียมอย่างใส่ใจ" />
            </Accordion>
          </div>

          <div className="catalog-detail-stats">
            <span><strong>{product.price ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(Number(product.price)) : '-'}</strong><small>/{product.unit || 'หน่วย'}</small></span>
            <span><strong>{stock}</strong><small>คงเหลือ</small></span>
          </div>

          {stock > 0 ? (
            <div className="catalog-detail-quantity">
              <span>จำนวน</span>
              <div>
                <button type="button" aria-label="ลดจำนวน" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
                <input type="number" min="1" max={stock} value={quantity} aria-label="จำนวนสินค้า" onChange={(event) => setQuantity(Math.min(stock, Math.max(1, Number(event.target.value) || 1)))} />
                <button type="button" aria-label="เพิ่มจำนวน" disabled={quantity >= stock} onClick={() => setQuantity((value) => Math.min(stock, value + 1))}>+</button>
              </div>
            </div>
          ) : null}

          <button type="button" className="catalog-detail-cart" disabled={stock <= 0} onClick={() => onAddToCart(product, quantity)}>
            {stock <= 0 ? 'หมดสต็อก' : added ? 'เพิ่มแล้ว' : '🛒 ใส่ตะกร้า'}
          </button>
        </div>
      </section>
    </div>
  );
}

function Accordion({ title, panel, openPanel, onToggle, children }) {
  const isOpen = openPanel === panel;
  return (
    <div className={`catalog-accordion${isOpen ? ' is-open' : ''}`}>
      <button type="button" aria-expanded={isOpen} onClick={() => onToggle(panel)}>
        <span>{title}</span><span className="catalog-accordion-arrow" aria-hidden="true">⌄</span>
      </button>
      <div className="catalog-accordion-content" aria-hidden={!isOpen}><div>{children}</div></div>
    </div>
  );
}
