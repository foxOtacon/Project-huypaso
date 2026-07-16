import { useEffect, useRef, useState } from 'react';
import BrandLogo from '../components/BrandLogo';
import { fetchCatalogCategories, fetchCatalogProducts } from '../api/catalog';
import { useCart } from '../context/CartContext';
import { isCustomerUser } from '../utils/roles';
import './Home.css';

const FEATURED_KEYWORDS = ['ชา', 'กาแฟ', 'tea', 'coffee'];
const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80';

function formatProductPrice(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getProductImage(product) {
  const imageUrl = product.image_url?.trim();
  if (!imageUrl) return FALLBACK_PRODUCT_IMAGE;
  return imageUrl.startsWith('http') || imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
}

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
    image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
  },
  {
    date: '10 มกราคม 2026',
    title: 'อบรมการปลูกกาแฟอินทรีย์',
    description: 'อบรมเกษตรกรปลูกกาแฟที่เป็นมิตรกับสิ่งแวดล้อมให้กับเกษตรกร',
    image: 'https://images.unsplash.com/photo-1615484477778-ca3b77940c25?auto=format&fit=crop&w=900&q=80',
  },
  {
    date: '5 มกราคม 2026',
    title: 'ตลาดสินค้าชุมชนประจำเดือน',
    description: 'มาร่วมเลือกซื้อผลิตภัณฑ์สดใหม่จากเกษตรกรในชุมชน',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=900&q=80',
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



export default function Home({ user, onNavigate, onLogout }) {
  const { addItem, itemCount } = useCart();
  const [profileOpen, setProfileOpen] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredCategories, setFeaturedCategories] = useState({});
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState('');
  const [addedProductId, setAddedProductId] = useState(null);
  const profileRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadFeaturedProducts() {
      try {
        const [products, categories] = await Promise.all([
          fetchCatalogProducts(),
          fetchCatalogCategories(),
        ]);
        if (!active) return;

        const categoryMap = Object.fromEntries(
          categories.map((category) => [String(category.category_id), category.category_name]),
        );
        const featured = products.filter((product) => {
          const searchableText = [
            product.product_name,
            product.description,
            categoryMap[String(product.category_id)],
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return FEATURED_KEYWORDS.some((keyword) => searchableText.includes(keyword));
        });

        setFeaturedCategories(categoryMap);
        setFeaturedProducts(featured);
      } catch (error) {
        if (active) setFeaturedError(error.message || 'ไม่สามารถโหลดสินค้าแนะนำได้');
      } finally {
        if (active) setFeaturedLoading(false);
      }
    }

    loadFeaturedProducts();
    return () => {
      active = false;
    };
  }, []);

  function handleFeaturedAddToCart(product) {
    if (!isCustomerUser(user)) {
      onNavigate('/login');
      return;
    }

    addItem(product, 1);
    setAddedProductId(product.product_id);
    window.setTimeout(() => setAddedProductId(null), 1300);
  }

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
    if (id === 'news') {
      onNavigate('/news');
      return;
    }

    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const profileInitial = user?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const isCustomer = isCustomerUser(user);
  const profileMenuItems = [
    { label: 'การสั่งซื้อของฉัน', path: '/order-status', icon: 'box' },
    { label: 'บัญชีของฉัน', path: '/profile', icon: 'profile' },
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
            <BrandLogo />
            ห้วยหยวกปากโซ
          </button>

          <nav className="main-nav" aria-label="เมนูหลัก">
            <button type="button" onClick={() => scrollTo('top')}>หน้าหลัก</button>
            <button type="button" onClick={() => onNavigate('/products')}>สินค้า</button>
            <button type="button" onClick={() => onNavigate('/knowledge')}>ความรู้</button>
            <button type="button" onClick={() => scrollTo('news')}>ข่าว</button>
            <button type="button" onClick={() => scrollTo('contact')}>ติดต่อ</button>
          </nav>

          <div className="account-actions">
            {isCustomer && (
              <button type="button" className="home-cart-button" onClick={() => onNavigate('/cart')}>
                ตะกร้า
                <span>{itemCount}</span>
              </button>
            )}

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
                <button type="button" className="signup-button" onClick={() => onNavigate('/register')}>
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
            <h1>ห้วยหยวกปากโซ</h1>
            <p className="hero-tagline">ทำด้วยกัน ทำด้วยใจ</p>
            <p className="hero-copy">
              แหล่งรวมผลิตภัณฑ์คุณภาพจากเกษตรกรชุมชน สดใหม่ ปลอดสารพิษ
              ส่งตรงจากไร่ถึงมือคุณ
            </p>
            <div className="hero-actions">
              <button type="button" className="hero-primary" onClick={() => onNavigate('/products')}>
                เลือกซื้อสินค้า
              </button>
              <button type="button" className="hero-secondary" onClick={() => onNavigate('/knowledge')}>
                เรียนรู้การปลูก
              </button>
            </div>
          </div>
          <button type="button" className="scroll-cue" onClick={() => scrollTo('products')} aria-label="เลื่อนไปยังสินค้า">
            ↓
          </button>
        </section>

        <section id="history" className="section history-section" aria-labelledby="history-title">
          <div className="site-shell history-layout">
            <figure className="history-visual reveal-on-scroll">
              <img src="/images/community-history.jpg" alt="บรรยากาศบ้านห้วยหยวกป่าโซ" />
              <figcaption>บ้านห้วยหยวกป่าโซ จังหวัดเชียงราย</figcaption>
            </figure>
            <article className="history-content reveal-on-scroll">
              <p className="history-eyebrow">เรื่องราวของชุมชน</p>
              <h2 id="history-title">ความเป็นมา</h2>
              <div className="history-copy">
                <p>บ้านห้วยหยวกป่าโซ ตั้งอยู่หมู่ที่ 9 ตำบลแม่สลองใน อำเภอแม่ฟ้าหลวง จังหวัดเชียงราย ก่อตั้งขึ้นเมื่อปี พ.ศ. 2512 โดยนายป่าโซ มาเยอะ ได้นำประชาชนจากหลายพื้นที่เข้ามาตั้งถิ่นฐานร่วมกัน ได้แก่ บ้านพญาไพร บ้านโป่งไฮ บ้านนาโต่ และบ้านเล่าลิ่ว</p>
                <p>ในระยะแรก ชุมชนตั้งอยู่บนสันเขาใกล้ชายแดนไทย–เมียนมา แต่เนื่องจากพื้นที่อยู่ห่างไกลจากแหล่งน้ำ เมื่อจำนวนประชากรเพิ่มขึ้นจึงประสบปัญหาน้ำไม่เพียงพอต่อการอุปโภคบริโภคและการทำเกษตร ชาวบ้านจึงย้ายชุมชนไปทางทิศตะวันออกจากพื้นที่เดิมประมาณ 6 กิโลเมตร และก่อตั้งเป็นหมู่บ้านในพื้นที่ปัจจุบันเมื่อปี พ.ศ. 2519</p>
                <p>หมู่บ้านตั้งอยู่บนพื้นที่ภูเขาสูงประมาณ 1,200–1,500 เมตรจากระดับน้ำทะเล มีสภาพภูมิประเทศเป็นภูเขาสลับซับซ้อนและพื้นที่ลาดชัน ประชากรประกอบด้วยกลุ่มชาติพันธุ์อาข่า ลาหู่ และจีนฮ่อ ซึ่งมีภาษา ศาสนา ประเพณี และวัฒนธรรมที่แตกต่างกัน แต่สามารถอยู่ร่วมกันได้อย่างกลมกลืน จึงเป็นชุมชนที่มีความหลากหลายทางวัฒนธรรมและมีเอกลักษณ์เฉพาะตัว</p>
                <p>อาชีพดั้งเดิมของชาวบ้านส่วนใหญ่คือการทำเกษตรกรรม เช่น การทำนาขั้นบันได การปลูกพืชเพื่อบริโภค และการเลี้ยงสัตว์ ต่อมาชุมชนได้เริ่มปลูกชาและกาแฟอาราบิกาเป็นพืชเศรษฐกิจ เนื่องจากสภาพอากาศเย็นและพื้นที่สูงเหมาะสมต่อการเพาะปลูก ทำให้ชาและกาแฟกลายเป็นผลิตภัณฑ์สำคัญที่ช่วยสร้างรายได้ให้แก่ประชาชนในชุมชน</p>
                <p>เมื่อวันที่ 14 มกราคม พ.ศ. 2546 สมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถ พระบรมราชชนนีพันปีหลวง เสด็จทอดพระเนตรพื้นที่ป่าและลุ่มน้ำแม่คำ ซึ่งในขณะนั้นประสบปัญหาป่าเสื่อมโทรม จึงทรงมีพระราชดำริให้จัดตั้งสถานีพัฒนาการเกษตรที่สูงตามพระราชดำริ บ้านห้วยหยวกป่าโซ เพื่อส่งเสริมให้ประชาชนใช้ประโยชน์จากที่ดินอย่างเหมาะสม พัฒนาการเกษตรแบบครบวงจร ลดการใช้สารเคมี แปรรูปผลผลิตทางการเกษตร และฟื้นฟูทรัพยากรป่าไม้และแหล่งต้นน้ำ</p>
                <p>ปัจจุบันบ้านห้วยหยวกป่าโซเป็นชุมชนบนพื้นที่สูงที่มีความโดดเด่นด้านความหลากหลายทางชาติพันธุ์ วิถีชีวิต วัฒนธรรม และภูมิปัญญาท้องถิ่น ชาวบ้านยังคงประกอบอาชีพเกษตรกรรมควบคู่กับการอนุรักษ์ทรัพยากรธรรมชาติ โดยเฉพาะการปลูกชาและกาแฟอาราบิกา ซึ่งได้รับการพัฒนาเป็นผลิตภัณฑ์ของชุมชนและเป็นแหล่งรายได้สำคัญที่ช่วยยกระดับคุณภาพชีวิตของประชาชนในหมู่บ้าน</p>
              </div>
            </article>
          </div>
        </section>

        <section id="products" className="section products-section">
          <div className="site-shell">
            <div className="section-heading reveal-on-scroll">
              <h2>สินค้าแนะนำ</h2>
              <p>
                สินค้าคุณภาพสูงจากทีมเกษตรกรห้วยหยวกปากโซ อันหลากหลายทั้งสด
                ปลอดสารเคมี สดใหม่ที่สุด เลือกซื้อเพื่อสนับสนุนชุมชนเกษตรกร
              </p>
            </div>

            {featuredLoading ? <div className="featured-products-state">กำลังโหลดสินค้าแนะนำ...</div> : null}
            {featuredError ? <div className="featured-products-state is-error">{featuredError}</div> : null}
            {!featuredLoading && !featuredError && featuredProducts.length === 0 ? (
              <div className="featured-products-state">ยังไม่พบสินค้าชาหรือกาแฟในระบบ</div>
            ) : null}

            {featuredProducts.length > 0 ? <div className="product-grid">
              {featuredProducts.map((product) => {
                const stock = Number(product.stock_quantity || 0);
                return (
                <article className="product-card reveal-on-scroll is-visible" key={product.product_id}>
                  <div className="product-media">
                    <img src={getProductImage(product)} alt={product.product_name} />
                    <span className="product-category-badge">
                      {featuredCategories[String(product.category_id)] || 'สินค้าเกษตร'}
                    </span>
                    <span className="product-availability-badge">{stock > 0 ? 'พร้อมส่ง' : 'สินค้าหมด'}</span>
                  </div>
                  <div className="product-body">
                    <h3>{product.product_name}</h3>
                    <p className="product-description">
                      {product.description || 'ผลิตภัณฑ์คุณภาพจากชุมชนห้วยหยวกปากโซ'}
                    </p>
                    <button
                      type="button"
                      className="product-more-button"
                      onClick={() => onNavigate('/products')}
                    >
                      ดูเพิ่มเติม
                    </button>
                    <div className="product-footer">
                      <div>
                        <strong>{formatProductPrice(product.price)}</strong>
                        <span>/{product.unit || 'หน่วย'}</span>
                      </div>
                      <button
                        type="button"
                        disabled={stock <= 0}
                        onClick={() => handleFeaturedAddToCart(product)}
                      >
                        {addedProductId === product.product_id ? 'เพิ่มแล้ว' : stock > 0 ? 'ใส่ตะกร้า' : 'สินค้าหมด'}
                      </button>
                    </div>
                  </div>
                </article>
              );})}
            </div> : null}
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
                  <button type="button" onClick={() => onNavigate('/knowledge')}>{service.link} →</button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="news" className="section news-section">
          <div className="site-shell">
            <div className="section-heading reveal-on-scroll">
              <h2>ข่าวและกิจกรรม</h2>
              <p>อัปเดตข่าวสารและกิจกรรมล่าสุดจากชุมชนห้วยหยวกปากโซ</p>
            </div>

            <div className="news-grid">
              {news.map((item) => (
                <article className="news-card reveal-on-scroll" key={item.title}>
                  <img src={item.image} alt={item.title} />
                  <div className="news-body">
                    <time>{item.date}</time>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <button type="button" onClick={() => onNavigate('/news')}>อ่านต่อ →</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="site-footer">
        <p>© 2026 ห้วยหยวกปากโซ. All rights reserved.</p>
      </footer>
    </div>
  );
}
