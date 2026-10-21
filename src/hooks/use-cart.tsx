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
  syncFromProducts: (products: Product[]) => void;
  estimatedTotalMin: number;
  estimatedTotalMax: number;
  estimatedTotal: number;
  hasWeightItems: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = 'kitikitikiti.cart';

function withoutEstimatedKg(item: CartItem): CartItem {
  return { ...item, estimatedMinKg: null, estimatedMaxKg: null };
}

function readCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as CartItem[];
    return items.map((item) => (item.saleUnit === 'KILOGRAM' ? withoutEstimatedKg(item) : item));
  } catch {
    return [];
  }
}

function alignCartItem(item: CartItem, product?: Product): CartItem {
  if (!product) {
    return item.saleUnit === 'KILOGRAM' ? withoutEstimatedKg(item) : item;
  }
  return {
    ...item,
    name: product.name,
    imageUrl: product.imageUrl,
    saleUnit: product.saleUnit,
    salePrice: product.salePrice,
    estimatedMinKg: product.saleUnit === 'KILOGRAM' ? null : product.estimatedMinKg ?? null,
    estimatedMaxKg: product.saleUnit === 'KILOGRAM' ? null : product.estimatedMaxKg ?? null,
  };
}

function cartSnapshot(items: CartItem[]) {
  return JSON.stringify(
    items.map((item) => ({
      productId: item.productId,
      saleUnit: item.saleUnit,
      salePrice: item.salePrice,
      estimatedMinKg: item.estimatedMinKg ?? null,
      estimatedMaxKg: item.estimatedMaxKg ?? null,
      quantity: item.quantity,
      name: item.name,
    })),
  );
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
                  estimatedMinKg:
                    product.saleUnit === 'KILOGRAM' ? null : product.estimatedMinKg,
                  estimatedMaxKg:
                    product.saleUnit === 'KILOGRAM' ? null : product.estimatedMaxKg,
                  quantity,
                },
              ],
        );
      },
      update(productId, quantity) {
        const nextQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
        persist(
          items.map((item) =>
            item.productId === productId ? { ...item, quantity: nextQuantity } : item,
          ),
        );
      },
      remove(productId) {
        persist(items.filter((item) => item.productId !== productId));
      },
      clear() {
        persist([]);
      },
      syncFromProducts(products) {
        const byId = new Map(products.map((product) => [product.id, product]));
        const next = items.map((item) => alignCartItem(item, byId.get(item.productId)));
        if (cartSnapshot(next) !== cartSnapshot(items)) {
          persist(next);
        }
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
