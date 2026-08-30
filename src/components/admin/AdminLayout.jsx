import { useEffect, useState } from 'react';
import BrandLogo from '../BrandLogo';
import { fetchAdminContacts, fetchAdminPayments, fetchOrders, fetchProducts } from '../../api/admin';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin.css';

const NOTIFICATION_POLL_MS = 45000;
const SEEN_ORDERS_KEY = 'admin_seen_order_ids';
const SEEN_PAYMENTS_KEY = 'admin_seen_payment_ids';
const OUT_OF_STOCK_PRODUCTS_KEY = 'admin_out_of_stock_product_ids';

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
  { path: '/admin/payment-settings', label: 'ตั้งค่าการชำระเงิน' },
  { path: '/admin/bank-transfer-accounts', label: 'บัญชีรับโอน' },
  { path: '/admin/products', label: 'สินค้า' },
  { path: '/admin/categories', label: 'หมวดหมู่สินค้า' },
  { path: '/admin/shipping-carriers', label: 'บริษัทขนส่ง' },
  { path: '/admin/contacts', label: 'ติดต่อและปัญหา' },
  { path: '/admin/history', label: 'ความเป็นมา' },
  { path: '/admin/news', label: 'ข่าว' },
  { path: '/admin/users', label: 'ผู้ใช้งาน' },
  { path: '/admin/analytics', label: 'วิเคราะห์ข้อมูล' },
].sort((first, second) => {
  if (first.path === '/admin') return -1;
  if (second.path === '/admin') return 1;
  return first.label.localeCompare(second.label, 'th', {
    sensitivity: 'base',
    numeric: true,
  });
});

const PAGE_HEADERS = {
  '/admin/payment-settings': {
    title: 'ตั้งค่าการชำระเงิน',
    subtitle: 'จัดการรูป QR Code หมายเลขพร้อมเพย์ และชื่อบัญชีผู้รับเงิน',
  },
  '/admin/bank-transfer-accounts': {
    title: 'บัญชีรับโอน',
    subtitle: 'เพิ่ม แก้ไข ลบ และกำหนดสถานะบัญชีธนาคารสำหรับรับโอนเงิน',
  },
  '/admin': {
    title: 'Dashboard',
    subtitle: 'ภาพรวมสถิติและข้อมูลธุรกิจ',
  },
  '/admin/dashboard': {
    title: 'Dashboard',
    subtitle: 'ภาพรวมสถิติและข้อมูลธุรกิจ',
  },
  '/reports': {
    title: 'รายงานสรุปผลงาน',
    subtitle: 'ศูนย์รายงานยอดขาย สินค้า สต็อก และพฤติกรรมลูกค้า',
  },
  '/admin/reports': {
    title: 'รายงานสรุปผลงาน',
    subtitle: 'ศูนย์รายงานยอดขาย สินค้า สต็อก และพฤติกรรมลูกค้า',
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
  '/admin/contacts': {
    title: 'ติดต่อและปัญหา',
    subtitle: 'ตรวจสอบและตอบกลับข้อความจากผู้ใช้งาน',
  },
  '/admin/history': {
    title: 'ความเป็นมา',
    subtitle: 'แก้ไขเนื้อหาเรื่องราวของชุมชนที่แสดงบนหน้าแรก',
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
  const [notificationCounts, setNotificationCounts] = useState({ orders: 0, payments: 0, products: 0, contacts: 0 });
  const [notification, setNotification] = useState(null);
  const activePath = route === '/admin/dashboard' ? '/admin' : (route === '/reports' ? '/admin/reports' : route);
  const pageHeader = PAGE_HEADERS[route] || PAGE_HEADERS['/admin'];

  const handleNavigate = (path) => {
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  useEffect(() => {
    let active = true;
    let polling = false;
    let initialCheck = true;

    async function checkNotifications() {
      if (!sessionValidated || polling || document.visibilityState === 'hidden') return;
      polling = true;

      try {
        const [orders, payments, products, contacts] = await Promise.all([
          fetchOrders(),
          fetchAdminPayments(),
          fetchProducts(),
          fetchAdminContacts(),
        ]);
        if (!active) return;

        const pendingOrders = orders.filter((order) => order.order_status === 'pending');
        const pendingPayments = payments.filter((payment) => payment.payment_status === 'pending');
        const outOfStockProducts = products.filter(
          (product) => product.status === 'active' && Number(product.stock_quantity || 0) <= 0,
        );
        const nextCounts = {
          orders: pendingOrders.length,
          payments: pendingPayments.length,
          products: outOfStockProducts.length,
          contacts: contacts.filter((item) => ['new', 'read'].includes(item.status)).length,
        };
        setNotificationCounts((prev) => {
          if (
            prev &&
            prev.orders === nextCounts.orders &&
            prev.payments === nextCounts.payments &&
            prev.products === nextCounts.products &&
            prev.contacts === nextCounts.contacts
          ) {
            return prev;
          }
          return nextCounts;
        });

        const currentOrderIds = new Set(orders.map((order) => String(order.order_id)));
        const currentPaymentIds = new Set(payments.map((payment) => String(payment.payment_id)));
        const seenOrderIds = readSeenIds(SEEN_ORDERS_KEY);
        const seenPaymentIds = readSeenIds(SEEN_PAYMENTS_KEY);
        const previousOutOfStockIds = readSeenIds(OUT_OF_STOCK_PRODUCTS_KEY);
        const hasOrderBaseline = sessionStorage.getItem(SEEN_ORDERS_KEY) !== null;
        const hasPaymentBaseline = sessionStorage.getItem(SEEN_PAYMENTS_KEY) !== null;
        const hasStockBaseline = sessionStorage.getItem(OUT_OF_STOCK_PRODUCTS_KEY) !== null;
        const newOrders = hasOrderBaseline
          ? orders.filter((order) => !seenOrderIds.has(String(order.order_id)))
          : [];
        const newPayments = hasPaymentBaseline
          ? payments.filter((payment) => !seenPaymentIds.has(String(payment.payment_id)))
          : [];

        const newOutOfStockProducts = hasStockBaseline
          ? outOfStockProducts.filter(
              (product) => !previousOutOfStockIds.has(String(product.product_id)),
            )
          : [];

        saveSeenIds(SEEN_ORDERS_KEY, currentOrderIds);
        saveSeenIds(SEEN_PAYMENTS_KEY, currentPaymentIds);
        saveSeenIds(
          OUT_OF_STOCK_PRODUCTS_KEY,
          new Set(outOfStockProducts.map((product) => String(product.product_id))),
        );

        if (initialCheck) {
          initialCheck = false;
          if (pendingOrders.length || pendingPayments.length || outOfStockProducts.length) {
            setNotification({
              orders: pendingOrders.length,
              payments: pendingPayments.length,
              products: outOfStockProducts,
            });
          }
        } else if (newOrders.length || newPayments.length || newOutOfStockProducts.length) {
          setNotification({
            orders: newOrders.length,
            payments: newPayments.length,
            products: newOutOfStockProducts,
          });
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
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sessionValidated]);

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar${mobileMenuOpen ? ' is-menu-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <BrandLogo className="brand-logo-admin" />
          <div>
            <h2>ห้วยหยวกป่าโซ</h2>
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
              {item.path === '/admin/products' && notificationCounts.products > 0 ? (
                <span className="admin-nav-badge">{notificationCounts.products > 99 ? '99+' : notificationCounts.products}</span>
              ) : null}
              {item.path === '/admin/contacts' && notificationCounts.contacts > 0 ? (
                <span className="admin-nav-badge">{notificationCounts.contacts > 99 ? '99+' : notificationCounts.contacts}</span>
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
        <div className="admin-notification-backdrop" role="presentation">
          <section
            className="admin-notification-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-notification-title"
            aria-describedby="admin-notification-description"
          >
            <button type="button" className="admin-notification-close" aria-label="ปิดการแจ้งเตือน" onClick={() => setNotification(null)}>×</button>
            <div className="admin-notification-icon" aria-hidden="true">!</div>
            <p className="admin-notification-eyebrow">แจ้งเตือนรายการใหม่</p>
            <h2 id="admin-notification-title">มีรายการใหม่เข้ามา</h2>
            <div id="admin-notification-description" className="admin-notification-summary">
              {notification.orders > 0 ? <p>คำสั่งซื้อใหม่ <strong>{notification.orders}</strong> รายการ</p> : null}
              {notification.payments > 0 ? <p>ธุรกรรมใหม่ <strong>{notification.payments}</strong> รายการ</p> : null}
              {notification.products?.length > 0 ? (
                <div className="admin-stock-notification-list">
                  <p>สินค้าสต๊อกหมด <strong>{notification.products.length}</strong> รายการ</p>
                  <ul>
                    {notification.products.map((product) => (
                      <li key={product.product_id}>{product.product_name || `สินค้า ${product.product_id}`}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="admin-notification-actions">
              {notification.orders > 0 ? <button type="button" onClick={() => { setNotification(null); handleNavigate('/admin/orders'); }}>ดูคำสั่งซื้อ</button> : null}
              {notification.payments > 0 ? <button type="button" onClick={() => { setNotification(null); handleNavigate('/admin/transactions'); }}>ดูธุรกรรม</button> : null}
              {notification.products?.length > 0 ? <button type="button" onClick={() => { setNotification(null); handleNavigate('/admin/products'); }}>ดูสินค้า</button> : null}
              <button type="button" className="is-dismiss" onClick={() => setNotification(null)}>รับทราบ</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
