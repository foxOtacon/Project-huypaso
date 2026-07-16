import { useEffect, useRef, useState } from 'react';
import BrandLogo from '../components/BrandLogo';
import { useCart } from '../context/CartContext';
import { isCustomerUser } from '../utils/roles';
import './Home.css';
import './ProductsPage.css';
import './CartPage.css';

const fallbackImage =
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80';

function formatPrice(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getImageUrl(item) {
  const imageUrl = item.image_url?.trim();
  if (!imageUrl) return fallbackImage;
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return `/${imageUrl}`;
}

function ProfileMenuIcon({ name }) {
  if (name === 'profile') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
    );
  }

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

export default function CartPage({ user, onNavigate, onLogout }) {
  const { items, itemCount, totalAmount, updateQuantity, removeItem, clearCart } = useCart();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

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
    <div className="catalog-page cart-page">
      <header className="site-header">
        <div className="site-shell nav-shell">
          <button type="button" className="brand-link" onClick={() => onNavigate('/')}>
            <BrandLogo />
            ห้วยหยวกปากโซ
          </button>

          <nav className="main-nav" aria-label="เมนูหลัก">
            <button type="button" onClick={() => onNavigate('/')}>หน้าหลัก</button>
            <button type="button" onClick={() => onNavigate('/products')}>สินค้า</button>
            <button type="button" onClick={() => onNavigate('/knowledge')}>ความรู้</button>
            <button type="button" onClick={() => onNavigate('/')}>ข่าว</button>
            <button type="button" onClick={() => onNavigate('/')}>ติดต่อ</button>
          </nav>

          <div className="account-actions">
            {isCustomer && (
              <button type="button" className="home-cart-button cart-home-active" onClick={() => onNavigate('/cart')}>
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

      <main className="catalog-main">
        <section className="catalog-shell cart-layout">
          <div className="cart-heading">
            <div>
              <h1>ตะกร้าสินค้า</h1>
              <p>ตรวจสอบสินค้าและจำนวนก่อนดำเนินการชำระเงิน</p>
            </div>
            {items.length > 0 && (
              <button type="button" className="cart-clear" onClick={clearCart}>
                ล้างตะกร้า
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="cart-empty">
              <h2>ยังไม่มีสินค้าในตะกร้า</h2>
              <p>เลือกสินค้าจากหน้าสินค้าแล้วกดใส่ตะกร้า</p>
              <button type="button" onClick={() => onNavigate('/products')}>
                ไปเลือกสินค้า
              </button>
            </div>
          ) : (
            <div className="cart-content">
              <div className="cart-items">
                {items.map((item) => (
                  <article className="cart-item" key={item.product_id}>
                    <img src={getImageUrl(item)} alt={item.product_name} />
                    <div className="cart-item-info">
                      <h2>{item.product_name}</h2>
                      <p>{formatPrice(item.price)} /{item.unit}</p>
                      <button type="button" onClick={() => removeItem(item.product_id)}>
                        ลบสินค้า
                      </button>
                    </div>
                    <div className="cart-quantity">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        aria-label={`ลดจำนวน ${item.product_name}`}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.stock_quantity || undefined}
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.product_id, event.target.value)}
                        aria-label={`จำนวน ${item.product_name}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        disabled={item.stock_quantity > 0 && item.quantity >= item.stock_quantity}
                        aria-label={`เพิ่มจำนวน ${item.product_name}`}
                      >
                        +
                      </button>
                    </div>
                    <strong>{formatPrice(item.price * item.quantity)}</strong>
                  </article>
                ))}
              </div>

              <aside className="cart-summary">
                <h2>สรุปคำสั่งซื้อ</h2>
                <div>
                  <span>จำนวนสินค้า</span>
                  <strong>{itemCount} รายการ</strong>
                </div>
                <div>
                  <span>ยอดรวม</span>
                  <strong>{formatPrice(totalAmount)}</strong>
                </div>
                <button type="button" onClick={() => onNavigate(isCustomerUser(user) ? '/payment' : '/login')}>
                  ดำเนินการชำระเงิน
                </button>
                <button type="button" className="cart-continue" onClick={() => onNavigate('/products')}>
                  เลือกสินค้าเพิ่ม
                </button>
              </aside>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

