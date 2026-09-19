import type { Order, OrderItem } from '../types/api';
import {
  formatEstimatedKgRange,
  formatMoney,
  formatQty,
  isVariableWeight,
  needsWeighing,
  shortOrderId,
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

  lines.push(`Pedido #${shortOrderId(order.id)}`, '');

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

export function buildCustomerGreeting(firstName?: string | null) {
  const name = firstName?.trim();
  return name
    ? `Hola ${name}, somos Rinde Más Carnes.`
    : 'Hola, somos Rinde Más Carnes.';
}

export function canMessageOrderOnWhatsApp(status: Order['status']) {
  return status !== 'PENDIENTE' && status !== 'PENDIENTE_WHATSAPP' && status !== 'CANCELADO';
}
