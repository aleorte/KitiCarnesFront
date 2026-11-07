import type { Product, SaleMode, SaleUnit } from '../types/api';
import { isVariableWeight } from './format';

export function productSaleMode(product: Pick<Product, 'saleMode' | 'saleUnit'>): SaleMode {
  return product.saleMode ?? (product.saleUnit === 'UNIT' ? 'UNIT' : 'KILOGRAM');
}

export function allowsSaleUnit(product: Pick<Product, 'saleMode' | 'saleUnit'>, unit: SaleUnit): boolean {
  const mode = productSaleMode(product);
  if (mode === 'BOTH') return true;
  return mode === unit;
}

export function allowedSaleUnits(product: Pick<Product, 'saleMode' | 'saleUnit'>): SaleUnit[] {
  const mode = productSaleMode(product);
  if (mode === 'BOTH') return ['KILOGRAM', 'UNIT'];
  return [mode];
}

export function priceForSaleUnit(
  product: Pick<Product, 'salePrice' | 'salePriceKg' | 'salePriceUnit' | 'saleUnit' | 'saleMode' | 'estimatedMinKg' | 'estimatedMaxKg'>,
  unit: SaleUnit,
): string {
  if (unit === 'KILOGRAM') {
    return product.salePriceKg ?? product.salePrice;
  }
  if (isVariableWeight({ ...product, saleUnit: 'UNIT' })) {
    return product.salePriceKg ?? product.salePrice;
  }
  return product.salePriceUnit ?? product.salePrice;
}

export function unitLabel(unit: SaleUnit): string {
  return unit === 'KILOGRAM' ? 'kg' : 'u.';
}
