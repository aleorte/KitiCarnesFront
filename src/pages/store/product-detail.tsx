import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { storeApi } from '../../api/services';
import { PriceTag, ProductMedia, WeightPriceNotice } from '../../components/commerce';
import { QuantityDraftInput } from '../../components/quantity-draft-input';
import { Button, Skeleton } from '../../components/ui';
import { useCart } from '../../hooks/use-cart';
import { useStoreCatalog } from '../../hooks/use-store-catalog';
import { formatMoney, formatMoneyRange, estimatedLineTotals, isVariableWeight } from '../../utils/format';
import { isIntegerQuantity, parseQuantityDraft } from '../../utils/quantity-draft';

export function ProductDetailPage() {
  const { id = '' } = useParams();
  const { add } = useCart();
  const catalog = useStoreCatalog();
  const cached = catalog.data?.products.find((product) => product.id === id);
  const product = useQuery({
    queryKey: ['store-product', id],
    queryFn: () => storeApi.product(id),
    enabled: Boolean(id) && !cached && !catalog.isLoading,
    staleTime: 60_000,
  });
  const [qtyText, setQtyText] = useState('1');
  const [qtyError, setQtyError] = useState<string | null>(null);
  const item = cached ?? product.data;
  const parsedQty = parseQuantityDraft(qtyText);
  const displayQty = parsedQty ?? 0;

  if (catalog.isLoading || (!item && product.isLoading)) {
    return <div className="mx-auto max-w-6xl px-4 py-10"><Skeleton className="h-[480px]" /></div>;
  }
  if (!item) return <p className="p-10">El producto no está disponible.</p>;
  const isKg = item.saleUnit === 'KILOGRAM';
  const variable = isVariableWeight(item);
  const range = estimatedLineTotals({ ...item, quantity: displayQty });

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-2">
      <ProductMedia
        product={item}
        className="aspect-[4/3] w-full rounded-3xl shadow-card lg:aspect-auto lg:min-h-[28rem] lg:h-full"
        priority
      />
      <div>
        <Link to="/" className="text-sm text-blood">Volver al mostrador</Link>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-ink-soft/70">{item.category?.name}</p>
        <h1 className="font-display text-5xl">{item.name}</h1>
        <p className="mt-4 max-w-lg text-ink-soft/80">{item.description ?? 'Corte fresco, pesado al momento de preparar el pedido.'}</p>
        <div className="mt-6">
          <PriceTag product={item} quantity={displayQty || 1} />
        </div>
        <WeightPriceNotice product={item} quantity={displayQty || 1} />
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
                  onClick={() => {
                    setQtyText(String(preset));
                    setQtyError(null);
                  }}
                  className={`rounded-full px-3 py-2 text-sm ${parsedQty === preset ? 'bg-ink text-cream' : 'bg-paper'}`}
                >
                  {preset} kg
                </button>
              ))}
              <QuantityDraftInput
                value={qtyText}
                aria-label="Cantidad en kilos"
                className="max-w-32"
                onChange={(next) => {
                  setQtyText(next);
                  setQtyError(null);
                }}
              />
            </div>
          ) : (
            <QuantityDraftInput
              value={qtyText}
              aria-label="Cantidad en unidades"
              className="mt-3 max-w-32"
              onChange={(next) => {
                setQtyText(next);
                setQtyError(null);
              }}
            />
          )}
          {qtyError ? <p className="mt-3 text-sm text-blood">{qtyError}</p> : null}
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
              const quantity = parseQuantityDraft(qtyText);
              if (quantity == null) {
                setQtyError('Ingresá una cantidad para agregar al pedido.');
                return;
              }
              if (!isKg && !isIntegerQuantity(quantity)) {
                setQtyError('Para este corte la cantidad tiene que ser un número entero.');
                return;
              }
              add(item, quantity);
              toast.success(`${item.name} × ${isKg ? `${quantity} kg` : `${quantity} u.`} agregado al pedido`);
            }}
          >
            Agregar al pedido
          </Button>
        </div>
      </div>
    </div>
  );
}
