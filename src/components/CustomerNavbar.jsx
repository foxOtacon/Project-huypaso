import { useEffect, useRef, useState } from 'react';
import BrandLogo from './BrandLogo';
import { useCart } from '../context/CartContext';
import { isCustomerUser } from '../utils/roles';
import {
  clearGoogleProfileReminder,
  readGoogleProfileReminder,
} from '../utils/googleProfileReminder';
import '../pages/Home.css';
import './CustomerNavbar.css';

export default function CustomerNavbar({ user, onNavigate, onLogout }) {
  const { itemCount } = useCart();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileReminderDismissed, setProfileReminderDismissed] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => window.location.hash.slice(1).split('?')[0] || '/');
  const profileRef = useRef(null);
  const profileInitial = user?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const isCustomer = isCustomerUser(user);
  const profileReminder = profileReminderDismissed ? null : readGoogleProfileReminder(user);
  const needsProfileCompletion = Boolean(profileReminder?.missingFields?.length);
  const mainMenuItems = [
    { label: 'หน้าหลัก', path: '/' },
    { label: 'สินค้า', path: '/products' },
    { label: 'ข่าว', path: '/news' },
  ];

  function isActivePath(path) {
    return path === '/' ? currentPath === '/' : currentPath === path || currentPath.startsWith(`${path}/`);
  }

  const profileMenuItems = [
    { label: 'การสั่งซื้อของฉัน', path: '/order-status' },
    { label: 'บัญชีของฉัน', path: '/profile' },
  ];
  const isAdmin = user?.role === 'admin';
  if (isAdmin) {
    profileMenuItems.unshift({ label: 'แผงผู้ดูแลระบบ', path: '/admin' });
  }

  useEffect(() => {
    const updateCurrentPath = () => setCurrentPath(window.location.hash.slice(1).split('?')[0] || '/');
    window.addEventListener('hashchange', updateCurrentPath);
    return () => window.removeEventListener('hashchange', updateCurrentPath);
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

  function goTo(path) {
    setProfileOpen(false);
    onNavigate(path);
  }

  function closeProfileReminder() {
    clearGoogleProfileReminder();
    setProfileReminderDismissed(true);
  }

  function goToCompleteProfile() {
    closeProfileReminder();
    onNavigate('/profile');
  }

  return (
    <>
      <header className="site-header">
        <div className="site-shell nav-shell">
        <button type="button" className="brand-link" onClick={() => onNavigate('/')}>
          <BrandLogo />
          ห้วยหยวกป่าโซ
        </button>

        <nav className="main-nav" aria-label="เมนูหลัก">
          {mainMenuItems.map((item) => {
            const active = isActivePath(item.path);
            return (
              <button
                type="button"
                key={item.path}
                className={active ? 'active' : undefined}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.path)}
              >
                {item.label}
              </button>
            );
          })}
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
                      <button type="button" role="menuitem" key={item.path} onClick={() => goTo(item.path)}>
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
                      onLogout?.();
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

      {profileReminder && (
        <div
          className="google-profile-alert-backdrop"
          role="presentation"
          onMouseDown={closeProfileReminder}
        >
          <section
            className="google-profile-alert"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="google-profile-alert-title"
            aria-describedby="google-profile-alert-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="google-profile-alert-close"
              aria-label="ปิดการแจ้งเตือน"
              onClick={closeProfileReminder}
            >
              ×
            </button>
            <div
              className={`google-profile-alert-icon${needsProfileCompletion ? '' : ' is-success'}`}
              aria-hidden="true"
            >
              {needsProfileCompletion ? '!' : '✓'}
            </div>
            <p className="google-profile-alert-eyebrow">เข้าสู่ระบบด้วย Google สำเร็จ</p>
            <h2 id="google-profile-alert-title">
              {needsProfileCompletion ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : 'เชื่อมต่อบัญชีสำเร็จ'}
            </h2>
            <p id="google-profile-alert-description">
              {needsProfileCompletion
                ? 'เพื่อใช้สำหรับการติดต่อและจัดส่งสินค้า กรุณาเพิ่มข้อมูลต่อไปนี้ในบัญชีของคุณ'
                : 'บัญชี Google ของคุณเชื่อมต่อและพร้อมใช้งานแล้ว'}
            </p>
            {needsProfileCompletion && (
              <div className="google-profile-alert-fields">
                {profileReminder.missingFields.map((field) => (
                  <span key={field}>• {field}</span>
                ))}
              </div>
            )}
            <div className={`google-profile-alert-actions${needsProfileCompletion ? '' : ' is-complete'}`}>
              {needsProfileCompletion ? (
                <>
                  <button type="button" onClick={closeProfileReminder}>ไว้กรอกภายหลัง</button>
                  <button type="button" autoFocus onClick={goToCompleteProfile}>ไปกรอกข้อมูล</button>
                </>
              ) : (
                <button type="button" autoFocus onClick={closeProfileReminder}>ตกลง</button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}






