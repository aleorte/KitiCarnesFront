import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '../types/api';
import { estimatedLineTotals, isVariableWeight, needsWeighing } from '../utils/format';

export type CartItem = {
  productId: string;
  name: string;
  imageUrl?: string | null;
  saleUnit: Product['saleUnit'];
  salePrice: string;
  estimatedMinKg?: string | null;
  estimatedMaxKg?: string | null;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  add: (product: Product, quantity: number) => void;
  update: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  estimatedTotalMin: number;
  estimatedTotalMax: number;
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
    const totals = items.reduce(
      (acc, item) => {
        const range = estimatedLineTotals(item);
        return { min: acc.min + range.min, max: acc.max + range.max };
      },
      { min: 0, max: 0 },
    );
    return {
      items,
      estimatedTotalMin: totals.min,
      estimatedTotalMax: totals.max,
      estimatedTotal: totals.min,
      hasWeightItems: items.some((item) => needsWeighing(item)),
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
                  estimatedMinKg: product.estimatedMinKg,
                  estimatedMaxKg: product.estimatedMaxKg,
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

export { isVariableWeight };
