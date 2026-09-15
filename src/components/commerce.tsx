import { Beef } from 'lucide-react';
import { ORDER_STATUS_LABEL, type OrderStatus, type Product } from '../types/api';
import { Badge } from './ui';
import { formatKg, formatMoney } from '../utils/format';

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

export function PriceTag({ product }: { product: Pick<Product, 'salePrice' | 'saleUnit'> }) {
  return (
    <div>
      <p className="font-display text-2xl">{formatMoney(product.salePrice)}</p>
      <p className="text-xs uppercase tracking-widest text-ink-soft/70">
        {product.saleUnit === 'KILOGRAM' ? 'por kg' : 'por unidad'}
      </p>
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
        : status === 'PENDIENTE'
          ? 'warn'
          : status === 'EN_ENTREGA'
            ? 'forest'
            : status === 'EN_PREPARACION'
              ? 'neutral'
              : 'gold';
  return <Badge tone={tone}>{ORDER_STATUS_LABEL[status]}</Badge>;
}
