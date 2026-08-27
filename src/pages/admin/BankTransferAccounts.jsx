import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import { THAI_BANKS } from '../../utils/thaiBanks';
import { createBankTransferAccount, deleteBankTransferAccount, fetchBankTransferAccounts, updateBankTransferAccount } from '../../api/admin';

const EMPTY = { bank_name: '', account_number: '', account_name: '', status: 'active' };

export default function BankTransferAccounts() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    fetchBankTransferAccounts().then(setItems).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !query || [item.bank_name, item.account_number, item.account_name].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);
  const pagination = usePagination(filteredItems, 10, [search, statusFilter]);

  const activeCount = items.filter((item) => item.status === 'active').length;
  const inactiveCount = items.filter((item) => item.status !== 'active').length;

  function reset() { setForm(EMPTY); setEditingId(null); setError(''); }
  function edit(item) {
    setForm({ bank_name: item.bank_name, account_number: item.account_number, account_name: item.account_name, status: item.status });
    setEditingId(item.bank_transfer_account_id);
    setError('');
    setIsFormOpen(true);
  }
  function handleAddAccount() {
    reset();
    setIsFormOpen(true);
  }
  function closeForm() {
    setIsFormOpen(false);
    reset();
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    const payload = { ...form, bank_name: form.bank_name.trim(), account_number: form.account_number.trim(), account_name: form.account_name.trim() };
    try {
      const saved = editingId ? await updateBankTransferAccount(editingId, payload) : await createBankTransferAccount(payload);
      setItems((current) => editingId ? current.map((item) => item.bank_transfer_account_id === saved.bank_transfer_account_id ? saved : item) : [saved, ...current]);
      closeForm();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function remove(id) {
    if (!window.confirm('ต้องการลบบัญชีนี้หรือไม่?')) return;
    try { await deleteBankTransferAccount(id); setItems((current) => current.filter((item) => item.bank_transfer_account_id !== id)); }
    catch (err) { setError(err.message); }
  }

  async function toggleStatus(item) {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    const payload = {
      bank_name: item.bank_name,
      account_number: item.account_number,
      account_name: item.account_name,
      status: nextStatus,
    };

    try {
      const updated = await updateBankTransferAccount(item.bank_transfer_account_id, payload);
      setItems((current) => current.map((entry) => entry.bank_transfer_account_id === updated.bank_transfer_account_id ? updated : entry));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="admin-loading">กำลังโหลดบัญชีธนาคาร...</div>;

  return (
    <div className="admin-bank-transfer-page admin-carriers-page">
      <section className="admin-bank-transfer-stat-grid">
        <article>
          <span>บัญชีทั้งหมด</span>
          <strong>{items.length}</strong>
        </article>
        <article>
          <span>เปิดใช้งาน</span>
          <strong>{activeCount}</strong>
        </article>
        <article>
          <span>ปิดใช้งาน</span>
          <strong>{inactiveCount}</strong>
        </article>
        <article>
          <span>ผลลัพธ์การค้นหา</span>
          <strong>{filteredItems.length}</strong>
        </article>
      </section>

      <section className="products-toolbar admin-bank-transfer-toolbar">
        <div className="admin-bank-transfer-toolbar-heading admin-carriers-toolbar-heading">
          <div>
            <span>Bank Transfer</span>
            <h2>บัญชีรับโอน</h2>
          </div>
          <strong>{filteredItems.length} รายการ</strong>
        </div>

        <div className="admin-bank-transfer-toolbar-controls">
          <input
            type="search"
            value={search}
            placeholder="ค้นหาธนาคาร / เลขบัญชี / ชื่อบัญชี"
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="กรองตามสถานะ"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
        </div>

        <button type="button" className="admin-bank-transfer-add-button" onClick={handleAddAccount}>เพิ่มบัญชี</button>
      </section>

      <div className="admin-bank-transfer-layout">
        <section className="admin-panel products-table-panel admin-bank-transfer-table-panel">
          <div className="admin-bank-transfer-table-heading admin-carriers-table-heading">
            <div>
              <span>รายการทั้งหมด</span>
              <h2>บัญชีรับโอน</h2>
            </div>
            <p>{filteredItems.length} รายการที่แสดง</p>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table products-table admin-bank-transfer-table">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>ธนาคาร</th>
                  <th>เลขบัญชี</th>
                  <th>ชื่อบัญชี</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {!pagination.pageItems.length ? (
                  <tr><td colSpan="6" className="admin-table-empty">ยังไม่มีบัญชีรับโอน</td></tr>
                ) : pagination.pageItems.map((item, index) => (
                  <tr key={item.bank_transfer_account_id}>
                    <td data-label="ลำดับ">{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                    <td className="admin-table-data-left" data-label="ธนาคาร"><strong>{item.bank_name}</strong></td>
                    <td data-label="เลขบัญชี">{item.account_number}</td>
                    <td data-label="ชื่อบัญชี">{item.account_name}</td>
                    <td data-label="สถานะ">
                      <span className={`bank-transfer-status-badge ${item.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                        {item.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                    </td>
                    <td data-label="จัดการ">
                      <div className="products-actions bank-transfer-row-actions">
                        <button type="button" className="products-edit-button" onClick={() => edit(item)}>แก้ไข</button>
                        <button
                          type="button"
                          className={`bank-transfer-toggle-button ${item.status === 'active' ? 'is-active' : 'is-inactive'}`}
                          onClick={() => toggleStatus(item)}
                        >
                          {item.status === 'active' ? 'ระงับ' : 'เลิกระงับ'}
                        </button>
                        <button type="button" className="products-delete-button" onClick={() => remove(item.bank_transfer_account_id)}>ลบ</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} className="admin-pagination" />
        </section>
      </div>

      {isFormOpen ? (
        <div className="products-modal-backdrop" role="presentation" onMouseDown={closeForm}>
          <form className="products-modal carrier-modal admin-bank-transfer-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <header className="products-modal-header">
              <h2>{editingId ? 'แก้ไขบัญชีรับโอน' : 'เพิ่มบัญชีรับโอน'}</h2>
              <button type="button" aria-label="ปิด" onClick={closeForm}>×</button>
            </header>

            <div className="products-form-grid admin-bank-transfer-modal-grid">
              <label className="products-form-wide">
                ธนาคาร
                <select required value={form.bank_name} onChange={(e) => setForm((v) => ({ ...v, bank_name: e.target.value }))}>
                  <option value="">-- เลือกธนาคาร --</option>
                  {THAI_BANKS.map((bank) => <option key={bank.code} value={bank.name}>{bank.name}</option>)}
                </select>
              </label>

              <label className="products-form-wide">
                เลขบัญชี
                <input required maxLength="50" value={form.account_number} onChange={(e) => setForm((v) => ({ ...v, account_number: e.target.value }))} />
              </label>

              <label className="products-form-wide">
                ชื่อบัญชี
                <input required maxLength="150" value={form.account_name} onChange={(e) => setForm((v) => ({ ...v, account_name: e.target.value }))} />
              </label>

              <label className="products-form-wide">
                สถานะ
                <select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
                  <option value="active">เปิดใช้งาน</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </select>
              </label>

              {error ? <div className="modal-form-alert" role="alert"><span className="modal-form-alert-icon" aria-hidden="true">!</span><span className="modal-form-alert-copy"><strong>บันทึกข้อมูลไม่สำเร็จ</strong><span>{error}</span></span></div> : null}
            </div>

            <footer className="products-modal-actions">
              <button type="submit" className="products-save-button" disabled={saving}>{saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มบัญชี'}</button>
              <button type="button" className="products-cancel-button" disabled={saving} onClick={closeForm}>ยกเลิก</button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
