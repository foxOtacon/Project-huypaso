import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import usePagination from '../../hooks/usePagination';
import {
  createProduct,
  deleteProduct,
  fetchCategories,
  fetchProducts,
  updateProduct,
  uploadProductImage,
} from '../../api/admin';
import { formatCurrency } from '../../utils/dashboardStats';

const EMPTY_FORM = {
  product_name: '',
  category_id: '',
  description: '',
  price: '',
  unit: '',
  image_url: '',
  planting_date: '',
  harvest_date: '',
  production_source: '',
  stock_quantity: '',
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toInputDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function buildPayload(form, user) {
  return {
    product_name: form.product_name.trim(),
    category_id: Number(form.category_id),
    description: form.description.trim() || null,
    price: Number(form.price || 0),
    unit: form.unit.trim(),
    image_url: form.image_url.trim() || null,
    planting_date: form.planting_date || null,
    harvest_date: form.harvest_date || null,
    production_source: form.production_source.trim() || null,
    stock_quantity: Number(form.stock_quantity || 0),
    created_by: user?.user_id,
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¸£à¸¹à¸›à¸ à¸²à¸žà¹„à¸”à¹‰'));
    reader.readAsDataURL(file);
  });
}

export default function Products({ user }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: '', category: 'all', stock: 'all' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        const [productsData, categoriesData] = await Promise.all([
          fetchProducts(),
          fetchCategories(),
        ]);
        setProducts(productsData);
        setCategories(categoriesData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.category_id, category.category_name])),
    [categories],
  );

  const filteredProducts = useMemo(() => {
    const query = normalizeText(filters.search);

    return products.filter((product) => {
      const stock = Number(product.stock_quantity || 0);
      const matchesSearch =
        !query ||
        normalizeText(product.product_name).includes(query) ||
        normalizeText(product.production_source).includes(query);
      const matchesCategory =
        filters.category === 'all' || Number(product.category_id) === Number(filters.category);
      const matchesStock =
        filters.stock === 'all' ||
        (filters.stock === 'available' && stock > 0) ||
        (filters.stock === 'empty' && stock <= 0);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [filters, products]);

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.category_id || '' });
    setImageFile(null);
    setImagePreview('');
    setError('');
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setForm({
      product_name: product.product_name || '',
      category_id: product.category_id || '',
      description: product.description || '',
      price: product.price || '',
      unit: product.unit || '',
      image_url: product.image_url || '',
      planting_date: toInputDate(product.planting_date),
      harvest_date: toInputDate(product.harvest_date),
      production_source: product.production_source || '',
      stock_quantity: product.stock_quantity ?? '',
    });
    setImageFile(null);
    setImagePreview(product.image_url || '');
    setError('');
  };

  const closeForm = () => {
    if (saving) return;
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview('');
  };

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleImageChange = (file) => {
    setImageFile(file || null);

    if (!file) {
      setImagePreview(form.image_url);
      return;
    }

    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      let imageUrl = form.image_url;

      if (imageFile) {
        const dataUrl = await fileToDataUrl(imageFile);
        const uploaded = await uploadProductImage({ fileName: imageFile.name, dataUrl });
        imageUrl = uploaded.url;
      }

      const payload = buildPayload({ ...form, image_url: imageUrl }, user);
      const saved = editingProduct
        ? await updateProduct(editingProduct.product_id, payload)
        : await createProduct(payload);

      setProducts((current) => {
        if (editingProduct) {
          return current.map((product) =>
            product.product_id === saved.product_id ? saved : product,
          );
        }
        return [saved, ...current];
      });
      setEditingProduct(null);
      setForm(EMPTY_FORM);
      setImageFile(null);
      setImagePreview('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    const confirmed = window.confirm(`à¸¥à¸šà¸ªà¸´à¸™à¸„à¹‰à¸² "${product.product_name}" à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?`);
    if (!confirmed) return;

    setError('');
    try {
      await deleteProduct(product.product_id);
      setProducts((current) =>
        current.filter((item) => item.product_id !== product.product_id),
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const pagination = usePagination(filteredProducts, 10, [filters]);

  if (loading) {
    return <div className="admin-loading">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸ªà¸´à¸™à¸„à¹‰à¸²...</div>;
  }

  if (error && products.length === 0) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <>
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="products-toolbar">
        <input
          type="search"
          value={filters.search}
          placeholder="à¸„à¹‰à¸™à¸«à¸² (à¸Šà¸·à¹ˆà¸­à¸ªà¸´à¸™à¸„à¹‰à¸², à¹à¸«à¸¥à¹ˆà¸‡à¸œà¸¥à¸´à¸•)..."
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />
        <select
          value={filters.category}
          onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
        >
          <option value="all">à¸—à¸¸à¸à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ</option>
          {categories.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.category_name}
            </option>
          ))}
        </select>
        <select
          value={filters.stock}
          onChange={(event) => setFilters((current) => ({ ...current, stock: event.target.value }))}
        >
          <option value="all">à¸—à¸¸à¸à¸ªà¸–à¸²à¸™à¸°</option>
          <option value="available">à¸¡à¸µà¸ªà¸´à¸™à¸„à¹‰à¸²</option>
          <option value="empty">à¸«à¸¡à¸”</option>
        </select>
        <button type="button" onClick={openCreateForm}>
          à¹€à¸žà¸´à¹ˆà¸¡à¸ªà¸´à¸™à¸„à¹‰à¸²
        </button>
      </section>

      <section className="admin-panel products-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-table products-table">
            <thead>
              <tr>
                <th>à¸¥à¸³à¸”à¸±à¸š</th>
                <th>à¸ªà¸´à¸™à¸„à¹‰à¸²</th>
                <th>à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ</th>
                <th>à¸£à¸²à¸„à¸²</th>
                <th>à¸«à¸™à¹ˆà¸§à¸¢</th>
                <th>à¸„à¸‡à¹€à¸«à¸¥à¸·à¸­</th>
                <th>à¸ªà¸–à¸²à¸™à¸°</th>
                <th>à¸à¸²à¸£à¸ˆà¸±à¸”à¸à¸²à¸£</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    à¹„à¸¡à¹ˆà¸žà¸šà¸ªà¸´à¸™à¸„à¹‰à¸²
                  </td>
                </tr>
              ) : (
                pagination.pageItems.map((product, index) => {
                  const stock = Number(product.stock_quantity || 0);
                  return (
                    <tr key={product.product_id}>
                      <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                      <td>
                        <div className="products-name-cell">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.product_name} />
                          ) : (
                            <div className="products-image-placeholder" aria-hidden="true" />
                          )}
                          <div>
                            <strong>{product.product_name}</strong>
                            <span>{product.production_source || '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td>{categoryMap.get(product.category_id) || '-'}</td>
                      <td className="products-price">{formatCurrency(product.price)}</td>
                      <td>{product.unit}</td>
                      <td>{stock.toLocaleString('th-TH')}</td>
                      <td>
                        <span className={`product-stock-badge ${stock > 0 ? 'available' : 'empty'}`}>
                          {stock > 0 ? 'à¸¡à¸µà¸ªà¸´à¸™à¸„à¹‰à¸²' : 'à¸«à¸¡à¸”'}
                        </span>
                      </td>
                      <td>
                        <div className="products-actions">
                          <button type="button" className="products-edit-button" onClick={() => openEditForm(product)}>
                            à¹à¸à¹‰à¹„à¸‚
                          </button>
                          <button type="button" className="products-delete-button" onClick={() => handleDelete(product)}>
                            à¸¥à¸š
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} className="admin-pagination" />
      </section>

      {(editingProduct || form !== EMPTY_FORM) && (
        <div className="products-modal-backdrop" role="presentation" onMouseDown={closeForm}>
          <form className="products-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
            <header className="products-modal-header">
              <h2>{editingProduct ? 'à¹à¸à¹‰à¹„à¸‚à¸ªà¸´à¸™à¸„à¹‰à¸²' : 'à¹€à¸žà¸´à¹ˆà¸¡à¸ªà¸´à¸™à¸„à¹‰à¸²'}</h2>
              <button type="button" aria-label="à¸›à¸´à¸”" onClick={closeForm}>
                Ã—
              </button>
            </header>

            <div className="products-form-grid">
              <label>
                à¸Šà¸·à¹ˆà¸­à¸ªà¸´à¸™à¸„à¹‰à¸²
                <input value={form.product_name} onChange={(event) => handleChange('product_name', event.target.value)} required />
              </label>
              <label>
                à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ
                <select value={form.category_id} onChange={(event) => handleChange('category_id', event.target.value)} required>
                  <option value="">à¹€à¸¥à¸·à¸­à¸à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ</option>
                  {categories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                à¸£à¸²à¸„à¸²
                <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => handleChange('price', event.target.value)} required />
              </label>
              <label>
                à¸«à¸™à¹ˆà¸§à¸¢
                <input value={form.unit} onChange={(event) => handleChange('unit', event.target.value)} required />
              </label>
              <label>
                à¸ˆà¸³à¸™à¸§à¸™à¸„à¸‡à¹€à¸«à¸¥à¸·à¸­
                <input type="number" min="0" value={form.stock_quantity} onChange={(event) => handleChange('stock_quantity', event.target.value)} />
              </label>
              <label>
                à¹à¸«à¸¥à¹ˆà¸‡à¸œà¸¥à¸´à¸•
                <input value={form.production_source} onChange={(event) => handleChange('production_source', event.target.value)} />
              </label>
              <label>
                à¸§à¸±à¸™à¸—à¸µà¹ˆà¸›à¸¥à¸¹à¸
                <input type="date" value={form.planting_date} onChange={(event) => handleChange('planting_date', event.target.value)} />
              </label>
              <label>
                à¸§à¸±à¸™à¸—à¸µà¹ˆà¹€à¸à¹‡à¸šà¹€à¸à¸µà¹ˆà¸¢à¸§
                <input type="date" value={form.harvest_date} onChange={(event) => handleChange('harvest_date', event.target.value)} />
              </label>
              <label className="products-form-wide">
                à¸£à¸¹à¸›à¸ à¸²à¸ž URL
                <input value={form.image_url} onChange={(event) => handleChange('image_url', event.target.value)} />
              </label>
              <label className="products-form-wide">
                à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¸ à¸²à¸ž
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => handleImageChange(event.target.files?.[0])}
                />
              </label>
              {imagePreview ? (
                <div className="products-image-preview products-form-wide">
                  <img src={imagePreview} alt="à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡à¸£à¸¹à¸›à¸ªà¸´à¸™à¸„à¹‰à¸²" />
                  <span>{imageFile ? imageFile.name : 'à¸£à¸¹à¸›à¸ à¸²à¸žà¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™'}</span>
                </div>
              ) : null}
              <label className="products-form-wide">
                à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”
                <textarea rows="3" value={form.description} onChange={(event) => handleChange('description', event.target.value)} />
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



