import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import {
  createShippingCarrier,
  deleteShippingCarrier,
  fetchShippingCarriers,
  updateShippingCarrier,
} from '../../api/admin';

const EMPTY_FORM = { carrier_name: '', tracking_url: '', description: '', status: 'active' };

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function buildPayload(form) {
  return {
    carrier_name: form.carrier_name.trim(),
    tracking_url: form.tracking_url.trim() || null,
    description: form.description.trim() || null,
    status: form.status,
  };
}

export default function ShippingCarriers() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadItems() {
      try {
        setItems(await fetchShippingCarriers());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = normalize(filters.search);
    return items.filter((item) => {
      const matchesSearch = !keyword
        || normalize(item.carrier_name).includes(keyword)
        || normalize(item.description).includes(keyword);
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      return matchesSearch && matchesStatus;
    });
  }, [filters, items]);

  const pagination = usePagination(filteredItems, 10, [filters]);

  function openCreateForm() {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setFormOpen(true);
  }

  function openEditForm(item) {
    setEditingItem(item);
    setForm({
      carrier_name: item.carrier_name || '',
      tracking_url: item.tracking_url || '',
      description: item.description || '',
      status: item.status || 'active',
    });
    setError('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = editingItem
        ? await updateShippingCarrier(editingItem.carrier_id, buildPayload(form))
        : await createShippingCarrier(buildPayload(form));
      setItems((current) => (editingItem
        ? current.map((item) => (item.carrier_id === saved.carrier_id ? saved : item))
        : [saved, ...current]));
      setFormOpen(false);
      setEditingItem(null);
      setForm({ ...EMPTY_FORM });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`ลบบริษัทขนส่ง "${item.carrier_name}" หรือไม่?`)) return;
    setDeletingId(item.carrier_id);
    setError('');
    try {
      await deleteShippingCarrier(item.carrier_id);
      setItems((current) => current.filter((entry) => entry.carrier_id !== item.carrier_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="admin-loading">กำลังโหลดบริษัทขนส่ง...</div>;
  if (error && items.length === 0) return <div className="admin-error">{error}</div>;

  return (
    <>
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="products-toolbar">
        <input
          type="search"
          value={filters.search}
          placeholder="ค้นหาบริษัทขนส่ง..."
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />
        <select
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="active">เปิดใช้งาน</option>
          <option value="inactive">ปิดใช้งาน</option>
        </select>
        <button type="button" onClick={openCreateForm}>เพิ่มบริษัทขนส่ง</button>
      </section>

      <section className="admin-panel products-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-table products-table carrier-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>บริษัทขนส่ง</th>
                <th>ลิงก์ติดตามพัสดุ</th>
                <th>สถานะ</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.length === 0 ? (
                <tr><td colSpan={5} className="admin-table-empty">ไม่พบบริษัทขนส่ง</td></tr>
              ) : pagination.pageItems.map((item, index) => (
                <tr key={item.carrier_id}>
                  <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                  <td>
                    <div className="carrier-name-cell">
                      <strong>{item.carrier_name}</strong>
                      <span>{item.description || '-'}</span>
                    </div>
                  </td>
                  <td>
                    {item.tracking_url ? (
                      <a href={item.tracking_url} target="_blank" rel="noreferrer" className="carrier-tracking-link">
                        เปิดหน้าติดตาม
                      </a>
                    ) : '-'}
                  </td>
                  <td>
                    <span className={`news-status-badge news-status-${item.status === 'active' ? 'published' : 'draft'}`}>
                      {item.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td>
                    <div className="products-actions">
                      <button type="button" className="products-edit-button" onClick={() => openEditForm(item)}>แก้ไข</button>
                      <button
                        type="button"
                        className="products-delete-button"
                        disabled={deletingId === item.carrier_id}
                        onClick={() => handleDelete(item)}
                      >
                        {deletingId === item.carrier_id ? 'กำลังลบ...' : 'ลบ'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          className="admin-pagination"
        />
      </section>

      {formOpen ? (
        <div className="products-modal-backdrop" role="presentation" onMouseDown={closeForm}>
          <form className="products-modal carrier-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
            <header className="products-modal-header">
              <h2>{editingItem ? 'แก้ไขบริษัทขนส่ง' : 'เพิ่มบริษัทขนส่ง'}</h2>
              <button type="button" aria-label="ปิด" onClick={closeForm}>×</button>
            </header>
            <div className="products-form-grid">
              <label className="products-form-wide">
                ชื่อบริษัทขนส่ง
                <input
                  value={form.carrier_name}
                  maxLength={120}
                  required
                  onChange={(event) => setForm((current) => ({ ...current, carrier_name: event.target.value }))}
                />
              </label>
              <label className="products-form-wide">
                URL ติดตามพัสดุ
                <input
                  type="url"
                  value={form.tracking_url}
                  maxLength={255}
                  placeholder="https://..."
                  onChange={(event) => setForm((current) => ({ ...current, tracking_url: event.target.value }))}
                />
              </label>
              <label>
                สถานะ
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="active">เปิดใช้งาน</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </select>
              </label>
              <label className="products-form-wide">
                รายละเอียด
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
            </div>
            <footer className="products-modal-actions">
              <button type="submit" className="products-save-button" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button type="button" className="products-cancel-button" disabled={saving} onClick={closeForm}>ยกเลิก</button>
            </footer>
          </form>
        </div>
      ) : null}
    </>
  );
}
