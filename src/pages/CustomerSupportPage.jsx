import { useEffect, useMemo, useState } from 'react';
import { createContactTicket, fetchContactTicket, fetchMyContactTickets, replyContactTicket } from '../api/contact';
import CustomerNavbar from '../components/CustomerNavbar';
import './CustomerSupportPage.css';

const STATUS_LABELS = {
  new: 'รอตรวจสอบ',
  read: 'รอตรวจสอบ',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
};

const CATEGORIES = [
  { value: 'general', label: 'สอบถามทั่วไป' },
  { value: 'order', label: 'คำสั่งซื้อ' },
  { value: 'payment', label: 'การชำระเงิน' },
  { value: 'shipping', label: 'การจัดส่ง' },
  { value: 'product', label: 'สินค้า' },
  { value: 'account', label: 'บัญชีผู้ใช้' },
];

const CATEGORY_LABELS = CATEGORIES.reduce((map, item) => ({ ...map, [item.value]: item.label }), {});

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function emptyForm(user) {
  return {
    name: user?.full_name || '',
    email: user?.email || '',
    category: 'general',
    subject: '',
    message: '',
  };
}

export default function CustomerSupportPage({ user, onNavigate, onLogout, onSupportViewed }) {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(() => emptyForm(user));
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const stats = useMemo(() => ({
    total: tickets.length,
    waiting: tickets.filter((ticket) => ['new', 'read'].includes(ticket.status)).length,
    active: tickets.filter((ticket) => ticket.status === 'in_progress').length,
  }), [tickets]);

  async function loadTickets() {
    try {
      setLoading(true);
      setError('');
      setTickets(await fetchMyContactTickets());
    } catch (err) {
      setError(err.message || 'ไม่สามารถโหลดรายการสอบถามได้');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  function updateField(event) {
    setMessage('');
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitTicket(event) {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setError('');
      const created = await createContactTicket(form);
      setForm(emptyForm(user));
      setMessage('ส่งเรื่องสอบถามเรียบร้อยแล้ว');
      await loadTickets();
      setSelected(await fetchContactTicket(created.contact_id));
    } catch (err) {
      setError(err.message || 'ไม่สามารถส่งเรื่องสอบถามได้');
    } finally {
      setSaving(false);
    }
  }

  async function openTicket(ticketId) {
    try {
      setError('');
      const ticket = await fetchContactTicket(ticketId);
      setSelected(ticket);
      setReply('');
      onSupportViewed?.([{
        contact_id: ticketId,
        last_reply_at: ticket?.last_reply_at || ticket?.updated_at || new Date().toISOString(),
      }]);
    } catch (err) {
      setError(err.message || 'ไม่สามารถโหลดรายละเอียดได้');
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    if (!reply.trim() || !selected || saving) return;

    try {
      setSaving(true);
      setError('');
      setSelected(await replyContactTicket(selected.contact_id, reply));
      setReply('');
      setMessage('ส่งข้อความตอบกลับแล้ว');
      await loadTickets();
    } catch (err) {
      setError(err.message || 'ไม่สามารถส่งข้อความตอบกลับได้');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="support-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="support-main">
        <section className="support-hero">
          <h1>สอบถาม/แจ้งปัญหา</h1>
          <span>ส่งเรื่องถึงแอดมินและติดตามคำตอบของคุณได้ในหน้าเดียว</span>
        </section>

        {error ? <div className="support-alert error">{error}</div> : null}
        {message ? <div className="support-alert success">{message}</div> : null}

        <section className="support-stats" aria-label="สรุปรายการสอบถาม">
          <article><span>ทั้งหมด</span><strong>{stats.total}</strong></article>
          <article><span>รอตรวจสอบ</span><strong>{stats.waiting}</strong></article>
          <article><span>กำลังดำเนินการ</span><strong>{stats.active}</strong></article>
        </section>

        <section className="support-layout">
          <form className="support-card support-form" onSubmit={submitTicket}>
            <div className="support-card-head">
              <h2>ส่งเรื่องใหม่</h2>
            </div>

            <label>ชื่อ - นามสกุล<input name="name" value={form.name} onChange={updateField} required /></label>
            <label>อีเมล<input name="email" type="email" value={form.email} onChange={updateField} required /></label>
            <label>ประเภท<select name="category" value={form.category} onChange={updateField}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="is-wide">หัวข้อ<input name="subject" value={form.subject} onChange={updateField} placeholder="สรุปเรื่องที่ต้องการสอบถาม" /></label>
            <label className="is-wide">รายละเอียด<textarea name="message" rows="6" value={form.message} onChange={updateField} placeholder="พิมพ์รายละเอียดปัญหาหรือคำถามของคุณ..." required /></label>
            <button type="submit" disabled={saving}>{saving ? 'กำลังส่ง...' : 'ส่งเรื่องสอบถาม'}</button>
          </form>

          <section className="support-card support-list-card">
            <div className="support-card-head">
              <h2>รายการสอบถามของฉัน</h2>
            </div>

            {loading ? <div className="support-empty">กำลังโหลดรายการ...</div> : null}
            {!loading && !tickets.length ? <div className="support-empty">ยังไม่มีรายการสอบถาม</div> : null}
            <div className="support-ticket-list">
              {tickets.map((ticket) => (
                <button type="button" key={ticket.contact_id} className={selected?.contact_id === ticket.contact_id ? 'active' : undefined} onClick={() => openTicket(ticket.contact_id)}>
                  <span>Ticket #{ticket.contact_id}</span>
                  <strong>{ticket.subject || CATEGORY_LABELS[ticket.category] || 'สอบถาม'}</strong>
                  <small>{CATEGORY_LABELS[ticket.category] || ticket.category} · {formatDate(ticket.created_at)}</small>
                  <b className={`is-${ticket.status}`}>{STATUS_LABELS[ticket.status] || ticket.status}</b>
                </button>
              ))}
            </div>
          </section>
        </section>
      </main>

      {selected ? (
        <div className="support-modal-backdrop" onMouseDown={() => setSelected(null)}>
          <section className="support-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>Ticket #{selected.contact_id}</p>
                <h2>{selected.subject || CATEGORY_LABELS[selected.category] || 'รายละเอียดการสอบถาม'}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="ปิด">×</button>
            </header>
            <div className="support-modal-meta">
              <span>{CATEGORY_LABELS[selected.category] || selected.category}</span><b className={`is-${selected.status}`}>{STATUS_LABELS[selected.status] || selected.status}</b>
            </div>
            <div className="support-thread">
              <article className="is-customer">
                <strong>{selected.name}</strong>
                <p>{selected.message}</p>
                <small>{formatDate(selected.created_at)}</small>
              </article>
              {selected.replies?.map((item) => (
                <article key={item.reply_id} className={item.sender_role === 'admin' ? 'is-admin' : 'is-customer'}>
                  <strong>{item.sender_role === 'admin' ? (item.sender_name || 'ผู้ดูแลระบบ') : (item.sender_name || selected.name)}</strong>
                  <p>{item.message}</p>
                  <small>{formatDate(item.created_at)}</small>
                </article>
              ))}
            </div>
            <form className="support-reply" onSubmit={submitReply}>
              <textarea rows="4" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="พิมพ์ข้อความตอบกลับแอดมิน..." />
              <button type="submit" disabled={saving || !reply.trim()}>{saving ? 'กำลังส่ง...' : 'ส่งข้อความตอบกลับ'}</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}




