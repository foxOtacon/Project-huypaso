import { useEffect, useState } from 'react';

export const HERO_SLIDES = [
  { src: '/images/huypaso-forest-banner.png', position: 'center 48%', label: 'ทิวทัศน์ป่าบนพื้นที่สูง' },
  { src: '/images/huypaso-village-banner.png', position: 'center 58%', label: 'ทิวทัศน์ชุมชนห้วยหยวกปากโซ' },
];

export default function HomeHeroBanner({ onNavigate, onCommunity, onScrollNext, ariaLabel = 'แบนเนอร์ชุมชน' }) {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const intervalId = window.setInterval(() => setSlideIndex((current) => (current + 1) % HERO_SLIDES.length), 6000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className="hero-section" aria-label={ariaLabel}>
      <div className="hero-backgrounds" aria-hidden="true">
        {HERO_SLIDES.map((slide, index) => (
          <div key={slide.src} className={`hero-background-slide ${index === slideIndex ? 'is-active' : ''}`} style={{ backgroundImage: `url(${slide.src})`, backgroundPosition: slide.position }} />
        ))}
      </div>
      <div className="hero-overlay" />
      <div className="site-shell hero-content">
        <span className="hero-kicker">ผลิตภัณฑ์จากพื้นที่สูงเชียงราย</span>
        <h1>ห้วยหยวกปากโซ</h1>
        <p className="hero-tagline">ทำด้วยกัน ทำด้วยใจ</p>
        <p className="hero-copy">แหล่งรวมผลิตภัณฑ์คุณภาพจากเกษตรกรชุมชน สดใหม่ ปลอดสารพิษ ส่งตรงจากไร่ถึงมือคุณ</p>
        <div className="hero-actions">
          <button type="button" className="hero-primary" onClick={() => onNavigate('/products')}>เลือกซื้อสินค้า</button>
          <button type="button" className="hero-secondary" onClick={onCommunity}>รู้จักชุมชนของเรา</button>
        </div>
        <div className="hero-proof" aria-label="จุดเด่นของผลิตภัณฑ์">
          <span>ปลูกบนพื้นที่สูง</span><span>สดใหม่จากชุมชน</span><span>สนับสนุนเกษตรกร</span>
        </div>
      </div>
      {onScrollNext ? <button type="button" className="scroll-cue" onClick={onScrollNext} aria-label="เลื่อนไปยังเนื้อหา">↓</button> : null}
      <div className="hero-slide-dots" aria-label="เลือกภาพแบนเนอร์">
        {HERO_SLIDES.map((slide, index) => (
          <button key={slide.src} type="button" className={index === slideIndex ? 'is-active' : ''} onClick={() => setSlideIndex(index)} aria-label={slide.label} aria-current={index === slideIndex ? 'true' : undefined} />
        ))}
      </div>
    </section>
  );
}
