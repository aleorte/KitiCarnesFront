import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatKg(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`;
}

export function formatQty(value: string | number | null | undefined, unit: 'UNIT' | 'KILOGRAM') {
  const amount = Number(value ?? 0);
  const formatted = amount.toLocaleString('es-AR', {
    minimumFractionDigits: unit === 'KILOGRAM' ? 2 : Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 3,
  });
  return unit === 'KILOGRAM' ? `${formatted} kg` : `${formatted} u.`;
}

export function formatDateSlash(isoDate: string, withYear = true) {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

export function formatCopyQty(value: string | number | null | undefined, unit: 'UNIT' | 'KILOGRAM') {
  const amount = Number(value ?? 0);
  const formatted = Number.isInteger(amount)
    ? String(amount)
    : amount.toLocaleString('es-AR', { maximumFractionDigits: 3, minimumFractionDigits: 0 });
  return unit === 'KILOGRAM' ? `${formatted} kg` : `${formatted} u.`;
}

export function formatKgDelta(requested: string | number | null | undefined, actual: string | number | null | undefined) {
  if (actual === null || actual === undefined || actual === '') return null;
  const delta = Number(actual) - Number(requested ?? 0);
  if (!Number.isFinite(delta) || delta === 0) return '0 kg';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${formatCopyQty(Math.abs(delta), 'KILOGRAM')}`;
}

export function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function formatDate(value: string | Date) {
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
      ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
      : new Date(value);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function toDecimalString(value: number, digits = 3) {
  return value.toFixed(digits);
}

export function dateOnly(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isVariableWeight(item: {
  estimatedMinKg?: string | number | null;
  estimatedMaxKg?: string | number | null;
}) {
  return item.estimatedMinKg != null && item.estimatedMaxKg != null && item.estimatedMinKg !== '' && item.estimatedMaxKg !== '';
}

export function needsWeighing(item: {
  saleUnit: 'UNIT' | 'KILOGRAM';
  estimatedMinKg?: string | number | null;
  estimatedMaxKg?: string | number | null;
}) {
  return item.saleUnit === 'KILOGRAM' || isVariableWeight(item);
}

export function formatEstimatedKgRange(minKg: string | number | null | undefined, maxKg: string | number | null | undefined) {
  if (minKg == null || maxKg == null || minKg === '' || maxKg === '') return null;
  const min = Number(minKg).toLocaleString('es-AR', { maximumFractionDigits: 3 });
  const max = Number(maxKg).toLocaleString('es-AR', { maximumFractionDigits: 3 });
  return `${min} a ${max} kg`;
}

export function estimatedLineTotals(item: {
  salePrice: string | number;
  quantity: number;
  saleUnit: 'UNIT' | 'KILOGRAM';
  estimatedMinKg?: string | number | null;
  estimatedMaxKg?: string | number | null;
}) {
  const price = Number(item.salePrice);
  if (isVariableWeight(item)) {
    return {
      min: price * item.quantity * Number(item.estimatedMinKg),
      max: price * item.quantity * Number(item.estimatedMaxKg),
    };
  }
  const value = price * item.quantity;
  return { min: value, max: value };
}

export function formatMoneyRange(min: number, max: number) {
  if (min === max) return formatMoney(min);
  return `${formatMoney(min)} – ${formatMoney(max)}`;
}

export function mondayOf(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return dateOnly(copy);
}
