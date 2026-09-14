import { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import BrandLogo from '../components/BrandLogo';
import CustomerNavbar from '../components/CustomerNavbar';
import HomeHeroBanner from '../components/HomeHeroBanner';
import { fetchCatalogCategories, fetchCatalogProducts } from '../api/catalog';
import { fetchPublishedNews } from '../api/news';
import { fetchProductRecommendations, recordProductView } from '../api/recommendations';
import { fetchHistoryContent } from '../api/siteContent';
import { fetchGalleryImages } from '../api/gallery';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { isCustomerUser } from '../utils/roles';
import { getImageUrl, resolveImageUrlsInHtml } from '../utils/imageUrl';
import './Home.css';
import './ProductsPage.css';
import Toast from '../components/Toast';
import ProductDetailModal from '../components/ProductDetailModal';

const FEATURED_KEYWORDS = ['ชา', 'กาแฟ', 'tea', 'coffee'];
const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80';
const HISTORY_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 's', 'a',
    'ul', 'ol', 'li', 'blockquote', 'hr', 'figure', 'figcaption', 'img',
    'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'span',
    'div', 'pre', 'code', 'mark', 'sub', 'sup', 'oembed',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel', 'class', 'style', 'src', 'alt',
    'width', 'height', 'colspan', 'rowspan', 'scope', 'id', 'start', 'reversed', 'type', 'url',
  ],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['srcset'],
  ALLOW_UNKNOWN_PROTOCOLS: false,
};
function formatProductPrice(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getProductImage(product) {
  return getImageUrl(product.image_url, FALLBACK_PRODUCT_IMAGE);
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

const fallbackNews = [
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

function getNewsImage(item, index) {
  return getImageUrl(item?.image_url, fallbackNews[index % fallbackNews.length].image);
}

function formatNewsDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getNewsExcerpt(item) {
  const text = String(item?.summary || item?.content || '').trim();
  return text.length > 140 ? `${text.slice(0, 137).trimEnd()}...` : text;
}

function getRandomProducts(products, limit = 5) {
  const shuffled = [...products];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}

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
  const { token } = useAuth();
  const { addItem, itemCount } = useCart();
  const [profileOpen, setProfileOpen] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [featuredCategories, setFeaturedCategories] = useState({});
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState('');
  const [featuredStrategy, setFeaturedStrategy] = useState('general');
  const [addedProductId, setAddedProductId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [latestNews, setLatestNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');
  const [historyHtml, setHistoryHtml] = useState('');
  const [historyLocation, setHistoryLocation] = useState({ latitude: null, longitude: null });
  const profileRef = useRef(null);
  const featuredTrackRef = useRef(null);
  const galleryTrackRef = useRef(null);

  const sanitizedHistoryHtml = useMemo(() => {
    const content = String(historyHtml || '').trim();
    const sanitized = content ? DOMPurify.sanitize(content, HISTORY_SANITIZE_OPTIONS).trim() : '';
    return resolveImageUrlsInHtml(sanitized);
  }, [historyHtml]);

  useEffect(() => {
    let active = true;

    async function loadFeaturedProducts() {
      try {
        setFeaturedLoading(true);
        setFeaturedError('');
        const [products, categories] = await Promise.all([
          fetchCatalogProducts(),
          fetchCatalogCategories(),
        ]);
        if (!active) return;

        const categoryMap = Object.fromEntries(
          categories.map((category) => [String(category.category_id), category.category_name]),
        );
        const availableProducts = products.filter(
          (product) => product.status !== 'suspended' && Number(product.stock_quantity || 0) > 0,
        );
        const keywordProducts = availableProducts.filter((product) => {

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
        const keywordIds = new Set(keywordProducts.map((product) => Number(product.product_id)));
        const generalRecommendations = [
          ...keywordProducts,
          ...availableProducts.filter((product) => !keywordIds.has(Number(product.product_id))),
        ].slice(0, 5);
        const isLoggedInCustomer = Boolean(token && isCustomerUser(user));
        const initialRecommendations = isLoggedInCustomer
          ? generalRecommendations
          : getRandomProducts(availableProducts, 5);

        setFeaturedCategories(categoryMap);
        setFeaturedProducts(initialRecommendations);
        setFeaturedStrategy(isLoggedInCustomer ? 'general' : 'guest-random');
        setFeaturedLoading(false);

        if (isLoggedInCustomer) {
          try {
            const recommendationData = await fetchProductRecommendations(token, 5);
            if (!active) return;
            const productMap = new Map(
              availableProducts.map((product) => [Number(product.product_id), product]),
            );
            const personalizedIds = new Set();
            const personalized = [];
            const recommendations = Array.isArray(recommendationData.recommendations)
              ? recommendationData.recommendations
              : [];

            for (const recommendation of recommendations) {
              const product = productMap.get(Number(recommendation.product_id));
              const productId = Number(product?.product_id);
              if (!product || personalizedIds.has(productId)) continue;

              personalizedIds.add(productId);
              personalized.push({
                ...product,
                recommendation_reason: String(recommendation.reason || '').trim(),
                recommendation_score: Number(recommendation.score || 0),
              });
              if (personalized.length === 5) break;
            }

            if (personalized.length > 0) {
              const filledRecommendations = [
                ...personalized,
                ...generalRecommendations.filter(
                  (product) => !personalizedIds.has(Number(product.product_id)),
                ),
              ].slice(0, 5);

              setFeaturedProducts(filledRecommendations);
              setFeaturedStrategy(recommendationData.strategy || 'popular');
            }
          } catch {
            // Recommendation failures must not prevent the normal catalog from loading.
          }
        }
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
  }, [token, user]);

  useEffect(() => {
    let active = true;
    fetchGalleryImages()
      .then((images) => {
        if (!active) return;

        const randomized = [...images].sort(() => Math.random() - 0.5);
        setGalleryImages(randomized);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLatestNews() {
      try {
        const rows = await fetchPublishedNews();
        if (!active) return;
        setLatestNews(rows.slice(0, 3));
      } catch (error) {
        if (active) setNewsError(error.message || 'ไม่สามารถโหลดข่าวล่าสุดได้');
      } finally {
        if (active) setNewsLoading(false);
      }
    }

    loadLatestNews();
    return () => {
      active = false;
    };
  }, [galleryImages.length]);

  useEffect(() => {
    let active = true;

    async function loadHistoryContent() {
      try {
        const content = await fetchHistoryContent();
        const nextHtml = String(content?.content_html || '').trim();

        if (active && nextHtml) {
          setHistoryHtml(nextHtml);
        }
        const latitude = Number(content?.latitude);
        const longitude = Number(content?.longitude);
        if (active && Number.isFinite(latitude) && Number.isFinite(longitude)
          && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
          setHistoryLocation({ latitude, longitude });
        }
      } catch {
        // Keep the built-in community history visible when the CMS is unavailable.
      }
    }

    loadHistoryContent();
    return () => {
      active = false;
    };
  }, []);

  function handleFeaturedAddToCart(product, quantity = 1) {
    if (!isCustomerUser(user)) {
      onNavigate('/login');
      return;
    }

    addItem(product, quantity);
    setAddedProductId(product.product_id);
    setToastMessage('เพิ่มสินค้าแล้ว');
    window.setTimeout(() => setToastMessage(''), 1400);
    window.setTimeout(() => setAddedProductId(null), 1300);
  }

  function openFeaturedProductDetail(product) {
    setSelectedProduct({ ...product, imageUrl: getProductImage(product) });
    if (token && isCustomerUser(user)) {
      recordProductView(token, product.product_id).catch(() => {});
    }
  }

  function scrollFeaturedProducts(direction) {
    const track = featuredTrackRef.current;
    if (!track) return;

    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.82, 280),
      behavior: 'smooth',
    });
  }

  function scrollGallery(direction) {
    const track = galleryTrackRef.current;
    if (!track) return;

    const firstSlide = track.querySelector('.gallery-slide');
    const step = firstSlide ? firstSlide.getBoundingClientRect().width + 16 : Math.max(track.clientWidth * 0.8, 280);
    track.scrollBy({
      left: direction * step,
      behavior: 'smooth',
    });
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
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main id="top">
        <HomeHeroBanner onNavigate={onNavigate} onCommunity={() => scrollTo('history')} onScrollNext={() => scrollTo('products')} ariaLabel="หน้าหลัก" />

        <section className="impact-strip" aria-label="ภาพรวมชุมชน">
          <div className="site-shell impact-grid">
            <div><strong>1,200–1,500</strong><span>เมตรเหนือระดับน้ำทะเล</span></div>
            <div><strong>พ.ศ. 2512</strong><span>จุดเริ่มต้นของชุมชน</span></div>
            <div><strong>3 กลุ่มชาติพันธุ์</strong><span>อยู่ร่วมกันอย่างกลมกลืน</span></div>
            <div><strong>ชาและกาแฟ</strong><span>ผลผลิตเด่นจากพื้นที่สูง</span></div>
          </div>
        </section>

        <section id="history" className="section history-section" aria-labelledby="history-title">
          <div className="site-shell history-layout">
            <figure className="history-visual reveal-on-scroll">
              <img src="/images/community-history.jpg" alt="บรรยากาศบ้านห้วยหยวกป่าโซ" loading="lazy" decoding="async" />
              <figcaption>บ้านห้วยหยวกป่าโซ จังหวัดเชียงราย</figcaption>
            </figure>
            <article className="history-content reveal-on-scroll">
              <p className="history-eyebrow">เรื่องราวของชุมชน</p>
              <h2 id="history-title">ความเป็นมา</h2>
              <p className="history-lead">จากชุมชนบนสันเขา สู่แหล่งเกษตรคุณภาพที่เติบโตควบคู่กับผืนป่าและวัฒนธรรมอันหลากหลาย</p>

              <div className="history-highlights" role="list" aria-label="คุณค่าหลักของชุมชน">
                <div className="history-highlight-card" role="listitem">
                  <strong>
                    <span className="history-highlight-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M20 4c-7.5.2-12.1 2.3-14.3 6.2C3.8 13.5 5 17.4 8.4 19c3.6 1.6 7.1-.3 8.7-3.4C18.8 12.4 19.6 8.1 20 4Z" />
                        <path d="M4 20c2.9-4.3 6.5-7.5 11-9.6" />
                      </svg>
                    </span>
                    เกษตรอินทรีย์
                  </strong>
                  <span>ส่งเสริมการปลูกพืชอย่างยั่งยืนและคำนึงถึงสิ่งแวดล้อม</span>
                </div>
                <div className="history-highlight-card" role="listitem">
                  <strong>
                    <span className="history-highlight-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <circle cx="8" cy="8" r="3" />
                        <circle cx="17" cy="9" r="2.5" />
                        <path d="M2.5 20v-1.5A5.5 5.5 0 0 1 8 13a5.5 5.5 0 0 1 5.5 5.5V20" />
                        <path d="M14 14.3a4.5 4.5 0 0 1 7.5 3.4V20" />
                      </svg>
                    </span>
                    ชุมชนหลากหลายวัฒนธรรม
                  </strong>
                  <span>มีอัตลักษณ์จากกลุ่มชาติพันธุ์และภูมิปัญญาท้องถิ่นที่หลอมรวมเป็นหนึ่งเดียว</span>
                </div>
                <div className="history-highlight-card" role="listitem">
                  <strong>
                    <span className="history-highlight-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="m2 19 6.5-9 3.4 4.4L15 10l7 9H2Z" />
                        <path d="m6.8 12.4 1.7-2.4 1.8 2.4" />
                        <path d="M12 19c.1-2.6 1.4-4.3 4-5.2" />
                      </svg>
                    </span>
                    พัฒนาผลิตภัณฑ์จากพื้นที่สูง
                  </strong>
                  <span>ชาและกาแฟอาราบิกาเป็นสินค้าสำคัญที่สร้างรายได้ให้กับครัวเรือน</span>
                </div>
              </div>

              {sanitizedHistoryHtml ? (
                <div
                  className="history-copy"
                  dangerouslySetInnerHTML={{ __html: sanitizedHistoryHtml }}
                />
              ) : (
                <div className="history-copy">
                  <p>บ้านห้วยหยวกป่าโซ ตั้งอยู่หมู่ที่ 9 ตำบลแม่สลองใน อำเภอแม่ฟ้าหลวง จังหวัดเชียงราย ก่อตั้งขึ้นเมื่อปี พ.ศ. 2512 โดยนายป่าโซ มาเยอะ ได้นำประชาชนจากหลายพื้นที่เข้ามาตั้งถิ่นฐานร่วมกัน ได้แก่ บ้านพญาไพร บ้านโป่งไฮ บ้านนาโต่ และบ้านเล่าลิ่ว</p>
                  <ul>
                    <li>ในช่วงแรก ชุมชนตั้งอยู่บนสันเขาใกล้ชายแดนไทย–เมียนมา แต่ด้วยพื้นที่ห่างไกลจากแหล่งน้ำและจำนวนประชากรเพิ่มขึ้น ทำให้การอุปโภคบริโภคและการทำเกษตรประสบปัญหากับความไม่เพียงพอ จึงมีการย้ายถิ่นฐานไปทางทิศตะวันออกประมาณ 6 กิโลเมตร และก่อตั้งหมู่บ้านในพื้นที่ปัจจุบันเมื่อปี พ.ศ. 2519</li>
                    <li>หมู่บ้านตั้งอยู่บนพื้นที่ภูเขาสูงประมาณ 1,200–1,500 เมตรจากระดับน้ำทะเล มีภูมิประเทศที่ซับซ้อนและลาดชัน ประชากรประกอบด้วยกลุ่มชาติพันธุ์อาข่า ลาหู่ และจีนฮ่อ ซึ่งมีภาษา ศาสนา ประเพณี และวัฒนธรรมที่แตกต่างกัน แต่สามารถอยู่ร่วมกันได้อย่างกลมกลืน จึงเป็นชุมชนที่มีความหลากหลายทางวัฒนธรรมและเอกลักษณ์เฉพาะตัว</li>
                    <li>อาชีพดั้งเดิมของชาวบ้านคือการทำนาขั้นบันได เลี้ยงสัตว์ และปลูกพืชเพื่อบริโภค ต่อมาได้เริ่มปลูกชาและกาแฟอาราบิกาเป็นพืชเศรษฐกิจ เนื่องจากสภาพอากาศเย็นและพื้นที่สูงเหมาะสมต่อการเพาะปลูก จนกลายเป็นผลิตภัณฑ์สำคัญที่ช่วยเสริมรายได้ให้กับครัวเรือนในชุมชน</li>
                    <li>เมื่อวันที่ 14 มกราคม พ.ศ. 2546 สมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถพระบรมราชชนนีพันปีหลวง เสด็จทอดพระเนตรพื้นที่ป่าและลุ่มน้ำแม่คำ ซึ่งขณะนั้นประสบปัญหาป่าเสื่อมโทรม จึงทรงมีพระราชดำริให้จัดตั้งสถานีพัฒนาการเกษตรที่สูงตามพระราชดำริ บ้านห้วยหยวกป่าโซ เพื่อส่งเสริมการใช้ที่ดินอย่างเหมาะสม พัฒนาการเกษตรแบบครบวงจร ลดการใช้สารเคมี และฟื้นฟูทรัพยากรป่าไม้และแหล่งต้นน้ำ</li>
                  </ul>
                  <p>ปัจจุบันบ้านห้วยหยวกป่าโซเป็นชุมชนบนพื้นที่สูงที่โดดเด่นด้วยความหลากหลายทางชาติพันธุ์ วิถีชีวิต วัฒนธรรม และภูมิปัญญาท้องถิ่น ชาวบ้านยังคงประกอบอาชีพเกษตรกรรมควบคู่กับการอนุรักษ์ธรรมชาติ โดยเฉพาะการปลูกชาและกาแฟอาราบิกา ซึ่งได้รับการพัฒนาเป็นผลิตภัณฑ์ของชุมชนและเป็นแหล่งรายได้สำคัญที่ช่วยยกระดับคุณภาพชีวิตของประชาชนในหมู่บ้าน</p>
                </div>
              )}

              <section className="history-map" aria-labelledby="history-map-title">
                <p className="history-eyebrow">จุดสำคัญของชุมชน</p>
                <h3 id="history-map-title">ที่ตั้งหมู่บ้าน</h3>
                {historyLocation.latitude !== null && historyLocation.longitude !== null ? (
                  <div className="history-map-frame">
                    <iframe
                      title="แผนที่ตั้งหมู่บ้านห้วยหยวกป่าโซ"
                      src={`https://www.google.com/maps?q=${historyLocation.latitude},${historyLocation.longitude}&z=15&output=embed`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                ) : (
                  <p className="history-map-empty">ยังไม่มีข้อมูลตำแหน่งที่ตั้งของหมู่บ้าน</p>
                )}
              </section>

            </article>
          </div>
        </section>

        {galleryImages.length > 0 ? (
          <section className="section home-gallery-section" aria-labelledby="home-gallery-title">
            <div className="site-shell home-gallery-shell">
              <div className="home-gallery-header">
                <div className="section-heading home-gallery-heading">
                  <h2 id="home-gallery-title">แกลเลอรี่</h2>
                </div>
                <div className="home-gallery-controls" aria-label="เลื่อนภาพแกลเลอรี่">
                  <button type="button" className="gallery-arrow" aria-label="ดูภาพก่อนหน้า" onClick={() => scrollGallery(-1)}>‹</button>
                  <button type="button" className="gallery-arrow" aria-label="ดูภาพถัดไป" onClick={() => scrollGallery(1)}>›</button>
                </div>
              </div>

              <div className="gallery-slider" ref={galleryTrackRef} aria-label="สไลด์ภาพแกลเลอรี่">
                {galleryImages.map((image) => (
                  <figure key={image.gallery_id ?? image.image_url} className="gallery-slide">
                    <img src={getImageUrl(image.image_url)} alt="บรรยากาศหมู่บ้านห้วยหยวกป่าโซ" loading="lazy" decoding="async" />
                  </figure>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section id="products" className="section products-section">
          <div className="site-shell">
            <div className="section-heading reveal-on-scroll">
              <span className="section-kicker">
                {featuredStrategy === 'personalized' ? 'คัดสรรจากสิ่งที่คุณสนใจ' : 'คัดสรรจากชุมชน'}
              </span>
              <h2>{featuredStrategy === 'personalized' ? 'สินค้าแนะนำสำหรับคุณ' : 'สินค้าแนะนำ'}</h2>
              <p>
                {featuredStrategy === 'personalized'
                  ? 'แนะนำจากหมวดหมู่ ความถี่ และความล่าสุดของสินค้าที่คุณเปิดดู'
                  : 'สินค้าคุณภาพจากทีมเกษตรกรห้วยหยวกป่าโซ เลือกซื้อเพื่อสนับสนุนชุมชนเกษตรกร'}
              </p>
            </div>

            {featuredLoading ? <div className="featured-products-state">กำลังโหลดสินค้าแนะนำ...</div> : null}
            {featuredError ? <div className="featured-products-state is-error">{featuredError}</div> : null}
            {!featuredLoading && !featuredError && featuredProducts.length === 0 ? (
              <div className="featured-products-state">ยังไม่พบสินค้าที่พร้อมจำหน่ายในระบบ</div>
            ) : null}

            {featuredProducts.length > 0 ? <div className="featured-carousel">
              <button
                type="button"
                className="featured-carousel-button is-previous"
                aria-label="ดูสินค้าแนะนำก่อนหน้า"
                onClick={() => scrollFeaturedProducts(-1)}
              >
                ‹
              </button>
              <div
                className="product-grid featured-product-track"
                ref={featuredTrackRef}
                tabIndex="0"
                aria-label="สินค้าแนะนำ 5 รายการ เลื่อนในแนวนอนเพื่อดูเพิ่มเติม"
              >
              {featuredProducts.map((product) => {
                const stock = Number(product.stock_quantity || 0);
                return (
                <article className="product-card reveal-on-scroll is-visible" key={product.product_id}>
                  <div className="product-media">
                    <img src={getProductImage(product)} alt={product.product_name} loading="lazy" decoding="async" />
                    <span className="product-category-badge">
                      {featuredCategories[String(product.category_id)] || 'สินค้าเกษตร'}
                    </span>
                    <span className="product-availability-badge">{stock > 0 ? 'พร้อมส่ง' : 'หมดสต็อก'}</span>
                  </div>
                  <div className="product-body">
                    <h3>{product.product_name}</h3>
                    {product.recommendation_reason ? (
                      <p className="product-recommendation-reason">
                        <span aria-hidden="true">✦</span>{product.recommendation_reason}
                      </p>
                    ) : null}
                    <p className="product-description">
                      {product.description || 'ผลิตภัณฑ์คุณภาพจากชุมชนห้วยหยวกป่าโซ'}
                    </p>
                    
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
                        {addedProductId === product.product_id ? 'เพิ่มแล้ว' : stock > 0 ? 'ใส่ตะกร้า' : 'หมดสต็อก'}
                      </button>
                    </div>
                    <button
                        type="button"
                        className="catalog-detail-button"
                        onClick={() => openFeaturedProductDetail(product)}
                      >
                        ดูเพิ่มเติม
                      </button>
                  </div>
                  
                </article>
              );})}
              </div>
              <button
                type="button"
                className="featured-carousel-button is-next"
                aria-label="ดูสินค้าแนะนำถัดไป"
                onClick={() => scrollFeaturedProducts(1)}
              >
                ›
              </button>

            </div> : null}
            {featuredProducts.length > 0 ? (
              <div className="section-cta reveal-on-scroll is-visible">
                <button type="button" onClick={() => onNavigate('/products')}>เลือกชมสินค้าทั้งหมด</button>
              </div>
            ) : null}

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
          </div>
        </section>

        <section id="work" className="section work-section">
          <div className="site-shell">
            <div className="section-heading reveal-on-scroll">
              <span className="section-kicker">เติบโตไปด้วยกัน</span>
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
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="news" className="section news-section">
          <div className="site-shell">
            <div className="section-heading reveal-on-scroll">
              <span className="section-kicker">เรื่องราวล่าสุด</span>
              <h2>ข่าวและกิจกรรม</h2>
              <p>อัปเดตข่าวสารและกิจกรรมล่าสุดจากชุมชนห้วยหยวกป่าโซ</p>
            </div>

            <div className="news-grid">
              {newsLoading ? (
                <div className="home-news-state">กำลังโหลดข่าวล่าสุด...</div>
              ) : null}

              {!newsLoading && newsError ? (
                <div className="home-news-state home-news-state-error">
                  <span>{newsError}</span>
                  <button type="button" onClick={() => onNavigate('/news')}>ไปหน้าข่าว</button>
                </div>
              ) : null}

              {!newsLoading && !newsError && latestNews.length === 0 ? (
                <div className="home-news-state">ยังไม่มีข่าวที่เผยแพร่</div>
              ) : null}

              {!newsLoading && !newsError
                ? latestNews.map((item, index) => (
                    <article className="news-card" key={item.news_id}>
                      <img src={getNewsImage(item, index)} alt={item.title} loading="lazy" decoding="async" />
                      <div className="news-body">
                        <time dateTime={item.created_at}>{formatNewsDate(item.created_at)}</time>
                        <h3>{item.title}</h3>
                        <p>{getNewsExcerpt(item)}</p>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/news?id=${item.news_id}`)}
                        >
                          อ่านต่อ →
                        </button>
                      </div>
                    </article>
                  ))
                : null}
            </div>
          </div>
        </section>
      </main>

      {selectedProduct && (
        <ProductDetailModal
          key={selectedProduct.product_id}
          product={selectedProduct}
          categoryName={featuredCategories[String(selectedProduct.category_id)]}
          imageUrl={selectedProduct.imageUrl || getProductImage(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          added={addedProductId === selectedProduct.product_id}
          onAddToCart={(product, quantity) => {
            setSelectedProduct(null);
            handleFeaturedAddToCart(product, quantity);
          }}
        />
      )}

      <footer id="contact" className="site-footer">
        <p>© 2026 ห้วยหยวกป่าโซ. All rights reserved.</p>
      </footer>
    </div>
  );
}

