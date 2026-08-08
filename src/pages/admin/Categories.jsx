import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import { createCategory, deleteCategory, fetchCategories, fetchProducts, updateCategory } from '../../api/admin';
import { matchesSearch } from '../../utils/search';

const normalize = (value) => String(value || '').trim().toLocaleLowerCase('th');
const DUPLICATE_CATEGORY_MESSAGE = 'ชื่อหมวดหมู่ซ้ำ กรุณาใช้ชื่ออื่น';

function isDuplicateError(error) {
  const message = normalize(error?.message);
  return message.includes('duplicate')
    || message.includes('unique')
    || message.includes('ซ้ำ')
    || error?.status === 409;
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    Promise.all([fetchCategories(), fetchProducts()])
      .then(([categoryRows, productRows]) => {
        setCategories(categoryRows);
        setProducts(productRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const productCounts = useMemo(() => products.reduce((counts, product) => {
    const key = String(product.category_id);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map()), [products]);

  const filtered = useMemo(() => {
    return [...categories]
      .filter((item) => matchesSearch(search, [item.category_name]))
      .sort((a, b) => String(a.category_name).localeCompare(String(b.category_name), 'th'));
  }, [categories, search]);
  const pagination = usePagination(filtered, 10, [search]);
  const usedCount = categories.filter((item) => productCounts.get(String(item.category_id))).length;

  function openForm(category = null) {
    setEditing(category);
    setName(category?.category_name || '');
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setEditing(null);
    setName('');
    setFormError('');
    setFormOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const categoryName = name.trim();
    const duplicate = categories.some((item) => item.category_id !== editing?.category_id
      && normalize(item.category_name) === normalize(categoryName));
    if (duplicate) {
      setFormError(DUPLICATE_CATEGORY_MESSAGE);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const saved = editing
        ? await updateCategory(editing.category_id, { category_name: categoryName })
        : await createCategory({ category_name: categoryName });
      setCategories((current) => editing
        ? current.map((item) => item.category_id === saved.category_id ? saved : item)
        : [saved, ...current]);
      setEditing(null);
      setName('');
      setFormOpen(false);
    } catch (err) {
      if (isDuplicateError(err)) {
        setFormError(DUPLICATE_CATEGORY_MESSAGE);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category) {
    const count = productCounts.get(String(category.category_id)) || 0;
    if (count) {
      setError(`ไม่สามารถลบหมวดหมู่ "${category.category_name}" ได้ เนื่องจากมีสินค้าอยู่ ${count} รายการ`);
      return;
    }
    if (!window.confirm(`ลบหมวดหมู่ "${category.category_name}" หรือไม่?`)) return;
    setDeletingId(category.category_id);
    setError('');
    try {
      await deleteCategory(category.category_id);
      setCategories((current) => current.filter((item) => item.category_id !== category.category_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="admin-loading">กำลังโหลดหมวดหมู่สินค้า...</div>;
  if (error && categories.length === 0) return <div className="admin-error">{error}</div>;

  return (
    <div className="admin-carriers-page">
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}
      <section className="admin-carriers-stat-grid">
        <article><span>หมวดหมู่ทั้งหมด</span><strong>{categories.length}</strong></article>
        <article><span>หมวดหมู่ที่มีสินค้า</span><strong>{usedCount}</strong></article>
        <article><span>หมวดหมู่ว่าง</span><strong>{categories.length - usedCount}</strong></article>
        <article><span>สินค้าทั้งหมด</span><strong>{products.length}</strong></article>
      </section>

      <section className="products-toolbar">
        <div className="admin-carriers-toolbar-heading">
          <div><span>ค้นหาและจัดการ</span><h2>หมวดหมู่สินค้า</h2></div>
          <strong>{filtered.length} รายการ</strong>
        </div>
        <input type="search" value={search} placeholder="ค้นหาหมวดหมู่..." onChange={(event) => setSearch(event.target.value)} />
        <button type="button" onClick={() => openForm()}>เพิ่มหมวดหมู่</button>
      </section>

      <section className="admin-panel products-table-panel">
        <div className="admin-carriers-table-heading">
          <div><span>รายการทั้งหมด</span><h2>หมวดหมู่สินค้า</h2></div>
          <p>หมวดหมู่ที่มีสินค้าใช้งานอยู่จะยังไม่สามารถลบได้</p>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table products-table">
            <thead><tr><th>ลำดับ</th><th>ชื่อหมวดหมู่</th><th>จำนวนสินค้า</th><th>การจัดการ</th></tr></thead>
            <tbody>
              {!pagination.pageItems.length ? <tr><td colSpan={4} className="admin-table-empty">ไม่พบหมวดหมู่สินค้า</td></tr>
                : pagination.pageItems.map((category, index) => {
                  const count = productCounts.get(String(category.category_id)) || 0;
                  return <tr key={category.category_id}>
                    <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                    <td className="admin-table-data-left"><strong>{category.category_name}</strong></td>
                    <td>{count} รายการ</td>
                    <td><div className="products-actions">
                      <button type="button" className="products-edit-button" onClick={() => openForm(category)}>แก้ไข</button>
                      <button type="button" className="products-delete-button" disabled={deletingId === category.category_id} onClick={() => handleDelete(category)}>
                        {deletingId === category.category_id ? 'กำลังลบ...' : 'ลบ'}
                      </button>
                    </div></td>
                  </tr>;
                })}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} className="admin-pagination" />
      </section>

      {formOpen ? <div className="products-modal-backdrop" role="presentation" onMouseDown={closeForm}>
        <form className="products-modal carrier-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
          <header className="products-modal-header">
            <h2>{editing ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</h2>
            <button type="button" aria-label="ปิด" onClick={closeForm}>×</button>
          </header>
          <div className="products-form-grid">
            <label className={`products-form-wide modal-name-field${formError ? ' has-error' : ''}`}>
              ชื่อหมวดหมู่
              <input
                autoFocus
                value={name}
                maxLength={100}
                required
                placeholder="เช่น ผัก ผลไม้ หรือสินค้าแปรรูป"
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? 'category-form-error' : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  if (formError) setFormError('');
                }}
              />
              {formError ? (
                <div id="category-form-error" className="modal-form-alert" role="alert">
                  <span className="modal-form-alert-icon" aria-hidden="true">!</span>
                  <span className="modal-form-alert-copy">
                    <strong>บันทึกข้อมูลไม่สำเร็จ</strong>
                    <span>{formError}</span>
                  </span>
                </div>
              ) : null}
            </label>
          </div>
          <footer className="products-modal-actions">
            <button type="submit" className="products-save-button" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button type="button" className="products-cancel-button" disabled={saving} onClick={closeForm}>ยกเลิก</button>
          </footer>
        </form>
      </div> : null}
    </div>
  );
}
