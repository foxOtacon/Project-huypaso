import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import { matchesSearch } from '../../utils/search';
import { getImageUrl } from '../../utils/imageUrl';
import {
  createNews,
  deleteNews,
  fetchNews,
  updateNews,
  uploadNewsImage,
} from '../../api/admin';

const EMPTY_FORM = {
  title: '',
  summary: '',
  content: '',
  image_url: '',
  category: 'ข่าวชุมชน',
  status: 'draft',
};

function formatDate(value) {
  if (!value) return '-';

  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.readAsDataURL(file);
  });
}

function buildPayload(form, user) {
  return {
    title: form.title.trim(),
    summary: form.summary.trim() || null,
    content: form.content.trim(),
    image_url: form.image_url.trim() || null,
    category: form.category.trim() || 'ข่าวชุมชน',
    status: form.status,
    created_by: user?.user_id,
  };
}

export default function News({ user }) {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: 'all' });
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadNews() {
      try {
        setItems(await fetchNews());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadNews();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesKeyword = matchesSearch(filters.search, [
        item.title,
        item.summary,
        item.content,
        item.category,
      ]);
      const matchesStatus = filters.status === 'all' || item.status === filters.status;

      return matchesKeyword && matchesStatus;
    });
  }, [filters, items]);

  function openCreateForm() {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setImageFile(null);
    setImagePreview('');
    setError('');
  }

  function openEditForm(item) {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      summary: item.summary || '',
      content: item.content || '',
      image_url: item.image_url || '',
      category: item.category || 'ข่าวชุมชน',
      status: item.status || 'draft',
    });
    setImageFile(null);
    setImagePreview(item.image_url || '');
    setError('');
  }

  function closeForm() {
    if (saving) return;
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview('');
  }

  function handleChange(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleImageChange(file) {
    setImageFile(file || null);

    if (!file) {
      setImagePreview(form.image_url);
      return;
    }

    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      let imageUrl = form.image_url;

      if (imageFile) {
        const dataUrl = await fileToDataUrl(imageFile);
        const uploaded = await uploadNewsImage({ fileName: imageFile.name, dataUrl });
        imageUrl = uploaded.url;
      }

      const payload = buildPayload({ ...form, image_url: imageUrl }, user);
      const saved = editingItem
        ? await updateNews(editingItem.news_id, payload)
        : await createNews(payload);

      setItems((current) => {
        if (editingItem) {
          return current.map((item) => (item.news_id === saved.news_id ? saved : item));
        }

        return [saved, ...current];
      });
      closeForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(`ลบข่าว "${item.title}" หรือไม่?`);
    if (!confirmed) return;

    setError('');

    try {
      await deleteNews(item.news_id);
      setItems((current) => current.filter((newsItem) => newsItem.news_id !== item.news_id));
    } catch (err) {
      setError(err.message);
    }
  }

  const pagination = usePagination(filteredItems, 10, [filters]);
  const newsStats = {
    total: items.length,
    published: items.filter((item) => item.status === 'published').length,
    draft: items.filter((item) => item.status === 'draft').length,
    withImage: items.filter((item) => item.image_url).length,
  };

  if (loading) {
    return <div className="admin-loading">กำลังโหลดข่าว...</div>;
  }

  if (error && items.length === 0) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <div className="admin-news-page">
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="admin-news-stat-grid">
        <article><span>ข่าวทั้งหมด</span><strong>{newsStats.total}</strong></article>
        <article><span>เผยแพร่แล้ว</span><strong>{newsStats.published}</strong></article>
        <article><span>ฉบับร่าง</span><strong>{newsStats.draft}</strong></article>
        <article><span>ข่าวที่มีรูปภาพ</span><strong>{newsStats.withImage}</strong></article>
      </section>

      <section className="products-toolbar">
        <div className="admin-news-toolbar-heading">
          <div><span>ค้นหาและกรอง</span><h2>จัดการข่าวประชาสัมพันธ์</h2></div>
          <strong>{filteredItems.length} รายการ</strong>
        </div>
        <input
          type="search"
          value={filters.search}
          placeholder="ค้นหาข่าว..."
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />
        <select
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="published">เผยแพร่</option>
          <option value="draft">ฉบับร่าง</option>
        </select>
        <button type="button" onClick={openCreateForm}>
          เพิ่มข่าว
        </button>
      </section>

      <section className="admin-panel products-table-panel">
        <div className="admin-news-table-heading">
          <div><span>เนื้อหาทั้งหมด</span><h2>ข่าวและกิจกรรม</h2></div>
          <p>สร้างฉบับร่างและเผยแพร่ข่าวสารของชุมชน</p>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table products-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>ข่าว</th>
                <th>หมวดหมู่</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    ไม่พบข่าว
                  </td>
                </tr>
              ) : (
                pagination.pageItems.map((item, index) => (
                  <tr key={item.news_id}>
                    <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                    <td className="admin-table-data-left">
                      <div className="products-name-cell">
                        {item.image_url ? (
                          <img src={getImageUrl(item.image_url)} alt={item.title} />
                        ) : (
                          <div className="products-image-placeholder" aria-hidden="true" />
                        )}
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.summary || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.category || '-'}</td>
                    <td>
                      <span className={`news-status-badge news-status-${item.status || 'draft'}`}>
                        {item.status === 'published' ? 'เผยแพร่' : 'ฉบับร่าง'}
                      </span>
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <div className="products-actions">
                        <button type="button" className="products-edit-button" onClick={() => openEditForm(item)}>
                          แก้ไข
                        </button>
                        <button type="button" className="products-delete-button" onClick={() => handleDelete(item)}>
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} className="admin-pagination" />
      </section>

      {(editingItem || form !== EMPTY_FORM) && (
        <div className="products-modal-backdrop" role="presentation" onMouseDown={closeForm}>
          <form className="products-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
            <header className="products-modal-header">
              <h2>{editingItem ? 'แก้ไขข่าว' : 'เพิ่มข่าว'}</h2>
              <button type="button" aria-label="ปิด" onClick={closeForm}>
                x
              </button>
            </header>

            <div className="products-form-grid">
              <label className="products-form-wide">
                หัวข้อข่าว
                <input value={form.title} onChange={(event) => handleChange('title', event.target.value)} required />
              </label>
              <label>
                หมวดหมู่
                <input value={form.category} onChange={(event) => handleChange('category', event.target.value)} />
              </label>
              <label>
                สถานะ
                <select value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                  <option value="draft">ฉบับร่าง</option>
                  <option value="published">เผยแพร่</option>
                </select>
              </label>
              <label className="products-form-wide">
                เนื้อหาข่าว
                <textarea rows="7" value={form.content} onChange={(event) => handleChange('content', event.target.value)} required />
              </label>
              <label className="products-form-wide">
                สรุปข่าว
                <textarea rows="2" value={form.summary} onChange={(event) => handleChange('summary', event.target.value)} />
              </label>
              <label className="products-form-wide">
                รูปภาพ URL
                <input value={form.image_url} onChange={(event) => handleChange('image_url', event.target.value)} />
              </label>
              <label className="products-form-wide">
                อัปโหลดรูปข่าว
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => handleImageChange(event.target.files?.[0])}
                />
              </label>
              {imagePreview ? (
                <div className="products-image-preview products-form-wide">
                  <img src={getImageUrl(imagePreview)} alt="ตัวอย่างรูปข่าว" />
                  <span>{imageFile ? imageFile.name : 'รูปภาพปัจจุบัน'}</span>
                </div>
              ) : null}
            </div>

            <footer className="products-modal-actions">
              <button type="submit" className="products-save-button" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button type="button" className="products-cancel-button" onClick={closeForm} disabled={saving}>
                ยกเลิก
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}



