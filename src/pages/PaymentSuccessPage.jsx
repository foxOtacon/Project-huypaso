import './PaymentPage.css';

export default function PaymentSuccessPage({ onNavigate }) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const orderId = params.get('order_id');

  return (
    <div className="payment-page">
      <main className="payment-main payment-success">
        <section>
          <p>Payment Success</p>
          <h1>ชำระเงินสำเร็จ</h1>
          <span>
            {orderId
              ? `ระบบได้รับการยืนยันชำระเงินสำหรับคำสั่งซื้อ ORD${String(orderId).padStart(3, '0')}`
              : 'ระบบได้รับการยืนยันชำระเงินเรียบร้อยแล้ว'}
          </span>
          <div className="payment-success-actions">
            <button type="button" onClick={() => onNavigate('/order-status')}>
              ดูสถานะคำสั่งซื้อ
            </button>
            <button type="button" onClick={() => onNavigate('/products')}>
              เลือกซื้อสินค้าเพิ่ม
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
