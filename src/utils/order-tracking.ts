import { type Order, type OrderStatus } from '../types/api';
import { formatMoney, formatQty, orderPublicCode } from './format';

export const TRACKING_STEPS: OrderStatus[] = [
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'ENTREGADO',
];

export function trackingStepIndex(status: OrderStatus | undefined): number {
  if (!status || status === 'CANCELADO' || status === 'PENDIENTE_WHATSAPP') {
    return -1;
  }
  if (status === 'LISTO' || status === 'EN_ENTREGA') {
    return TRACKING_STEPS.indexOf('EN_PREPARACION');
  }
  return Math.max(0, TRACKING_STEPS.indexOf(status));
}

export function trackingNextStep(status: OrderStatus): string {
  switch (status) {
    case 'PENDIENTE_WHATSAPP':
      return 'Enviá el mensaje de WhatsApp para que la carnicería confirme tu pedido.';
    case 'PENDIENTE':
      return 'Ya recibimos tu pedido. En breve la carnicería lo confirma.';
    case 'CONFIRMADO':
      return 'Tu pedido está confirmado. El siguiente paso es la preparación.';
    case 'EN_PREPARACION':
      return 'Estamos preparando tu pedido. El peso real se registra en esta etapa.';
    case 'LISTO':
      return 'Tu pedido está listo. Coordinamos la entrega con vos.';
    case 'EN_ENTREGA':
      return 'Tu pedido va en camino.';
    case 'ENTREGADO':
      return 'Pedido entregado. Gracias por elegir Rinde Más Carnes.';
    case 'CANCELADO':
      return 'Este pedido fue cancelado. Si necesitás uno nuevo, escribinos.';
    default:
      return '';
  }
}

export function trackingItemDetail(item: Order['items'][number]): string {
  if (item.saleUnit === 'KILOGRAM') {
    const requested = formatQty(item.requestedKg ?? item.quantity, 'KILOGRAM');
    const real = item.actualKg
      ? ` · Real: ${formatQty(item.actualKg, 'KILOGRAM')}`
      : ' · Peso real: pendiente';
    return `Solicitado: ${requested}${real}`;
  }
  if (item.estimatedMinKg && item.estimatedMaxKg) {
    const real = item.actualKg
      ? ` · Real: ${formatQty(item.actualKg, 'KILOGRAM')}`
      : ' · Peso real: pendiente';
    return `${item.quantity} u. · estimado ${item.estimatedMinKg}–${item.estimatedMaxKg} kg${real}`;
  }
  return formatQty(item.quantity, 'UNIT');
}

export function trackingItemAmount(item: Order['items'][number]): {
  amount: string;
  pending: boolean;
} {
  if (item.finalLineTotal != null) {
    return { amount: formatMoney(item.finalLineTotal), pending: false };
  }
  const estimated =
    item.estimatedLineTotalMax && item.estimatedLineTotalMax !== item.estimatedLineTotal
      ? `${formatMoney(item.estimatedLineTotal)} – ${formatMoney(item.estimatedLineTotalMax)}`
      : formatMoney(item.estimatedLineTotal);
  return { amount: estimated, pending: true };
}

export function trackingTotalLabel(order: Order): string {
  return order.finalTotal ? 'Total final' : 'Total estimado';
}

export function trackingTotalValue(order: Order): string {
  if (order.finalTotal) return formatMoney(order.finalTotal);
  if (order.estimatedTotalMax && order.estimatedTotalMax !== order.estimatedTotal) {
    return `${formatMoney(order.estimatedTotal)} – ${formatMoney(order.estimatedTotalMax)}`;
  }
  return formatMoney(order.estimatedTotal);
}

export { orderPublicCode };
