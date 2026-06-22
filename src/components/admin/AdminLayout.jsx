import '../../styles/admin.css';

const MENU_ITEMS = [
  { path: '/admin', label: 'แดชบอร์ด' },
  { path: '/admin/orders', label: 'คำสั่งซื้อ' },
  { path: '/admin/transactions', label: 'ธุรกรรม' },
  { path: '/admin/products', label: 'สินค้า' },
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
  const activePath = route === '/admin/dashboard' ? '/admin' : route;
  const pageHeader = PAGE_HEADERS[route] || PAGE_HEADERS['/admin'];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <h2>ห้วยหยวกป่าโซ</h2>
          <p>Admin Panel</p>
        </div>

        <nav className="admin-nav">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`admin-nav-item${activePath === item.path ? ' active' : ''}`}
              onClick={() => onNavigate(item.path)}
            >
              <span className="admin-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
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
    </div>
  );
}
