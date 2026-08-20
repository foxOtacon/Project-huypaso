import { useEffect, useMemo, useState } from 'react';
import { fetchAdminContact, fetchAdminContacts, replyAdminContact, updateAdminContactStatus } from '../../api/admin';
import { formatAddressForDisplay } from '../../utils/profileAddress';

const STATUS = {
  new: 'รอตรวจสอบ',
  read: 'รอตรวจสอบ',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
};

const CATEGORIES = {
  general: 'สอบถามทั่วไป',
  order: 'คำสั่งซื้อ',
  payment: 'การชำระเงิน',
  shipping: 'การจัดส่ง',
  product: 'สินค้า',
  account: 'บัญชีผู้ใช้',
};

const formatDate = (value) => (value
  ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
  : '-');
const formatHeaderDate = () => new Date().toLocaleDateString('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default function Contacts({ user }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await fetchAdminContacts());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchAdminContacts()
      .then((rows) => { if (active) setItems(rows); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = items;

  const counts = {
    all: items.length,
    new: items.filter((item) => ['new', 'read'].includes(item.status)).length,
    in_progress: items.filter((item) => item.status === 'in_progress').length,
    resolved: items.filter((item) => item.status === 'resolved').length,
  };
  const statCards = [
    { key: 'all', label: 'ทั้งหมด', value: counts.all },
    { key: 'new', label: 'รอตรวจสอบ', value: counts.new },
    { key: 'in_progress', label: 'กำลังดำเนินการ', value: counts.in_progress },
    { key: 'resolved', label: 'แก้ไขแล้ว', value: counts.resolved },
  ];

  async function open(id) {
    try {
      setSelected(await fetchAdminContact(id));
      setReply('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(status) {
    try {
      setSaving(true);
      await updateAdminContactStatus(selected.contact_id, status);
      setSelected((current) => ({ ...current, status }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!reply.trim()) return;
    try {
      setSaving(true);
      setSelected(await replyAdminContact(selected.contact_id, reply));
      setReply('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="admin-loading">กำลังโหลดรายการติดต่อ...</div>;

  return (
    <div className="admin-contacts-page">
      <section className="admin-contact-titlebar">
        <div>
          <h1>ติดต่อและปัญหา</h1>
          <p>ตรวจสอบและตอบกลับข้อความจากผู้ใช้งาน</p>
        </div>
        <div className="admin-contact-user-summary">
          <strong>{user?.full_name || user?.email || 'ผู้ดูแลระบบ'}</strong>
          <span>{formatHeaderDate()}</span>
        </div>
      </section>

      {error ? <div className="admin-error">{error}</div> : null}

      <section className="admin-contact-stats">
        {statCards.map((card) => (
          <article key={card.key}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel admin-contact-panel">
        <div className="admin-contact-heading">
          <div>
            <span>SUPPORT</span>
            <h2>รายการติดต่อและปัญหา</h2>
          </div>
          <p>{visible.length} รายการ</p>
        </div>
        <div className="admin-contact-list">
          {visible.length ? visible.map((item) => (
            <button type="button" key={item.contact_id} onClick={() => open(item.contact_id)}>
              <div>
                <strong>Ticket #{item.contact_id} · {item.subject || CATEGORIES[item.category]}</strong>
                <span>{item.name} · {item.email}</span>
                <small>{CATEGORIES[item.category] || item.category}{item.order_id ? ` · คำสั่งซื้อ #${item.order_id}` : ''} · {formatDate(item.created_at)}</small>
              </div>
              <b className={`admin-contact-status is-${item.status}`}>{STATUS[item.status] || item.status}</b>
            </button>
          )) : <div className="admin-table-empty">ไม่พบรายการติดต่อ</div>}
        </div>
      </section>

      {selected ? (
        <div className="admin-contact-backdrop" onMouseDown={() => setSelected(null)}>
          <section className="admin-contact-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>Ticket #{selected.contact_id}</p>
                <h2>{selected.subject || CATEGORIES[selected.category]}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)}>×</button>
            </header>
            <div className="admin-contact-meta">
              <span>{selected.name}</span>
              <span>{selected.email}</span>
              <span>{CATEGORIES[selected.category]}</span>
              {selected.order_id ? <span>คำสั่งซื้อ #{selected.order_id}</span> : null}
              <select value={selected.status === 'read' ? 'new' : selected.status} disabled={saving} onChange={(event) => changeStatus(event.target.value)}>
                <option value="new">รอตรวจสอบ</option>
                <option value="in_progress">กำลังดำเนินการ</option>
                <option value="resolved">แก้ไขแล้ว</option>
              </select>
            </div>
            <section className="admin-contact-user-info">
              <div><span>ชื่อผู้ติดต่อ</span><strong>{selected.account_name || selected.name || '-'}</strong></div>
              <div><span>อีเมล</span><strong>{selected.account_email || selected.email || '-'}</strong></div>
              <div><span>เบอร์โทร</span><strong>{selected.account_phone || 'ไม่ได้ระบุ'}</strong></div>
              <div className="is-address"><span>ที่อยู่</span><strong>{formatAddressForDisplay(selected.account_address) || 'ไม่ได้ระบุ'}</strong></div>
            </section>
            <div className="admin-contact-thread">
              <article className="is-customer"><strong>{selected.name}</strong><p>{selected.message}</p><small>{formatDate(selected.created_at)}</small></article>
              {selected.replies?.map((item) => (
                <article key={item.reply_id} className={item.sender_role === 'admin' ? 'is-admin' : 'is-customer'}>
                  <strong>{item.sender_role === 'admin' ? (item.sender_name || 'ผู้ดูแลระบบ') : (item.sender_name || selected.name)}</strong>
                  <p>{item.message}</p>
                  <small>{formatDate(item.created_at)}</small>
                </article>
              ))}
            </div>
            <form onSubmit={sendReply} className="admin-contact-reply">
              <textarea rows="4" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="พิมพ์ข้อความตอบกลับผู้ใช้..." />
              <button disabled={saving || !reply.trim()}>{saving ? 'กำลังส่ง...' : 'ส่งข้อความตอบกลับ'}</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}


