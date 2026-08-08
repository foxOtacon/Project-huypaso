import { useEffect, useRef, useState } from 'react';
import BrandLogo from '../BrandLogo';
import { fetchAdminPayments, fetchOrders } from '../../api/admin';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin.css';

const NOTIFICATION_POLL_MS = 15000;
const SEEN_ORDERS_KEY = 'admin_seen_order_ids';
const SEEN_PAYMENTS_KEY = 'admin_seen_payment_ids';

function readSeenIds(key) {
  try {
    const values = JSON.parse(sessionStorage.getItem(key) || '[]');
    return new Set(Array.isArray(values) ? values.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(key, values) {
  sessionStorage.setItem(key, JSON.stringify([...values].slice(-500)));
}

const MENU_ITEMS = [
  { path: '/admin', label: 'แดชบอร์ด' },
  { path: '/admin/orders', label: 'คำสั่งซื้อ' },
  { path: '/admin/transactions', label: 'ธุรกรรม' },
  { path: '/admin/products', label: 'สินค้า' },
  { path: '/admin/categories', label: 'หมวดหมู่สินค้า' },
  { path: '/admin/shipping-carriers', label: 'บริษัทขนส่ง' },
  { path: '/admin/news', label: 'ข่าว' },
  { path: '/admin/users', label: 'ผู้ใช้งาน' },
  { path: '/admin/analytics', label: 'วิเคราะห์ข้อมูล' },
];

const PAGE_HEADERS = {
  '/admin': {
    title: 'Dashboard',
    subtitle: 'ภาพรวมสถิติและข้อมูลธุรกิจ',
  },
  '/admin/dashboard': {
    title: 'Dashboard',
    subtitle: 'ภาพรวมสถิติและข้อมูลธุรกิจ',
  },
  '/admin/orders': {
    title: 'จัดการคำสั่งซื้อ',
    subtitle: 'ตรวจสอบและจัดการคำสั่งซื้อทั้งหมด',
  },
  '/admin/transactions': {
    title: 'จัดการการชำระเงิน',
    subtitle: 'ตรวจสอบและอนุมัติการชำระเงิน',
  },
  '/admin/products': {
    title: 'สินค้า',
    subtitle: 'จัดการรายการสินค้า',
  },
  '/admin/categories': {
    title: 'หมวดหมู่สินค้า',
    subtitle: 'เพิ่ม แก้ไข และจัดระเบียบหมวดหมู่สินค้า',
  },
  '/admin/shipping-carriers': {
    title: 'บริษัทขนส่ง',
    subtitle: 'จัดการบริษัทขนส่งและลิงก์ติดตามพัสดุ',
  },
  '/admin/news': {
    title: 'ข่าวและประชาสัมพันธ์',
    subtitle: 'จัดการข่าว กิจกรรม และโปรโมชั่นของชุมชน',
  },
  '/admin/users': {
    title: 'จัดการผู้ใช้',
    subtitle: 'แก้ไข และจัดการบัญชีผู้ใช้',
  },
  '/admin/analytics': {
    title: 'วิเคราะห์ข้อมูล',
    subtitle: 'ดูข้อมูลเชิงลึกของระบบ',
  },
};

export default function AdminLayout({ route, user, onNavigate, onLogout, children }) {
  const { sessionValidated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState({ orders: 0, payments: 0 });
  const [notification, setNotification] = useState(null);
  const toastTimerRef = useRef(null);
  const activePath = route === '/admin/dashboard' ? '/admin' : route;
  const pageHeader = PAGE_HEADERS[route] || PAGE_HEADERS['/admin'];

  const handleNavigate = (path) => {
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  useEffect(() => {
    let active = true;
    let polling = false;

    async function checkNotifications() {
      if (!sessionValidated || polling || document.visibilityState === 'hidden') return;
      polling = true;

      try {
        const [orders, payments] = await Promise.all([fetchOrders(), fetchAdminPayments()]);
        if (!active) return;

        const pendingOrders = orders.filter((order) => order.order_status === 'pending');
        const pendingPayments = payments.filter((payment) => payment.payment_status === 'pending');
        setNotificationCounts({ orders: pendingOrders.length, payments: pendingPayments.length });

        const currentOrderIds = new Set(orders.map((order) => String(order.order_id)));
        const currentPaymentIds = new Set(payments.map((payment) => String(payment.payment_id)));
        const seenOrderIds = readSeenIds(SEEN_ORDERS_KEY);
        const seenPaymentIds = readSeenIds(SEEN_PAYMENTS_KEY);
        const hasOrderBaseline = sessionStorage.getItem(SEEN_ORDERS_KEY) !== null;
        const hasPaymentBaseline = sessionStorage.getItem(SEEN_PAYMENTS_KEY) !== null;
        const newOrders = hasOrderBaseline
          ? orders.filter((order) => !seenOrderIds.has(String(order.order_id)))
          : [];
        const newPayments = hasPaymentBaseline
          ? payments.filter((payment) => !seenPaymentIds.has(String(payment.payment_id)))
          : [];

        saveSeenIds(SEEN_ORDERS_KEY, currentOrderIds);
        saveSeenIds(SEEN_PAYMENTS_KEY, currentPaymentIds);

        if (newOrders.length || newPayments.length) {
          setNotification({ orders: newOrders.length, payments: newPayments.length });
          window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setNotification(null), 8000);
        }
      } catch {
        // Individual admin pages display API errors; notification polling stays silent.
      } finally {
        polling = false;
      }
    }

    checkNotifications();
    const interval = window.setInterval(checkNotifications, NOTIFICATION_POLL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkNotifications();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(toastTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sessionValidated]);

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar${mobileMenuOpen ? ' is-menu-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <BrandLogo className="brand-logo-admin" />
          <div>
            <h2>ห้วยหยวกปากโซ</h2>
            <p>Admin Panel</p>
          </div>
        </div>

        <button
          type="button"
          className={`admin-menu-toggle${mobileMenuOpen ? ' is-open' : ''}`}
          aria-label={mobileMenuOpen ? 'ปิดเมนูผู้ดูแลระบบ' : 'เปิดเมนูผู้ดูแลระบบ'}
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="admin-navigation" className={`admin-nav${mobileMenuOpen ? ' is-open' : ''}`}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`admin-nav-item${activePath === item.path ? ' active' : ''}`}
              onClick={() => handleNavigate(item.path)}
            >
              <span className="admin-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {item.path === '/admin/orders' && notificationCounts.orders > 0 ? (
                <span className="admin-nav-badge">{notificationCounts.orders > 99 ? '99+' : notificationCounts.orders}</span>
              ) : null}
              {item.path === '/admin/transactions' && notificationCounts.payments > 0 ? (
                <span className="admin-nav-badge">{notificationCounts.payments > 99 ? '99+' : notificationCounts.payments}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <button type="button" className="admin-logout" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>{pageHeader.title}</h1>
            <p>{pageHeader.subtitle}</p>
          </div>
          <div className="admin-topbar-meta">
            <span className="admin-user-badge">{user?.full_name || 'admin'}</span>
            <span className="admin-date">
              {new Date().toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>

      {notification ? (
        <aside className="admin-notification-toast" role="status" aria-live="polite">
          <button type="button" className="admin-notification-close" aria-label="ปิดการแจ้งเตือน" onClick={() => setNotification(null)}>×</button>
          <div className="admin-notification-icon" aria-hidden="true">!</div>
          <div>
            <strong>มีรายการใหม่เข้ามา</strong>
            {notification.orders > 0 ? <p>คำสั่งซื้อใหม่ {notification.orders} รายการ</p> : null}
            {notification.payments > 0 ? <p>ธุรกรรมรอตรวจสอบ {notification.payments} รายการ</p> : null}
            <div className="admin-notification-actions">
              {notification.orders > 0 ? <button type="button" onClick={() => { setNotification(null); handleNavigate('/admin/orders'); }}>ดูคำสั่งซื้อ</button> : null}
              {notification.payments > 0 ? <button type="button" onClick={() => { setNotification(null); handleNavigate('/admin/transactions'); }}>ดูธุรกรรม</button> : null}
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
