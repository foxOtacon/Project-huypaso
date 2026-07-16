/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);
const CART_KEY = 'shopping_cart';

function readStoredCart() {
  try {
    const stored = localStorage.getItem(CART_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function persistCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function normalizeProduct(product) {
  return {
    product_id: product.product_id,
    product_name: product.product_name,
    price: Number(product.price || 0),
    unit: product.unit || 'หน่วย',
    image_url: product.image_url || '',
    stock_quantity: Number(product.stock_quantity || 0),
  };
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart);

  const updateItems = useCallback((updater) => {
    setItems((current) => {
      const nextItems = updater(current);
      persistCart(nextItems);
      return nextItems;
    });
  }, []);

  const addItem = useCallback(
    (product, quantity = 1) => {
      const nextProduct = normalizeProduct(product);

      updateItems((current) => {
        const existing = current.find((item) => item.product_id === nextProduct.product_id);

        if (existing) {
          return current.map((item) => {
            if (item.product_id !== nextProduct.product_id) return item;

            const nextQuantity = Math.min(
              item.quantity + quantity,
              nextProduct.stock_quantity || item.quantity + quantity,
            );

            return {
              ...item,
              ...nextProduct,
              quantity: nextQuantity,
            };
          });
        }

        return [
          ...current,
          {
            ...nextProduct,
            quantity: Math.min(quantity, nextProduct.stock_quantity || quantity),
          },
        ];
      });
    },
    [updateItems],
  );

  const updateQuantity = useCallback(
    (productId, quantity) => {
      const nextQuantity = Number(quantity);

      updateItems((current) => {
        if (nextQuantity <= 0) {
          return current.filter((item) => item.product_id !== productId);
        }

        return current.map((item) => {
          if (item.product_id !== productId) return item;

          return {
            ...item,
            quantity: Math.min(nextQuantity, item.stock_quantity || nextQuantity),
          };
        });
      });
    },
    [updateItems],
  );

  const removeItem = useCallback(
    (productId) => {
      updateItems((current) => current.filter((item) => item.product_id !== productId));
    },
    [updateItems],
  );

  const clearCart = useCallback(() => {
    updateItems(() => []);
  }, [updateItems]);

  const value = useMemo(() => {
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    );

    return {
      items,
      itemCount,
      totalAmount,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [items, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
