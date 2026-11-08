import type { Order, OrderItem, SaleUnit } from '../types/api';
import {
  formatEstimatedKgRange,
  formatMoney,
  formatQty,
  isVariableWeight,
  needsWeighing,
  orderPublicCode,
} from './format';

function itemLines(item: OrderItem): string[] {
  const title = `🥩 ${item.productName}`;

  if (item.saleUnit === 'UNIT' && isVariableWeight(item)) {
    const lines = [`${title} — ${formatQty(item.quantity, 'UNIT')}`];
    if (item.actualKg) {
      lines.push(`Peso: ${formatQty(item.actualKg, 'KILOGRAM')}`);
      if (item.finalLineTotal) lines.push(`Importe: ${formatMoney(item.finalLineTotal)}`);
      else lines.push(`Precio: ${formatMoney(item.unitPrice)}/kg`);
    } else {
      const range = formatEstimatedKgRange(item.estimatedMinKg, item.estimatedMaxKg);
      if (range) lines.push(`Peso estimado: ${range}`);
      lines.push(`Precio: ${formatMoney(item.unitPrice)}/kg`);
    }
    return lines;
  }

  if (item.saleUnit === 'KILOGRAM') {
    const kg = item.actualKg ?? item.requestedKg ?? item.quantity;
    const lines = [`${title} — ${formatQty(kg, 'KILOGRAM')}`];
    if (item.actualKg && item.finalLineTotal) {
      lines.push(`Importe: ${formatMoney(item.finalLineTotal)}`);
    } else {
      lines.push(`Precio: ${formatMoney(item.unitPrice)}/kg`);
      if (!item.actualKg) lines.push('El importe final se confirma al pesar.');
    }
    return lines;
  }

  const lines = [`${title} — ${formatQty(item.quantity, 'UNIT')}`];
  if (item.finalLineTotal) lines.push(`Importe: ${formatMoney(item.finalLineTotal)}`);
  else lines.push(`Importe: ${formatMoney(item.estimatedLineTotal)}`);
  return lines;
}

export function buildConfirmedOrderWhatsAppMessage(order: Order): string {
  const name = order.customer?.firstName?.trim() || 'cliente';
  const lines: string[] = [
    `Hola ${name} 👋`,
    '',
    'Somos Rinde Más Carnes.',
    '',
    'Tu pedido fue confirmado:',
    '',
  ];

  for (const item of order.items) {
    lines.push(...itemLines(item), '');
  }

  lines.push(`Pedido #${orderPublicCode(order)}`, '');

  const pendingWeight = order.items.some((item) => needsWeighing(item) && !item.actualKg);

  if (order.finalTotal) {
    lines.push(`Total: ${formatMoney(order.finalTotal)}`);
  } else if (order.estimatedTotalMax && order.estimatedTotalMax !== order.estimatedTotal) {
    lines.push(
      `Total estimado: ${formatMoney(order.estimatedTotal)} – ${formatMoney(order.estimatedTotalMax)}`,
    );
    lines.push('El importe final se confirma al pesar.');
  } else {
    lines.push(`Total estimado: ${formatMoney(order.estimatedTotal)}`);
    if (pendingWeight) lines.push('El importe final se confirma al pesar.');
  }

  lines.push('', 'Muchas gracias.', 'Rinde Más Carnes');
  return lines.join('\n');
}

type DeliveryInvoiceOrder = {
  id: string;
  trackingCode?: string | null;
  finalTotal?: string | number | null;
  items: Array<{
    productName: string;
    saleUnit: SaleUnit;
    quantity: string;
    actualQuantity?: string | null;
    unitPrice?: string | number | null;
    unavailableReason?: string | null;
    lineTotal?: string | number | null;
  }>;
};

function lineSubtotal(item: DeliveryInvoiceOrder['items'][number]): number | null {
  if (item.lineTotal != null && item.lineTotal !== '') {
    const amount = Number(item.lineTotal);
    return Number.isFinite(amount) ? amount : null;
  }
  const qty = Number(item.actualQuantity ?? item.quantity);
  const price = Number(item.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
  return qty * price;
}

function deliveryItemBlock(item: DeliveryInvoiceOrder['items'][number]): string[] {
  const qty = formatQty(item.actualQuantity ?? item.quantity, item.saleUnit);
  if (item.unavailableReason?.trim()) {
    return [`❌ ${item.productName} — no se pudo incluir (${item.unavailableReason.trim()})`];
  }
  const subtotal = lineSubtotal(item);
  const qtyLabel = item.saleUnit === 'KILOGRAM' ? 'Kilos' : 'Cantidad';
  const lines = [`🥩 ${item.productName}`, `${qtyLabel}: ${qty}`];
  if (subtotal != null) {
    lines.push(`Subtotal: ${formatMoney(subtotal)}`);
  }
  return lines;
}

export function buildDeliveryWhatsAppMessage(
  customerName: string,
  orders: DeliveryInvoiceOrder[],
): string {
  const firstName = customerName.trim().split(/\s+/)[0] || 'hola';
  const lines: string[] = [
    `Hola ${firstName} 👋`,
    '',
    'Somos Rinde Más Carnes 🥩',
    'Estamos por llegar con tu pedido 🚚',
    '',
  ];

  const billable = orders.length ? orders : [];
  billable.forEach((order, index) => {
    if (billable.length > 1) {
      lines.push(`📦 Pedido ${index + 1} · #${orderPublicCode(order)}`);
    } else {
      lines.push(`📦 Pedido #${orderPublicCode(order)}`);
    }
    lines.push('🧾 Detalle:');
    lines.push('');
    for (const item of order.items) {
      lines.push(...deliveryItemBlock(item), '');
    }
    const billed = order.items.filter((item) => !item.unavailableReason?.trim());
    const summed = billed.reduce((acc, item) => acc + (lineSubtotal(item) ?? 0), 0);
    const total = order.finalTotal != null && order.finalTotal !== '' ? Number(order.finalTotal) : summed;
    lines.push(`💰 Total a pagar: ${formatMoney(Number.isFinite(total) ? total : summed)}`);
    lines.push('');
  });

  lines.push('¡Gracias por elegirnos! ❤️');
  lines.push('Rinde Más Carnes');
  return lines.join('\n');
}

export function buildCustomerGreeting(firstName?: string | null) {
  const name = firstName?.trim();
  return name
    ? `Hola ${name}, somos Rinde Más Carnes.`
    : 'Hola, somos Rinde Más Carnes.';
}

export function canMessageOrderOnWhatsApp(status: Order['status']) {
  return status !== 'PENDIENTE' && status !== 'PENDIENTE_WHATSAPP' && status !== 'CANCELADO';
}
