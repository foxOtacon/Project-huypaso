import { useState } from 'react';
import CustomerNavbar from '../components/CustomerNavbar';
import './ContactPage.css';

const CONTACT_ITEMS = [
  {
    icon: 'pin',
    label: 'ที่อยู่',
    lines: ['ชุมชนห้วยหยวกป่าโซ', 'บ้านห้วยหยวก ตำบลแม่แรม อำเภอแม่ริม จังหวัดเชียงใหม่ 50180'],
  },
  { icon: 'phone', label: 'โทรศัพท์', lines: ['08X-XXX-XXXX'], href: 'tel:08XXXXXXXX' },
  { icon: 'mail', label: 'อีเมล', lines: ['contact@huayyuak.com'], href: 'mailto:contact@huayyuak.com' },
];

function ContactIcon({ name }) {
  const paths = {
    pin: <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    phone: <path d="M7 3H4.8A1.8 1.8 0 0 0 3 4.8C3 13.75 10.25 21 19.2 21a1.8 1.8 0 0 0 1.8-1.8V17l-4.4-1-1.1 2.1a14.8 14.8 0 0 1-9.6-9.6L8 7.4 7 3Z" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function ContactPage({ user, onNavigate, onLogout }) {
  const [form, setForm] = useState({ name: user?.full_name || '', email: user?.email || '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  function updateField(event) {
    setSent(false);
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    (async () => {
      try {
        const res = await fetch((import.meta.env.VITE_API_URL || '/api') + '/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('ไม่สามารถส่งข้อความได้');
        setSent(true);
        setForm((current) => ({ ...current, subject: '', message: '' }));
      } catch (err) {
        // keep UI simple: mark as not sent and surface nothing more here
        setSent(false);
        alert(err.message || 'เกิดข้อผิดพลาดขณะส่งข้อความ');
      }
    })();
  }

  return (
    <div className="contact-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <header className="contact-hero">
        <div>
          <p>พูดคุยกับชุมชนของเรา</p>
          <h1>ยินดีช่วยเหลือ<br />ทุกเรื่องที่คุณอยากรู้</h1>
          <span>สอบถามสินค้า การสั่งซื้อ หรือแบ่งปันข้อเสนอแนะกับเราได้ทุกเมื่อ</span>
          <div className="contact-hero-highlights">
            <span>สอบถามสินค้า</span>
            <span>ติดตามคำสั่งซื้อ</span>
            <span>ร่วมงานกับชุมชน</span>
          </div>
        </div>
      </header>

      <main className="contact-main">
        <section className="contact-information">
          <p className="contact-eyebrow">GET IN TOUCH</p>
          <h2>ข้อมูลการติดต่อ</h2>
          <p className="contact-intro">หากมีข้อสงสัยเกี่ยวกับสินค้า หรือการสั่งซื้อ สามารถติดต่อเราได้ตามช่องทางด้านล่าง</p>

          <div className="contact-list">
            {CONTACT_ITEMS.map((item) => (
              <article key={item.label} className="contact-item">
                <span className="contact-icon"><ContactIcon name={item.icon} /></span>
                <div>
                  <h3>{item.label}</h3>
                  {item.lines.map((line) => item.href ? <a key={line} href={item.href}>{line}</a> : <p key={line}>{line}</p>)}
                </div>
              </article>
            ))}
          </div>
          <div className="contact-hours">
            <span>เวลาทำการ</span>
            <strong>จันทร์–เสาร์ · 08:30–17:00 น.</strong>
            <p>ข้อความนอกเวลาทำการจะได้รับการตอบกลับในวันถัดไป</p>
          </div>
        </section>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="contact-form-heading">
            <p>ส่งข้อความหาเรา</p>
            <h2>ส่งข้อความถึงเรา</h2>
            <span>กรอกข้อมูลด้านล่าง ทีมงานจะติดต่อกลับโดยเร็วที่สุด</span>
          </div>

          {sent ? <div className="contact-success" role="status">ส่งข้อความเรียบร้อยแล้ว เราจะติดต่อกลับโดยเร็วที่สุด</div> : null}

          <label>ชื่อ - นามสกุล<input name="name" value={form.name} onChange={updateField} placeholder="ชื่อของคุณ" required /></label>
          <label>อีเมล<input name="email" type="email" value={form.email} onChange={updateField} placeholder="example@email.com" required /></label>
          <label>หัวข้อ<input name="subject" value={form.subject} onChange={updateField} placeholder="เรื่องที่ต้องการติดต่อ" required /></label>
          <label>ข้อความ<textarea name="message" rows="5" value={form.message} onChange={updateField} placeholder="พิมพ์ข้อความของคุณ..." required /></label>
          <button type="submit">ส่งข้อความ <span aria-hidden="true">→</span></button>
          <p className="contact-assurance">เราจะใช้ข้อมูลของคุณเพื่อติดต่อกลับเกี่ยวกับข้อความนี้เท่านั้น</p>
        </form>
      </main>
    </div>
  );
}
