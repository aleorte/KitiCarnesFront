import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '../types/api';

export type CartItem = {
  productId: string;
  name: string;
  imageUrl?: string | null;
  saleUnit: Product['saleUnit'];
  salePrice: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  add: (product: Product, quantity: number) => void;
  update: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  estimatedTotal: number;
  hasWeightItems: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = 'kitikitikiti.cart';

function readCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart);

  const persist = (next: CartItem[]) => {
    setItems(next);
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  };

  const value = useMemo<CartContextValue>(() => {
    const estimatedTotal = items.reduce((sum, item) => sum + Number(item.salePrice) * item.quantity, 0);
    return {
      items,
      estimatedTotal,
      hasWeightItems: items.some((item) => item.saleUnit === 'KILOGRAM'),
      add(product, quantity) {
        persist(
          items.some((item) => item.productId === product.id)
            ? items.map((item) =>
                item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item,
              )
            : [
                ...items,
                {
                  productId: product.id,
                  name: product.name,
                  imageUrl: product.imageUrl,
                  saleUnit: product.saleUnit,
                  salePrice: product.salePrice,
                  quantity,
                },
              ],
        );
      },
      update(productId, quantity) {
        persist(
          quantity <= 0
            ? items.filter((item) => item.productId !== productId)
            : items.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
        );
      },
      remove(productId) {
        persist(items.filter((item) => item.productId !== productId));
      },
      clear() {
        persist([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('CartProvider missing');
  return ctx;
}
