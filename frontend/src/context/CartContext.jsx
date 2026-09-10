import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem("queueless_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("queueless_cart", JSON.stringify(items));
    } catch (e) {
      console.error("Failed to sync cart to localStorage:", e);
    }
  }, [items]);

  const addItem = (menuItem) => {
    setItems((currentItems) => {
      const existing = currentItems.find((item) => item._id === menuItem._id);
      if (existing) {
        return currentItems.map((item) =>
          item._id === menuItem._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...currentItems, { ...menuItem, quantity: 1 }];
    });
  };

  const removeItem = (menuItemId) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item._id !== menuItemId)
    );
  };

  const updateQuantity = (menuItemId, quantity) => {
    const nextQuantity = Math.max(1, Number(quantity) || 1);
    setItems((currentItems) =>
      currentItems.map((item) =>
        item._id === menuItemId ? { ...item, quantity: nextQuantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem("queueless_cart");
    } catch {
      // ignore
    }
  };
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, clearCart, itemCount }),
    [items, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
