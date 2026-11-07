import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product, SaleUnit } from '../types/api';
import { estimatedLineTotals, needsWeighing } from '../utils/format';
import { allowedSaleUnits, priceForSaleUnit } from '../utils/sale-mode';

export type CartItem = {
  productId: string;
  saleUnit: SaleUnit;
  name: string;
  imageUrl?: string | null;
  salePrice: string;
  estimatedMinKg?: string | null;
  estimatedMaxKg?: string | null;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  add: (product: Product, quantity: number, saleUnit?: SaleUnit) => void;
  update: (productId: string, quantity: number, saleUnit?: SaleUnit) => void;
  remove: (productId: string, saleUnit?: SaleUnit) => void;
  clear: () => void;
  syncFromProducts: (products: Product[]) => void;
  estimatedTotalMin: number;
  estimatedTotalMax: number;
  estimatedTotal: number;
  hasWeightItems: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = 'kitikitikiti.cart';

function lineKey(productId: string, saleUnit: SaleUnit) {
  return `${productId}:${saleUnit}`;
}

function withoutEstimatedKg(item: CartItem): CartItem {
  return { ...item, estimatedMinKg: null, estimatedMaxKg: null };
}

function readCart(): CartItem[] {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as CartItem[];
    return items.map((item) =>
      item.saleUnit === 'KILOGRAM' ? withoutEstimatedKg(item) : item,
    );
  } catch {
    return [];
  }
}

function alignCartItem(item: CartItem, product?: Product): CartItem {
  if (!product) {
    return item.saleUnit === 'KILOGRAM' ? withoutEstimatedKg(item) : item;
  }
  const units = allowedSaleUnits(product);
  const saleUnit = units.includes(item.saleUnit) ? item.saleUnit : units[0];
  return {
    ...item,
    name: product.name,
    imageUrl: product.imageUrl,
    saleUnit,
    salePrice: priceForSaleUnit(product, saleUnit),
    estimatedMinKg:
      saleUnit === 'KILOGRAM' ? null : product.estimatedMinKg ?? null,
    estimatedMaxKg:
      saleUnit === 'KILOGRAM' ? null : product.estimatedMaxKg ?? null,
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
      add(product, quantity, chosenUnit) {
        const saleUnit = chosenUnit ?? allowedSaleUnits(product)[0];
        const key = lineKey(product.id, saleUnit);
        persist(
          items.some((item) => lineKey(item.productId, item.saleUnit) === key)
            ? items.map((item) =>
                lineKey(item.productId, item.saleUnit) === key
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              )
            : [
                ...items,
                {
                  productId: product.id,
                  saleUnit,
                  name: product.name,
                  imageUrl: product.imageUrl,
                  salePrice: priceForSaleUnit(product, saleUnit),
                  estimatedMinKg:
                    saleUnit === 'KILOGRAM' ? null : product.estimatedMinKg,
                  estimatedMaxKg:
                    saleUnit === 'KILOGRAM' ? null : product.estimatedMaxKg,
                  quantity,
                },
              ],
        );
      },
      update(productId, quantity, saleUnit) {
        const nextQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
        persist(
          items.map((item) =>
            item.productId === productId && (!saleUnit || item.saleUnit === saleUnit)
              ? { ...item, quantity: nextQuantity }
              : item,
          ),
        );
      },
      remove(productId, saleUnit) {
        persist(
          items.filter(
            (item) =>
              !(item.productId === productId && (!saleUnit || item.saleUnit === saleUnit)),
          ),
        );
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
