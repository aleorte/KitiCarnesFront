import { Beef } from 'lucide-react';
import { ORDER_STATUS_LABEL, type OrderStatus, type Product } from '../types/api';
import { Badge } from './ui';
import {
  formatEstimatedKgRange,
  formatKg,
  formatMoney,
  formatMoneyRange,
  estimatedLineTotals,
  isVariableWeight,
} from '../utils/format';

export function ProductMedia({ product, className = '' }: { product: Pick<Product, 'name' | 'imageUrl'>; className?: string }) {
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt={product.name} className={`object-cover ${className}`} />;
  }

  return (
    <div className={`flex items-center justify-center bg-linear-to-br from-ink to-blood-dark text-gold ${className}`}>
      <Beef className="h-10 w-10" />
    </div>
  );
}

export function PriceTag({
  product,
  quantity = 1,
}: {
  product: Pick<Product, 'salePrice' | 'saleUnit' | 'estimatedMinKg' | 'estimatedMaxKg'>;
  quantity?: number;
}) {
  const variable = isVariableWeight(product);
  const pricedByKg = product.saleUnit === 'KILOGRAM' || variable;
  const range = estimatedLineTotals({ ...product, quantity });

  return (
    <div>
      <p className="font-display text-2xl">{formatMoney(product.salePrice)}</p>
      <p className="text-xs uppercase tracking-widest text-ink-soft/70">{pricedByKg ? 'por kg' : 'por unidad'}</p>
      {variable ? (
        <p className="mt-1 text-sm font-semibold text-ink">
          Estimado: {formatMoneyRange(range.min, range.max)}
        </p>
      ) : null}
    </div>
  );
}

export function WeightPriceNotice({
  product,
  quantity = 1,
}: {
  product: Pick<Product, 'salePrice' | 'saleUnit' | 'estimatedMinKg' | 'estimatedMaxKg'>;
  quantity?: number;
}) {
  const variable = isVariableWeight(product);
  const byKg = product.saleUnit === 'KILOGRAM';
  if (!variable && !byKg) return null;

  const range = formatEstimatedKgRange(product.estimatedMinKg, product.estimatedMaxKg);
  const totals = estimatedLineTotals({ ...product, quantity });

  return (
    <div className="mt-4 rounded-2xl border-2 border-gold bg-gold/15 p-4 text-ink">
      {variable ? (
        <>
          <p className="text-base font-semibold">Peso estimado: {range}</p>
          <p className="mt-1 text-sm">
            Precio por kg: {formatMoney(product.salePrice)}. Precio estimado:{' '}
            {formatMoneyRange(totals.min, totals.max)}.
          </p>
          <p className="mt-2 text-sm font-medium">
            Pedís unidades. El importe final se calcula con el peso real al entregar.
          </p>
        </>
      ) : (
        <p className="text-base font-semibold">Precio por kg: {formatMoney(product.salePrice)}</p>
      )}
    </div>
  );
}

export function QuantityLabel({ product, quantity }: { product: Pick<Product, 'saleUnit'>; quantity: number }) {
  return <span>{product.saleUnit === 'KILOGRAM' ? formatKg(quantity) : `${quantity} u.`}</span>;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const tone =
    status === 'ENTREGADO' || status === 'LISTO'
      ? 'ok'
      : status === 'CANCELADO'
        ? 'danger'
        : status === 'PENDIENTE' || status === 'PENDIENTE_WHATSAPP'
          ? 'warn'
          : status === 'EN_ENTREGA'
            ? 'forest'
            : status === 'EN_PREPARACION'
              ? 'neutral'
              : 'gold';
  return <Badge tone={tone}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
