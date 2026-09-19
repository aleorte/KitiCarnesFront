import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { storeApi } from '../../api/services';
import { PriceTag, ProductMedia, WeightPriceNotice } from '../../components/commerce';
import { Button, Input, Skeleton } from '../../components/ui';
import { useCart } from '../../hooks/use-cart';
import { formatMoney, formatMoneyRange, estimatedLineTotals, isVariableWeight } from '../../utils/format';

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { add } = useCart();
  const product = useQuery({ queryKey: ['store-product', id], queryFn: () => storeApi.product(id) });
  const [qty, setQty] = useState(1);

  if (product.isLoading) return <div className="mx-auto max-w-6xl px-4 py-10"><Skeleton className="h-[480px]" /></div>;
  if (!product.data) return <p className="p-10">El producto no está disponible.</p>;

  const item = product.data;
  const isKg = item.saleUnit === 'KILOGRAM';
  const variable = isVariableWeight(item);
  const range = estimatedLineTotals({ ...item, quantity: qty });

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2">
      <ProductMedia product={item} className="h-[420px] w-full rounded-3xl" />
      <div>
        <Link to="/" className="text-sm text-blood">Volver al mostrador</Link>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-ink-soft/70">{item.category?.name}</p>
        <h1 className="font-display text-5xl">{item.name}</h1>
        <p className="mt-4 max-w-lg text-ink-soft/80">{item.description ?? 'Corte fresco, pesado al momento de preparar el pedido.'}</p>
        <div className="mt-6">
          <PriceTag product={item} quantity={qty} />
        </div>
        <WeightPriceNotice product={item} quantity={qty} />
        <div className="mt-8 rounded-3xl bg-cream p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft/70">
            {isKg ? 'Kilos a pedir' : 'Unidades'}
          </p>
          {variable ? (
            <p className="mt-1 text-sm text-ink-soft">
              Pedís unidades. El peso real lo registra la carnicería al entregar el pedido.
            </p>
          ) : null}
          {isKg ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[0.5, 1, 1.25, 2.5].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setQty(preset)}
                  className={`rounded-full px-3 py-2 text-sm ${qty === preset ? 'bg-ink text-cream' : 'bg-paper'}`}
                >
                  {preset} kg
                </button>
              ))}
              <Input
                type="number"
                min="0.1"
                step="0.05"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 0)}
                className="max-w-32"
              />
            </div>
          ) : (
            <Input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
              className="mt-3 max-w-32"
            />
          )}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm text-ink-soft">{variable ? 'Precio estimado' : 'Subtotal estimado'}</span>
            <span className="font-display text-3xl">{formatMoneyRange(range.min, range.max)}</span>
          </div>
          {variable ? (
            <p className="mt-2 text-sm font-medium text-warn">
              Este importe no es definitivo. El precio final = peso real × {formatMoney(item.salePrice)}/kg.
            </p>
          ) : null}
          <Button
            className="mt-5 w-full"
            onClick={() => {
              add(item, qty);
              toast.success('Agregado al pedido');
            }}
          >
            Agregar al pedido
          </Button>
        </div>
      </div>
    </div>
  );
}
