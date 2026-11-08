import type { Order, OrderItem, SaleUnit } from '../types/api';
import { needsWeighing } from './format';

export function requestedQuantity(item: Pick<OrderItem, 'saleUnit' | 'quantity' | 'requestedKg'>): string {
  if (item.saleUnit === 'KILOGRAM') return String(item.requestedKg ?? item.quantity);
  return String(item.quantity);
}

export function preparedQuantity(item: OrderItem): string {
  if (item.actualQuantity != null && item.actualQuantity !== '') return String(item.actualQuantity);
  if (item.saleUnit === 'KILOGRAM' && item.actualKg) return String(item.actualKg);
  return requestedQuantity(item);
}

export function prepUnitLabel(unit: SaleUnit): string {
  return unit === 'KILOGRAM' ? 'kg' : 'u.';
}

export function isItemReviewed(item: OrderItem): boolean {
  if (item.cancelledAt) return true;
  if (item.unavailableReason?.trim()) return true;
  return Boolean(item.preparedAt);
}

export function incompletePrepItems(order: Order): OrderItem[] {
  return order.items.filter((item) => !item.cancelledAt && !isItemReviewed(item));
}

export function needsRealWeight(item: OrderItem): boolean {
  return needsWeighing(item) || item.saleUnit === 'KILOGRAM';
}

