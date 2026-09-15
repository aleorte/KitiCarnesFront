import { Link } from 'react-router-dom';
import { ProductMedia, QuantityLabel } from '../../components/commerce';
import { Button, EmptyState, Input } from '../../components/ui';
import { useCart } from '../../hooks/use-cart';
import { formatMoney } from '../../utils/format';

export function CartPage() {
  const { items, update, remove, estimatedTotal, hasWeightItems } = useCart();

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
      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <article key={item.productId} className="grid grid-cols-[96px_1fr] gap-4 rounded-3xl bg-cream p-4 sm:grid-cols-[120px_1fr_auto]">
            <ProductMedia product={item} className="h-24 w-full rounded-2xl" />
            <div>
              <h2 className="font-display text-2xl">{item.name}</h2>
              <p className="text-sm text-ink-soft">{formatMoney(item.salePrice)} {item.saleUnit === 'KILOGRAM' ? '/ kg' : '/ u.'}</p>
              <div className="mt-3 flex items-center gap-3">
                <Input
                  type="number"
                  min={item.saleUnit === 'KILOGRAM' ? 0.1 : 1}
                  step={item.saleUnit === 'KILOGRAM' ? 0.05 : 1}
                  value={item.quantity}
                  onChange={(e) => update(item.productId, Number(e.target.value))}
                  className="max-w-28 py-2"
                />
                <QuantityLabel product={item} quantity={item.quantity} />
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:flex-col sm:items-end">
              <p className="font-display text-2xl">{formatMoney(Number(item.salePrice) * item.quantity)}</p>
              <button className="text-sm text-blood" onClick={() => remove(item.productId)}>
                Quitar
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-8 rounded-3xl bg-ink p-6 text-cream">
        <div className="flex items-center justify-between">
          <span>Total estimado</span>
          <span className="font-display text-4xl">{formatMoney(estimatedTotal)}</span>
        </div>
        {hasWeightItems ? (
          <p className="mt-3 text-sm text-gold">
            Este total es estimado: los cortes por kilo se confirman con el peso real al preparar.
          </p>
        ) : null}
        <Link to="/checkout">
          <Button className="mt-6 w-full bg-blood">Continuar el pedido</Button>
        </Link>
      </div>
    </div>
  );
}
