import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchCatalogCategories, fetchCatalogProducts } from '../api/catalog';
import { recordProductView } from '../api/recommendations';
import BrandLogo from '../components/BrandLogo';
import Pagination from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import usePagination from '../hooks/usePagination';
import { isCustomerUser } from '../utils/roles';
import { getSearchScore, normalizeSearchText } from '../utils/search';
import { getImageUrl as resolveImageUrl } from '../utils/imageUrl';
import './Home.css';
import './ProductsPage.css';
import CustomerNavbar from '../components/CustomerNavbar';
import Toast from '../components/Toast';
import ProductDetailModal from '../components/ProductDetailModal';

const fallbackImages = [
  'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1506807803488-8eafc15316c7?auto=format&fit=crop&w=900&q=80',
];

function getImageUrl(product, index) {
  return resolveImageUrl(product.image_url, fallbackImages[index % fallbackImages.length]);
}

function formatPrice(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(number);
}

function getProductSearchScore(query, product, categoryById) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  const haystackValues = [
    product.product_name,
    product.description,
    product.production_source,
    categoryById[String(product.category_id)],
  ].filter(Boolean);

  let bestScore = 0;
  let bestValue = '';

  haystackValues.forEach((value) => {
    const score = getSearchScore(normalizedQuery, value);
    if (score > bestScore) {
      bestScore = score;
      bestValue = value;
    }
  });

  if (!bestScore) return 0;

  const normalizedBestValue = normalizeSearchText(bestValue);
  const startsWithQuery = normalizedBestValue.startsWith(normalizedQuery);
  const containsQuery = normalizedBestValue.includes(normalizedQuery);

  if (startsWithQuery) {
    bestScore += 12;
  } else if (containsQuery) {
    bestScore += 6;
  }

  return bestScore;
}

function compareProducts(left, right, sortBy) {
  if (sortBy === 'price-low') {
    return Number(left.price || 0) - Number(right.price || 0);
  }

  if (sortBy === 'price-high') {
    return Number(right.price || 0) - Number(left.price || 0);
  }

  if (sortBy === 'name') {
    return String(left.product_name || '').localeCompare(String(right.product_name || ''), 'th');
  }

  return Number(right.product_id || 0) - Number(left.product_id || 0);
}

function sortProducts(products, sortBy) {
  return [...products].sort((left, right) => compareProducts(left, right, sortBy));
}

export default function ProductsPage({ user, onNavigate, onLogout }) {
  const { token } = useAuth();
  const { addItem, itemCount } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [profileOpen, setProfileOpen] = useState(false);
  const [addedProductId, setAddedProductId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const profileRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        setLoading(true);
        setError('');
        const [productRows, categoryRows] = await Promise.all([
          fetchCatalogProducts(),
          fetchCatalogCategories(),
        ]);

        if (!active) return;
        setProducts(productRows);
        setCategories(categoryRows);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'ไม่สามารถโหลดข้อมูลสินค้าได้');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCatalog();

    return () => {
      active = false;
    };
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
        setSelectedProduct(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  const categoryById = useMemo(() => {
    return categories.reduce((map, category) => {
      map[String(category.category_id)] = category.category_name;
      return map;
    }, {});
  }, [categories]);

  const visibleProducts = useMemo(() => {
    const keyword = search.trim();

    const filtered = products.filter((product) => {
      if (product.status === 'suspended') return false;

      const matchesCategory =
        categoryId === 'all' || String(product.category_id) === String(categoryId);

      return matchesCategory;
    });

    if (!keyword) {
      return sortProducts(filtered, sortBy);
    }

    const scoredProducts = filtered
      .map((product) => ({
        product,
        score: getProductSearchScore(keyword, product, categoryById),
      }))
      .filter(({ score }) => score > 0);

    scoredProducts.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return compareProducts(left.product, right.product, sortBy);
    });

    return scoredProducts.map(({ product }) => product);
  }, [products, categoryId, search, sortBy, categoryById]);

  const productPagination = usePagination(visibleProducts, 12, [search, categoryId, sortBy]);

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

  function handleAddToCart(product, quantity = 1) {
    if (product.status === 'suspended' || Number(product.stock_quantity || 0) <= 0) return;

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

  function getProductCategoryName(product) {
    return categoryById[String(product.category_id)] || 'สินค้าเกษตร';
  }

  function openProductDetail(product, index) {
    setSelectedProduct({ ...product, imageUrl: getImageUrl(product, index) });
    if (token && isCustomerUser(user)) {
      recordProductView(token, product.product_id).catch(() => {});
    }
  }

  return (
    <div className="catalog-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="catalog-main">
        <section className="catalog-shell catalog-hero">
          <div className="catalog-hero-copy">
            <span className="catalog-eyebrow">ตลาดชุมชนพื้นที่สูง</span>
            <h1>สินค้าจากใจ<br />ส่งตรงจากชุมชน</h1>
            <p>คัดสรรชา กาแฟ และผลผลิตคุณภาพจากเกษตรกรห้วยหยวกป่าโซ ทุกการสั่งซื้อช่วยสร้างรายได้และดูแลผืนป่าไปพร้อมกัน</p>
            <div className="catalog-benefits" aria-label="จุดเด่นของสินค้า">
              <span>ผลผลิตจากชุมชน</span>
              <span>คัดสรรคุณภาพ</span>
              <span>จัดส่งทั่วประเทศ</span>
            </div>
          </div>

          <div className="catalog-filters" aria-label="ค้นหาและกรองสินค้า">
            <div className="catalog-filter-heading">
              <strong>ค้นหาสินค้าที่ใช่</strong>
              <span>เลือกประเภทและเรียงสินค้าได้ตามต้องการ</span>
            </div>
            <label>
              <span>ค้นหา</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาสินค้า..."
              />
            </label>

            <label>
              <span>ประเภทสินค้า</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="all">ทั้งหมด</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.category_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>เรียงตาม</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">ใหม่ล่าสุด</option>
                <option value="price-low">ราคาต่ำสุด</option>
                <option value="price-high">ราคาสูงสุด</option>
                <option value="name">ชื่อสินค้า</option>
              </select>
            </label>
          </div>

          {loading && <div className="catalog-state">กำลังโหลดสินค้า...</div>}

          {!loading && error && (
            <div className="catalog-state catalog-error">
              <p>{error}</p>
              <button type="button" onClick={() => window.location.reload()}>
                โหลดใหม่
              </button>
            </div>
          )}

          {!loading && !error && visibleProducts.length === 0 && (
            <div className="catalog-state">ไม่พบสินค้าที่ตรงกับเงื่อนไข</div>
          )}

          {!loading && !error && visibleProducts.length > 0 && (
            <>
            <div className="catalog-results-heading">
              <div>
                <span>รายการสินค้า</span>
                <strong>{visibleProducts.length} รายการ</strong>
              </div>
              {(search || categoryId !== 'all') ? (
                <button type="button" onClick={() => { setSearch(''); setCategoryId('all'); }}>ล้างตัวกรอง</button>
              ) : null}
            </div>
            <div className="catalog-grid">
              {productPagination.pageItems.map((product, index) => {
                const categoryName = getProductCategoryName(product);
                const stock = Number(product.stock_quantity || 0);

                return (
                  <article className="catalog-card" key={product.product_id}>
                    <div className="catalog-card-media">
                      <img src={getImageUrl(product, index)} alt={product.product_name} />
                      <span className="catalog-category-pill">{categoryName}</span>
                      <span className={`catalog-stock-pill${stock <= 0 ? ' is-out' : ''}`}>{stock > 0 ? 'พร้อมส่ง' : 'หมดสต็อก'}</span>
                    </div>
                    <div className="catalog-card-body">
                      <div className="catalog-card-meta">
                        <span>ผลิตภัณฑ์ชุมชน</span>
                        <span>คงเหลือ {stock}</span>
                      </div>
                      <h2>{product.product_name}</h2>
                      <p className="catalog-card-description">
                        {product.description || 'ผลิตภัณฑ์คุณภาพจากชุมชนห้วยหยวกป่าโซ'}
                      </p>
                      <button
                        type="button"
                        className="catalog-detail-button"
                        onClick={() => openProductDetail(product, index)}
                      >
                        ดูเพิ่มเติม
                      </button>
                      <div className="catalog-card-footer">
                        <strong>
                          {formatPrice(product.price)}
                          <small> /{product.unit || 'หน่วย'}</small>
                        </strong>
                        <button
                          type="button"
                          disabled={stock <= 0}
                          onClick={() => handleAddToCart(product)}
                        >
                          {stock <= 0
                            ? 'หมดสต็อก'
                            : addedProductId === product.product_id
                              ? 'เพิ่มแล้ว'
                              : 'ใส่ตะกร้า'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            </>
          )}
          {!loading && !error && (
            <Pagination page={productPagination.page} totalPages={productPagination.totalPages} onPageChange={productPagination.setPage} className="catalog-pagination" />
          )}
        </section>
      </main>

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          categoryName={getProductCategoryName(selectedProduct)}
          imageUrl={selectedProduct.imageUrl}
          onClose={() => setSelectedProduct(null)}
          added={addedProductId === selectedProduct.product_id}
          onAddToCart={handleAddToCart}
        />
      )}
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </div>
  );
}







