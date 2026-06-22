import './CustomerAccountPage.css';

const pageContent = {
  '/payment': {
    eyebrow: 'Payment',
    title: 'หน้าชำระเงิน',
    description: 'ตรวจสอบยอดชำระ เลือกวิธีชำระเงิน และอัปโหลดหลักฐานการโอนเงิน',
    status: 'รอเลือกคำสั่งซื้อ',
    steps: ['เลือกคำสั่งซื้อที่ต้องการชำระ', 'เลือก PromptPay หรือโอนผ่านธนาคาร', 'แนบสลิปและส่งตรวจสอบ'],
  },
  '/order-status': {
    eyebrow: 'Orders',
    title: 'สถานะคำสั่งซื้อ',
    description: 'ติดตามคำสั่งซื้อของคุณตั้งแต่รอจัดเตรียมสินค้าไปจนถึงจัดส่งสำเร็จ',
    status: 'ยังไม่มีคำสั่งซื้อที่กำลังดำเนินการ',
    steps: ['รอตรวจสอบคำสั่งซื้อ', 'กำลังจัดเตรียมสินค้า', 'จัดส่งหรือรับสินค้าเรียบร้อย'],
  },
  '/payment-status': {
    eyebrow: 'Payment Status',
    title: 'สถานะชำระเงิน',
    description: 'ดูผลการตรวจสอบสลิปและสถานะอนุมัติการชำระเงินจากผู้ดูแลระบบ',
    status: 'ยังไม่มีรายการชำระเงิน',
    steps: ['รอตรวจสอบ', 'อนุมัติการชำระเงิน', 'แจ้งผลกลับไปยังคำสั่งซื้อ'],
  },
};

export default function CustomerAccountPage({ route, user, onNavigate, onLogout }) {
  const content = pageContent[route] || pageContent['/payment'];

  return (
    <div className="customer-page">
      <header className="customer-header">
        <button type="button" className="customer-brand" onClick={() => onNavigate('/')}>
          ห้วยหยวกปากโจ้
        </button>

        <div className="customer-user">
          <span>{user?.full_name}</span>
          <button type="button" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="customer-main">
        <section className="customer-hero-panel">
          <p>{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <span>{content.description}</span>
        </section>

        <section className="customer-status-card">
          <div>
            <p>สถานะล่าสุด</p>
            <h2>{content.status}</h2>
          </div>
          <button type="button">รีเฟรชสถานะ</button>
        </section>

        <section className="customer-flow">
          {content.steps.map((step, index) => (
            <article key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
