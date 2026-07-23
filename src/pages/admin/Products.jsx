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
  production_source: '',
  stock_quantity: '',
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function buildPayload(form, user) {
  return {
    product_name: form.product_name.trim(),
    category_id: Number(form.category_id),
    description: form.description.trim() || null,
    price: Number(form.price || 0),
    unit: form.unit.trim(),
    image_url: form.image_url.trim() || null,
    production_source: form.production_source.trim() || null,
    stock_quantity: Number(form.stock_quantity || 0),
    created_by: user?.user_id,
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
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
    const confirmed = window.confirm(`ลบสินค้า "${product.product_name}" หรือไม่?`);
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
    return <div className="admin-loading">กำลังโหลดสินค้า...</div>;
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
          placeholder="ค้นหา (ชื่อสินค้า, แหล่งผลิต)..."
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        />
        <select
          value={filters.category}
          onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
        >
          <option value="all">ทุกหมวดหมู่</option>
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
          <option value="all">ทุกสถานะ</option>
          <option value="available">มีสินค้า</option>
          <option value="empty">หมด</option>
        </select>
        <button type="button" onClick={openCreateForm}>
          เพิ่มสินค้า
        </button>
      </section>

      <section className="admin-panel products-table-panel">
        <div className="admin-table-wrap">
          <table className="admin-table products-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>สินค้า</th>
                <th>หมวดหมู่</th>
                <th>ราคา</th>
                <th>หน่วย</th>
                <th>คงเหลือ</th>
                <th>สถานะ</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    ไม่พบสินค้า
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
                          {stock > 0 ? 'มีสินค้า' : 'หมด'}
                        </span>
                      </td>
                      <td>
                        <div className="products-actions">
                          <button type="button" className="products-edit-button" onClick={() => openEditForm(product)}>
                            แก้ไข
                          </button>
                          <button type="button" className="products-delete-button" onClick={() => handleDelete(product)}>
                            ลบ
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
              <h2>{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
              <button type="button" aria-label="ปิด" onClick={closeForm}>
                ×
              </button>
            </header>

            <div className="products-form-grid">
              <label>
                ชื่อสินค้า
                <input value={form.product_name} onChange={(event) => handleChange('product_name', event.target.value)} required />
              </label>
              <label>
                หมวดหมู่
                <select value={form.category_id} onChange={(event) => handleChange('category_id', event.target.value)} required>
                  <option value="">เลือกหมวดหมู่</option>
                  {categories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ราคา
                <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => handleChange('price', event.target.value)} required />
              </label>
              <label>
                หน่วย
                <input value={form.unit} onChange={(event) => handleChange('unit', event.target.value)} required />
              </label>
              <label>
                จำนวนคงเหลือ
                <input type="number" min="0" value={form.stock_quantity} onChange={(event) => handleChange('stock_quantity', event.target.value)} />
              </label>
              <label>
                แหล่งผลิต
                <input value={form.production_source} onChange={(event) => handleChange('production_source', event.target.value)} />
              </label>
              <label className="products-form-wide">
                รูปภาพ URL
                <input value={form.image_url} onChange={(event) => handleChange('image_url', event.target.value)} />
              </label>
              <label className="products-form-wide">
                อัปโหลดรูปภาพ
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => handleImageChange(event.target.files?.[0])}
                />
              </label>
              {imagePreview ? (
                <div className="products-image-preview products-form-wide">
                  <img src={imagePreview} alt="ตัวอย่างรูปสินค้า" />
                  <span>{imageFile ? imageFile.name : 'รูปภาพปัจจุบัน'}</span>
                </div>
              ) : null}
              <label className="products-form-wide">
                รายละเอียด
                <textarea rows="3" value={form.description} onChange={(event) => handleChange('description', event.target.value)} />
              </label>
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
    </>
  );
}



