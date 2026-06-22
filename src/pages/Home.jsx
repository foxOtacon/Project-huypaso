import { useEffect, useRef, useState } from 'react';
import './Home.css';

const products = [
  {
    name: 'เมล็ดกาแฟอาราบิก้า',
    type: 'สินค้าเกษตร',
    description: 'เมล็ดกาแฟคั่วระดับกลาง กลิ่นหอมละมุน ส่งตรงจากไร่บนพื้นที่สูง',
    price: '฿250',
    unit: '/ถุง (500g)',
    image:
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'ข้าวโพดหวาน',
    type: 'สินค้าเกษตร',
    description: 'ปลูกแบบปลอดภัย หวาน กรอบ เหมาะสำหรับอาหารครอบครัว',
    price: '฿80',
    unit: '/กล่อง (4-5 ฝัก)',
    image:
      'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'ใบชาเขียว',
    type: 'สินค้าเกษตร',
    description: 'ใบชาอ่อนคัดพิเศษ กลิ่นสดชื่น เหมาะสำหรับชงดื่มและแปรรูป',
    price: '฿200',
    unit: '/ชุด (100g)',
    image:
      'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=80',
  },
];

const services = [
  {
    title: 'การเกษตรอินทรีย์',
    description: 'ส่งเสริมการปลูกโดยไม่ใช้สารเคมี สร้างผลผลิตที่ปลอดภัยและยั่งยืน',
    icon: 'book',
    link: 'เรียนรู้เพิ่มเติม',
  },
  {
    title: 'ชุมชนเกษตรกร',
    description: 'สร้างเครือข่ายเกษตรกรในพื้นที่ห้วยยาวปากโจ้ พัฒนาทักษะและแบ่งปันความรู้',
    icon: 'people',
    link: 'ติดต่อเรา',
  },
  {
    title: 'ตลาดสินค้าชุมชน',
    description: 'จัดจำหน่ายผลิตภัณฑ์เกษตรคุณภาพ ส่งตรงจากผู้ผลิตถึงผู้บริโภค',
    icon: 'basket',
    link: 'ซื้อเลย',
  },
];

const news = [
  {
    date: '15 มกราคม 2026',
    title: 'เก็บเกี่ยวผลผลิตฤดูใหม่',
    description: 'ชมภาพบรรยากาศการเก็บเกี่ยวผลิตภัณฑ์สดใหม่จากไร่คุณภาพสูง',
    image:
      'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
  },
  {
    date: '10 มกราคม 2026',
    title: 'อบรมการปลูกกาแฟอินทรีย์',
    description: 'อบรมเกษตรกรปลูกกาแฟที่เป็นมิตรกับสิ่งแวดล้อมให้กับเกษตรกร',
    image:
      'https://images.unsplash.com/photo-1615484477778-ca3b77940c25?auto=format&fit=crop&w=900&q=80',
  },
  {
    date: '5 มกราคม 2026',
    title: 'ตลาดสินค้าชุมชนประจำเดือน',
    description: 'มาร่วมเลือกซื้อผลิตภัณฑ์สดใหม่จากเกษตรกรในชุมชน',
    image:
      'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=900&q=80',
  },
];

function Icon({ name }) {
  if (name === 'people') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 11a3 3 0 1 0-2.83-4H10.8A3 3 0 1 0 8 11h8Z" />
        <path d="M4 19a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1H4v-1Z" />
      </svg>
    );
  }

  if (name === 'basket') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 9h10l-1.2 9.2A2 2 0 0 1 13.8 20H10a2 2 0 0 1-2-1.8L7 9Z" />
        <path d="M9 9 12 4l3 5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5v-16Z" />
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 8H19" />
    </svg>
  );
}

function ProfileMenuIcon({ name }) {
  if (name === 'card') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
        <path d="M4 9h16M7 15h4" />
      </svg>
    );
  }

  if (name === 'box') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.5 8 7.5 4 7.5-4M12 12v8.5" />
      </svg>
    );
  }

  if (name === 'receipt') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h10v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3V3Z" />
        <path d="M9.5 8h5M9.5 12h5M9.5 16h3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.5 8.5 19 12l-3.5 3.5M19 12H9" />
      <path d="M12 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H12" />
    </svg>
  );
}

export default function Home({ user, onNavigate, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const animatedItems = document.querySelectorAll('.reveal-on-scroll');

    if (!animatedItems.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );

    animatedItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!profileOpen) return undefined;

    function handlePointerDown(event) {
      if (!profileRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const profileInitial = user?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const profileMenuItems = [
    { label: 'ข้อมูลส่วนตัว', path: '/profile', icon: 'profile' },
    { label: 'หน้าชำระเงิน', path: '/payment', icon: 'card' },
    { label: 'สถานะคำสั่งซื้อ', path: '/order-status', icon: 'box' },
    { label: 'สถานะชำระเงิน', path: '/payment-status', icon: 'receipt' },
  ];

  function goToProfilePage(path) {
    setProfileOpen(false);
    onNavigate(path);
  }

  return (
    <div className="home-page">
      <header className="site-header">
        <div className="site-shell nav-shell">
          <button type="button" className="brand-link" onClick={() => scrollTo('top')}>
            ห้วยหยวกปากโจ้
          </button>

          <nav className="main-nav" aria-label="เมนูหลัก">
            <button type="button" onClick={() => scrollTo('top')}>หน้าหลัก</button>
            <button type="button" onClick={() => scrollTo('products')}>สินค้า</button>
            <button type="button" onClick={() => scrollTo('work')}>ความรู้</button>
            <button type="button" onClick={() => scrollTo('news')}>ข่าว</button>
            <button type="button" onClick={() => scrollTo('contact')}>ติดต่อ</button>
          </nav>

          <div className="account-actions">
            {user ? (
              <div className="profile-menu" ref={profileRef}>
                <button
                  type="button"
                  className="profile-trigger"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <span className="profile-avatar" aria-hidden="true">
                    {profileInitial}
                  </span>
                  <span className="profile-name">{user.full_name}</span>
                  <svg className="profile-chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m7 10 5 5 5-5" />
                  </svg>
                </button>

                {profileOpen && (
                  <div className="profile-dropdown" role="menu">
                    <div className="profile-dropdown-head">
                      <span className="profile-avatar profile-avatar-large" aria-hidden="true">
                        {profileInitial}
                      </span>
                      <div>
                        <p>สวัสดี</p>
                        <strong>{user.full_name}</strong>
                      </div>
                    </div>

                    <div className="profile-dropdown-list">
                      {profileMenuItems.map((item) => (
                        <button
                          type="button"
                          role="menuitem"
                          key={item.path}
                          onClick={() => goToProfilePage(item.path)}
                        >
                          <ProfileMenuIcon name={item.icon} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="profile-logout"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        onLogout();
                      }}
                    >
                      <ProfileMenuIcon name="logout" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button type="button" className="login-button" onClick={() => onNavigate('/login')}>
                  เข้าสู่ระบบ
                </button>
                <button
                  type="button"
                  className="signup-button"
                  onClick={() => onNavigate('/register')}
                >
                  สมัครสมาชิก
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero-section" aria-label="หน้าหลัก">
          <div className="hero-overlay" />
          <div className="site-shell hero-content">
            <h1>ห้วยหยวกปากโจ้</h1>
            <p className="hero-tagline">ทำด้วยกัน ทำด้วยใจ</p>
            <p className="hero-copy">
              แหล่งรวมผลิตภัณฑ์คุณภาพจากเกษตรกรชุมชน สดใหม่ ปลอดสารพิษ
              ส่งตรงจากไร่ถึงมือคุณ
            </p>
            <div className="hero-actions">
              <button type="button" className="hero-primary" onClick={() => scrollTo('products')}>
                เลือกซื้อสินค้า
              </button>
              <button type="button" className="hero-secondary" onClick={() => scrollTo('work')}>
                เรียนรู้การปลูก
              </button>
            </div>
          </div>
          <button type="button" className="scroll-cue" onClick={() => scrollTo('products')} aria-label="เลื่อนไปยังสินค้า">
            ↓
          </button>
        </section>

        <section id="products" className="section products-section">
          <div className="site-shell">
            <div className="section-heading reveal-on-scroll">
              <h2>สินค้าแนะนำ</h2>
              <p>
                สินค้าคุณภาพสูงจากทีมเกษตรกรห้วยหยวกปากโจ้ อันหลากหลายทั้งสด
                ปลอดสารเคมี สดใหม่ที่สุด เลือกซื้อเพื่อสนับสนุนชุมชนเกษตรกร
              </p>
            </div>

            <div className="product-grid">
              {products.map((product) => (
                <article className="product-card reveal-on-scroll" key={product.name}>
                  <img src={product.image} alt={product.name} />
                  <div className="product-body">
                    <p className="product-type">{product.type}</p>
                    <h3>{product.name}</h3>
                    <p className="product-description">{product.description}</p>
                    <div className="product-footer">
                      <div>
                        <strong>{product.price}</strong>
                        <span>{product.unit}</span>
                      </div>
                      <button type="button">ใส่ตะกร้า</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="work" className="section work-section">
          <div className="site-shell">
            <div className="section-heading reveal-on-scroll">
              <h2>สิ่งที่เราทำ</h2>
              <p>
                เรามุ่งมั่นส่งเสริมการเกษตรชุมชน สร้างรายได้
                และพัฒนาคุณภาพชีวิตผ่านการผลิตสินค้าอินทรีย์คุณภาพสูง
              </p>
            </div>

            <div className="work-grid">
              {services.map((service) => (
                <article className="work-card reveal-on-scroll" key={service.title}>
                  <div className="work-icon">
                    <Icon name={service.icon} />
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <button type="button">{service.link} →</button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="news" className="section news-section">
          <div className="site-shell">
            <div className="section-heading reveal-on-scroll">
              <h2>ข่าวและกิจกรรม</h2>
              <p>อัปเดตข่าวสารและกิจกรรมล่าสุดจากชุมชนห้วยหยวกปากโจ้</p>
            </div>

            <div className="news-grid">
              {news.map((item) => (
                <article className="news-card reveal-on-scroll" key={item.title}>
                  <img src={item.image} alt={item.title} />
                  <div className="news-body">
                    <time>{item.date}</time>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <button type="button">อ่านต่อ →</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="site-footer">
        <p>© 2026 ห้วยหยวกปากโจ้. All rights reserved.</p>
      </footer>
    </div>
  );
}
