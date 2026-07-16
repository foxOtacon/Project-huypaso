import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
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
  category: 'à¸‚à¹ˆà¸²à¸§à¸Šà¸¸à¸¡à¸Šà¸™',
  status: 'draft',
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

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
    reader.onerror = () => reject(new Error('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¸ à¸²à¸žà¹„à¸”à¹‰'));
    reader.readAsDataURL(file);
  });
}

function buildPayload(form, user) {
  return {
    title: form.title.trim(),
    summary: form.summary.trim() || null,
    content: form.content.trim(),
    image_url: form.image_url.trim() || null,
    category: form.category.trim() || 'à¸‚à¹ˆà¸²à¸§à¸Šà¸¸à¸¡à¸Šà¸™',
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
    const keyword = normalizeText(filters.search);

    return items.filter((item) => {
      const matchesSearch =
        !keyword ||
        normalizeText(item.title).includes(keyword) ||
        normalizeText(item.summary).includes(keyword) ||
        normalizeText(item.category).includes(keyword);
      const matchesStatus = filters.status === 'all' || item.status === filters.status;

      return matchesSearch && matchesStatus;
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
      category: item.category || 'à¸‚à¹ˆà¸²à¸§à¸Šà¸¸à¸¡à¸Šà¸™',
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
    const confirmed = window.confirm(`à¸¥à¸šà¸‚à¹ˆà¸²à¸§ "${item.title}" à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?`);
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

  if (loading) {
    return <div className="admin-loading">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸‚à¹ˆà¸²à¸§...</div>;
  }

  if (error && items.length === 0) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <>
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="products-toolbar">
        <input
          type="search"
          value={filters.search}
          placeholder="à¸„à¹‰à¸™à¸«à¸²à¸‚à¹ˆà¸²à¸§..."
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />
        <select
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
        >
          <option value="all">à¸—à¸¸à¸à¸ªà¸–à¸²à¸™à¸°</option>
          <option value="published">à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆ</option>
          <option value="draft">à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡</option>
        </select>
        <button type="button" onClick={openCreateForm}>
          à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¹ˆà¸²à¸§
        </button>
      </section>

      <section className="admin-panel products-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-table products-table">
            <thead>
              <tr>
                <th>à¸¥à¸³à¸”à¸±à¸š</th>
                <th>à¸‚à¹ˆà¸²à¸§</th>
                <th>à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ</th>
                <th>à¸ªà¸–à¸²à¸™à¸°</th>
                <th>à¸§à¸±à¸™à¸—à¸µà¹ˆ</th>
                <th>à¸à¸²à¸£à¸ˆà¸±à¸”à¸à¸²à¸£</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹ˆà¸²à¸§
                  </td>
                </tr>
              ) : (
                pagination.pageItems.map((item, index) => (
                  <tr key={item.news_id}>
                    <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                    <td>
                      <div className="products-name-cell">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} />
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
                        {item.status === 'published' ? 'à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆ' : 'à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡'}
                      </span>
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <div className="products-actions">
                        <button type="button" className="products-edit-button" onClick={() => openEditForm(item)}>
                          à¹à¸à¹‰à¹„à¸‚
                        </button>
                        <button type="button" className="products-delete-button" onClick={() => handleDelete(item)}>
                          à¸¥à¸š
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
              <h2>{editingItem ? 'à¹à¸à¹‰à¹„à¸‚à¸‚à¹ˆà¸²à¸§' : 'à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¹ˆà¸²à¸§'}</h2>
              <button type="button" aria-label="à¸›à¸´à¸”" onClick={closeForm}>
                x
              </button>
            </header>

            <div className="products-form-grid">
              <label className="products-form-wide">
                à¸«à¸±à¸§à¸‚à¹‰à¸­à¸‚à¹ˆà¸²à¸§
                <input value={form.title} onChange={(event) => handleChange('title', event.target.value)} required />
              </label>
              <label>
                à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ
                <input value={form.category} onChange={(event) => handleChange('category', event.target.value)} />
              </label>
              <label>
                à¸ªà¸–à¸²à¸™à¸°
                <select value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                  <option value="draft">à¸‰à¸šà¸±à¸šà¸£à¹ˆà¸²à¸‡</option>
                  <option value="published">à¹€à¸œà¸¢à¹à¸žà¸£à¹ˆ</option>
                </select>
              </label>
              <label className="products-form-wide">
                à¸ªà¸£à¸¸à¸›à¸‚à¹ˆà¸²à¸§
                <textarea rows="2" value={form.summary} onChange={(event) => handleChange('summary', event.target.value)} />
              </label>
              <label className="products-form-wide">
                à¸£à¸¹à¸›à¸ à¸²à¸ž URL
                <input value={form.image_url} onChange={(event) => handleChange('image_url', event.target.value)} />
              </label>
              <label className="products-form-wide">
                à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¸‚à¹ˆà¸²à¸§
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => handleImageChange(event.target.files?.[0])}
                />
              </label>
              {imagePreview ? (
                <div className="products-image-preview products-form-wide">
                  <img src={imagePreview} alt="à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸¹à¸›à¸‚à¹ˆà¸²à¸§" />
                  <span>{imageFile ? imageFile.name : 'à¸£à¸¹à¸›à¸ à¸²à¸žà¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™'}</span>
                </div>
              ) : null}
              <label className="products-form-wide">
                à¹€à¸™à¸·à¹‰à¸­à¸«à¸²à¸‚à¹ˆà¸²à¸§
                <textarea rows="7" value={form.content} onChange={(event) => handleChange('content', event.target.value)} required />
              </label>
            </div>

            <footer className="products-modal-actions">
              <button type="submit" className="products-save-button" disabled={saving}>
                {saving ? 'à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸...' : 'à¸šà¸±à¸™à¸—à¸¶à¸'}
              </button>
              <button type="button" className="products-cancel-button" onClick={closeForm} disabled={saving}>
                à¸¢à¸à¹€à¸¥à¸´à¸
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}



