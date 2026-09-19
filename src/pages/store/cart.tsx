import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../api/services';
import { ProductMedia, QuantityLabel, WeightPriceNotice } from '../../components/commerce';
import { Button, EmptyState, Input } from '../../components/ui';
import { useCart } from '../../hooks/use-cart';
import { estimatedLineTotals, formatMoney, formatMoneyRange } from '../../utils/format';

export function CartPage() {
  const { items, update, remove, estimatedTotalMin, estimatedTotalMax, hasWeightItems } = useCart();
  const catalog = useQuery({
    queryKey: ['store-products', '', ''],
    queryFn: () => storeApi.products(),
    enabled: items.length > 0,
  });
  const availableIds = new Set((catalog.data ?? []).map((product) => product.id));
  const unavailable = items.filter((item) => catalog.isSuccess && !availableIds.has(item.productId));

  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="El pedido todavía está vacío"
          description="Elegí un corte del mostrador y sumalo con los kilos o unidades que necesites."
          action={
            <Link to="/">
              <Button>Ir al mostrador</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl">Tu pedido</h1>
      {unavailable.length > 0 ? (
        <p className="mt-4 rounded-2xl bg-warn/15 px-4 py-3 text-sm text-ink">
          {unavailable.length === 1
            ? `${unavailable[0].name} ya no está disponible. Quitalo del pedido para continuar.`
            : `Algunos cortes ya no están disponibles: ${unavailable.map((item) => item.name).join(', ')}. Quitalos para continuar.`}
        </p>
      ) : null}
      <div className="mt-8 space-y-4">
        {items.map((item) => {
          const range = estimatedLineTotals(item);
          const inactive = catalog.isSuccess && !availableIds.has(item.productId);
          return (
            <article key={item.productId} className="grid grid-cols-[96px_1fr] gap-4 rounded-3xl bg-cream p-4 sm:grid-cols-[120px_1fr_auto]">
              <ProductMedia product={item} className="h-24 w-full rounded-2xl" />
              <div>
                <h2 className="font-display text-2xl">{item.name}</h2>
                {inactive ? (
                  <p className="text-sm font-medium text-blood">Este corte ya no se ofrece.</p>
                ) : (
                  <p className="text-sm text-ink-soft">
                    {formatMoney(item.salePrice)} {item.saleUnit === 'KILOGRAM' || item.estimatedMinKg ? '/ kg' : '/ u.'}
                  </p>
                )}
                <WeightPriceNotice product={item} quantity={item.quantity} />
                <div className="mt-3 flex items-center gap-3">
                  <Input
                    type="number"
                    min={item.saleUnit === 'KILOGRAM' ? 0.1 : 1}
                    step={item.saleUnit === 'KILOGRAM' ? 0.05 : 1}
                    value={item.quantity}
                    disabled={inactive}
                    onChange={(e) => update(item.productId, Number(e.target.value))}
                    className="max-w-28 py-2"
                  />
                  <QuantityLabel product={item} quantity={item.quantity} />
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:flex-col sm:items-end">
                <p className="font-display text-2xl">{inactive ? '—' : formatMoneyRange(range.min, range.max)}</p>
                <button className="text-sm text-blood" onClick={() => remove(item.productId)}>
                  Quitar
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-8 rounded-3xl bg-ink p-6 text-cream">
        <div className="flex items-center justify-between gap-4">
          <span>Total estimado</span>
          <span className="font-display text-4xl">{formatMoneyRange(estimatedTotalMin, estimatedTotalMax)}</span>
        </div>
        {hasWeightItems ? (
          <p className="mt-3 text-sm font-medium text-gold">
            Este total es estimado. El importe final se calcula con el peso real al entregar. No es el precio definitivo.
          </p>
        ) : null}
        {unavailable.length > 0 ? (
          <Button className="mt-6 w-full" disabled>
            Quitá los cortes no disponibles
          </Button>
        ) : (
          <Link to="/checkout">
            <Button className="mt-6 w-full bg-blood">Continuar el pedido</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
