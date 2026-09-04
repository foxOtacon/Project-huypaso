import { useEffect, useMemo, useState } from 'react';
import Pagination from '../../components/Pagination';
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog';
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
import { matchesSearch } from '../../utils/search';
import { getImageUrl } from '../../utils/imageUrl';

const EMPTY_FORM = {
  product_name: '',
  category_id: '',
  description: '',
  price: '',
  unit: '',
  image_url: '',
  production_source: '',
  product_hook: '',
  product_story: '',
  product_highlights: '',
  product_benefits: '',
  product_usage: '',
  product_details: '',
  stock_quantity: '',
  status: 'active',
};
const normalizeProductName = (value) => String(value || '').trim().toLocaleLowerCase('th');
const DUPLICATE_PRODUCT_MESSAGE = 'ชื่อสินค้าซ้ำ กรุณาใช้ชื่ออื่น';
const isDuplicateProductError = (error) => error?.status === 409
  || ['duplicate', 'unique', 'ซ้ำ'].some((word) => normalizeProductName(error?.message).includes(word));

function buildPayload(form) {
  return {
    product_name: form.product_name.trim(),
    category_id: Number(form.category_id),
    description: form.description.trim() || null,
    price: Number(form.price || 0),
    unit: form.unit.trim(),
    image_url: form.image_url.trim() || null,
    production_source: form.production_source.trim() || null,
    product_hook: form.product_hook.trim() || null,
    product_story: form.product_story.trim() || null,
    product_highlights: form.product_highlights.trim() || null,
    product_benefits: form.product_benefits.trim() || null,
    product_usage: form.product_usage.trim() || null,
    product_details: form.product_details.trim() || null,
    stock_quantity: Number(form.stock_quantity || 0),
    status: form.status,
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
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const [productsData, categoriesData] = await Promise.all([
          fetchProducts(),
          fetchCategories(),
        ]);
        setProducts(productsData);
        setCategories(
          [...categoriesData].sort((a, b) =>
            String(a.category_name || '').localeCompare(String(b.category_name || ''), undefined, {
              sensitivity: 'base',
            }),
          ),
        );
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
    return products.filter((product) => {
      const stock = Number(product.stock_quantity || 0);
      const matchesKeyword = matchesSearch(filters.search, [
        product.product_name,
        product.description,
        product.production_source,
        categoryMap.get(product.category_id),
      ]);
      const matchesCategory =
        filters.category === 'all' || Number(product.category_id) === Number(filters.category);
      const matchesStock =
        filters.stock === 'all' ||
        (filters.stock === 'available' && stock > 0) ||
        (filters.stock === 'empty' && stock <= 0);

      return matchesKeyword && matchesCategory && matchesStock;
    });
  }, [categoryMap, filters, products]);

  const openCreateForm = () => {
    setFormError('');
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM });
    setImageFile(null);
    setImagePreview('');
    setError('');
  };

  const openEditForm = (product) => {
    setFormError('');
    setEditingProduct(product);
    setForm({
      product_name: product.product_name || '',
      category_id: product.category_id || '',
      description: product.description || '',
      price: product.price || '',
      unit: product.unit || '',
      image_url: product.image_url || '',
      production_source: product.production_source || '',
      product_hook: product.product_hook || '',
      product_story: product.product_story || '',
      product_highlights: product.product_highlights || '',
      product_benefits: product.product_benefits || '',
      product_usage: product.product_usage || '',
      product_details: product.product_details || '',
      stock_quantity: product.stock_quantity ?? '',
      status: product.status || 'active',
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
    setFormError('');
  };

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'product_name' && formError) setFormError('');
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
    const duplicate = products.some((product) => product.product_id !== editingProduct?.product_id
      && normalizeProductName(product.product_name) === normalizeProductName(form.product_name));
    if (duplicate) {
      setFormError(DUPLICATE_PRODUCT_MESSAGE);
      return;
    }
    setSaving(true);
    setError('');
    setFormError('');

    try {
      let imageUrl = form.image_url;

      if (imageFile) {
        const dataUrl = await fileToDataUrl(imageFile);
        const uploaded = await uploadProductImage({ fileName: imageFile.name, dataUrl });
        imageUrl = uploaded.url;
      }

      const payload = buildPayload({ ...form, image_url: imageUrl });
      if (!editingProduct) {
        payload.created_by = user?.user_id;
      }
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
      setFormError(isDuplicateProductError(err) ? DUPLICATE_PRODUCT_MESSAGE : err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    setDeletingId(product.product_id);
    setError('');
    try {
      await deleteProduct(product.product_id);
      setProducts((current) =>
        current.filter((item) => item.product_id !== product.product_id),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const handleStatusToggle = async (product) => {
    const nextStatus = product.status === 'suspended' ? 'active' : 'suspended';
    setUpdatingStatusId(product.product_id);
    setError('');

    try {
      const updated = await updateProduct(product.product_id, { status: nextStatus });
      setProducts((current) =>
        current.map((item) => (item.product_id === updated.product_id ? updated : item)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const pagination = usePagination(filteredProducts, 10, [filters]);
  const productStats = {
    total: products.length,
    available: products.filter((product) => Number(product.stock_quantity || 0) > 0).length,
    empty: products.filter((product) => Number(product.stock_quantity || 0) <= 0).length,
    stockUnits: products.reduce((sum, product) => sum + Number(product.stock_quantity || 0), 0),
  };

  if (loading) {
    return <div className="admin-loading">กำลังโหลดสินค้า...</div>;
  }

  if (error && products.length === 0) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <div className="admin-products-page">
      {error ? <div className="admin-error orders-inline-error">{error}</div> : null}

      <section className="admin-products-stat-grid">
        <article><span>สินค้าทั้งหมด</span><strong>{productStats.total}</strong></article>
        <article><span>พร้อมขาย</span><strong>{productStats.available}</strong></article>
        <article><span>สินค้าหมด</span><strong>{productStats.empty}</strong></article>
        <article><span>จำนวนคงเหลือรวม</span><strong>{productStats.stockUnits.toLocaleString('th-TH')}</strong></article>
      </section>

      <section className="products-toolbar">
        <div className="admin-products-toolbar-heading">
          <div><span>ค้นหาและกรอง</span><h2>จัดการคลังสินค้า</h2></div>
          <strong>{filteredProducts.length} รายการ</strong>
        </div>
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
        <div className="admin-products-table-heading">
          <div><span>รายการทั้งหมด</span><h2>สินค้า</h2></div>
          <p>ตรวจสอบราคา สต็อก และแก้ไขข้อมูลสินค้า</p>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table products-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>รูปภาพ</th>
                <th>สินค้า</th>
                <th>หมวดหมู่</th>
                <th>ราคา</th>
                <th>หน่วย</th>
                <th>คงเหลือ</th>
                <th>สถานะสต็อก</th>
                <th>สถานะสินค้า</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="admin-table-empty">
                    ไม่พบสินค้า
                  </td>
                </tr>
              ) : (
                pagination.pageItems.map((product, index) => {
                  const stock = Number(product.stock_quantity || 0);
                  return (
                    <tr key={product.product_id}>
                      <td>{(pagination.page - 1) * pagination.pageSize + index + 1}</td>
                      <td className="products-image-cell">
                        {product.image_url ? (
                          <img src={getImageUrl(product.image_url)} alt={product.product_name} />
                        ) : (
                          <div className="products-image-placeholder" aria-hidden="true" />
                        )}
                      </td>
                      <td>
                        <div className="products-name-cell">
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
                        <span className={`product-status-badge ${product.status === 'suspended' ? 'suspended' : 'active'}`}>
                          {product.status === 'suspended' ? 'ระงับ' : 'ใช้งาน'}
                        </span>
                      </td>
                      <td>
                        <div className="products-actions">
                          <button
                            type="button"
                            className={`products-status-button ${product.status === 'suspended' ? 'activate' : 'suspend'}`}
                            disabled={updatingStatusId === product.product_id}
                            onClick={() => handleStatusToggle(product)}
                          >
                            {updatingStatusId === product.product_id
                              ? 'กำลังบันทึก...'
                              : product.status === 'suspended'
                                ? 'เปิดใช้งาน'
                                : 'ระงับ'}
                          </button>
                          <button type="button" className="products-edit-button" onClick={() => openEditForm(product)}>
                            แก้ไข
                          </button>
                          <button type="button" className="products-delete-button" onClick={() => setPendingDelete(product)}>
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
              <label className={`modal-name-field${formError ? ' has-error' : ''}`}>
                ชื่อสินค้า
                <input value={form.product_name} onChange={(event) => handleChange('product_name', event.target.value)} required aria-invalid={Boolean(formError)} aria-describedby={formError ? 'product-form-error' : undefined} />
                {formError ? (
                  <div id="product-form-error" className="modal-form-alert" role="alert">
                    <span className="modal-form-alert-icon" aria-hidden="true">!</span>
                    <span className="modal-form-alert-copy"><strong>บันทึกข้อมูลไม่สำเร็จ</strong><span>{formError}</span></span>
                  </div>
                ) : null}
              </label>
              <label>
                หมวดหมู่
                <select value={form.category_id} onChange={(event) => handleChange('category_id', event.target.value)} required>
                  <option value="" hidden>
                    เลือกหมวดหมู่สินค้า
                  </option>
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
                สถานะสินค้า
                <select value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                  <option value="active">ใช้งาน</option>
                  <option value="suspended">ระงับ</option>
                </select>
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
                  <img src={getImageUrl(imagePreview)} alt="ตัวอย่างรูปสินค้า" />
                  <span>{imageFile ? imageFile.name : 'รูปภาพปัจจุบัน'}</span>
                </div>
              ) : null}
              <label className="products-form-wide">
                รายละเอียด
                <textarea rows="3" value={form.description} onChange={(event) => handleChange('description', event.target.value)} />
              </label>
              <label className="products-form-wide">
                คำโปรยสินค้า
                <input value={form.product_hook} onChange={(event) => handleChange('product_hook', event.target.value)} placeholder="จากธรรมชาติ สู่ช่วงเวลาแห่งความผ่อนคลาย" />
              </label>
              <label className="products-form-wide">
                เรื่องราวของสินค้า
                <textarea rows="4" value={form.product_story} onChange={(event) => handleChange('product_story', event.target.value)} placeholder="เล่าเรื่องแหล่งปลูก วัตถุดิบ และความตั้งใจของชุมชน" />
              </label>
              <label>
                จุดเด่นสินค้า
                <textarea rows="4" value={form.product_highlights} onChange={(event) => handleChange('product_highlights', event.target.value)} placeholder="หนึ่งจุดเด่นต่อหนึ่งบรรทัด" />
              </label>
              <label>
                คุณประโยชน์
                <textarea rows="4" value={form.product_benefits} onChange={(event) => handleChange('product_benefits', event.target.value)} placeholder="หนึ่งคุณประโยชน์ต่อหนึ่งบรรทัด" />
              </label>
              <label>
                วิธีใช้ / วิธีชง
                <textarea rows="4" value={form.product_usage} onChange={(event) => handleChange('product_usage', event.target.value)} />
              </label>
              <label>
                รายละเอียดเพิ่มเติม
                <textarea rows="4" value={form.product_details} onChange={(event) => handleChange('product_details', event.target.value)} />
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
      <AdminConfirmDialog
        open={Boolean(pendingDelete)}
        title="ลบสินค้า"
        message={pendingDelete ? `คุณต้องการลบสินค้า “${pendingDelete.product_name}” หรือไม่? การลบแล้วไม่สามารถย้อนกลับได้` : ''}
        confirmLabel="ลบสินค้า"
        busy={Boolean(deletingId)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => handleDelete(pendingDelete)}
      />
    </div>
  );
}



