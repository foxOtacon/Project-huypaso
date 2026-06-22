const PAGE_TITLES = {
  '/admin/orders': 'คำสั่งซื้อ',
  '/admin/transactions': 'ธุรกรรม',
  '/admin/products': 'สินค้า',
  '/admin/users': 'ผู้ใช้งาน',
  '/admin/analytics': 'วิเคราะห์ข้อมูล',
};

export default function AdminPlaceholder({ route }) {
  const title = PAGE_TITLES[route] || 'หน้านี้';

  return (
    <section className="admin-panel admin-placeholder">
      <h2>{title}</h2>
      <p>หน้านี้อยู่ระหว่างการพัฒนา กลับไปที่แดชบอร์ดเพื่อดูข้อมูลภาพรวม</p>
    </section>
  );
}
