import CustomerNavbar from '../components/CustomerNavbar';
import { useCart } from '../context/CartContext';
import { isCustomerUser } from '../utils/roles';
import { getImageUrl as resolveImageUrl } from '../utils/imageUrl';
import './ProductsPage.css';
import './CartPage.css';

const fallbackImage =
  'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80';

function formatPrice(value) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getImageUrl(item) {
  return resolveImageUrl(item.image_url, fallbackImage);
}

export default function CartPage({ user, onNavigate, onLogout }) {
  const { items, itemCount, totalAmount, updateQuantity, removeItem, clearCart } = useCart();

  return (
    <div className="catalog-page cart-page">
      <CustomerNavbar user={user} onNavigate={onNavigate} onLogout={onLogout} />

      <main className="catalog-main">
        <section className="catalog-shell cart-layout">
          <div className="cart-heading">
            <div>
              <h1>ตะกร้าสินค้า</h1>
              <p>ตรวจสอบสินค้าและจำนวนก่อนดำเนินการชำระเงิน</p>
            </div>
            {items.length > 0 && (
              <button type="button" className="cart-clear" onClick={clearCart}>
                ล้างตะกร้า
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="cart-empty">
              <h2>ยังไม่มีสินค้าในตะกร้า</h2>
              <p>เลือกสินค้าจากหน้าสินค้าแล้วกดใส่ตะกร้า</p>
              <button type="button" onClick={() => onNavigate('/products')}>
                ไปเลือกสินค้า
              </button>
            </div>
          ) : (
            <div className="cart-content">
              <div className="cart-items">
                {items.map((item) => (
                  <article className="cart-item" key={item.product_id}>
                    <img src={getImageUrl(item)} alt={item.product_name} />
                    <div className="cart-item-info">
                      <h2>{item.product_name}</h2>
                      <p>{formatPrice(item.price)} /{item.unit}</p>
                      <button type="button" onClick={() => removeItem(item.product_id)}>
                        ลบสินค้า
                      </button>
                    </div>
                    <div className="cart-quantity">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        aria-label={`ลดจำนวน ${item.product_name}`}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.stock_quantity || undefined}
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.product_id, event.target.value)}
                        aria-label={`จำนวน ${item.product_name}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        disabled={item.stock_quantity > 0 && item.quantity >= item.stock_quantity}
                        aria-label={`เพิ่มจำนวน ${item.product_name}`}
                      >
                        +
                      </button>
                    </div>
                    <strong>{formatPrice(item.price * item.quantity)}</strong>
                  </article>
                ))}
              </div>

              <aside className="cart-summary">
                <h2>สรุปคำสั่งซื้อ</h2>
                <div>
                  <span>จำนวนสินค้า</span>
                  <strong>{itemCount} รายการ</strong>
                </div>
                <div>
                  <span>ยอดรวม</span>
                  <strong>{formatPrice(totalAmount)}</strong>
                </div>
                <button type="button" onClick={() => onNavigate(isCustomerUser(user) ? '/payment' : '/login')}>
                  ดำเนินการชำระเงิน
                </button>
                <button type="button" className="cart-continue" onClick={() => onNavigate('/products')}>
                  เลือกสินค้าเพิ่ม
                </button>
              </aside>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
