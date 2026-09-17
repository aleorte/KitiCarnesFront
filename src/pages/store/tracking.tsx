import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { storeApi } from '../../api/services';
import { StatusBadge } from '../../components/commerce';
import { Button, Field, Input, Skeleton } from '../../components/ui';
import { ORDER_STATUS_LABEL, type OrderStatus } from '../../types/api';
import { formatDate, formatMoney, formatQty } from '../../utils/format';

const STEPS: OrderStatus[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'EN_ENTREGA', 'ENTREGADO'];

export function OrderTrackingPage({ confirmation = false }: { confirmation?: boolean }) {
  const { id = '' } = useParams();
  const location = useLocation();
  const [phone, setPhone] = useState(
    (location.state as { phone?: string } | null)?.phone
      ?? sessionStorage.getItem('kitikitikiti.lastPhone')
      ?? '',
  );
  const [submittedPhone, setSubmittedPhone] = useState(confirmation ? phone : '');

  const order = useQuery({
    queryKey: ['track', id, submittedPhone],
    queryFn: () => storeApi.track(id, submittedPhone),
    enabled: Boolean(id && submittedPhone),
  });

  const currentIndex = useMemo(() => {
    const status = order.data?.status;
    if (!status || status === 'CANCELADO') return -1;
    if (status === 'LISTO') return STEPS.indexOf('EN_ENTREGA');
    return Math.max(0, STEPS.indexOf(status));
  }, [order.data?.status]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-blood">{confirmation ? 'Pedido confirmado' : 'Seguimiento'}</p>
      <h1 className="font-display text-4xl">{confirmation ? 'Ya estamos con tu pedido' : 'Consultá tu pedido'}</h1>
      <form
        className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedPhone(phone);
        }}
      >
        <Field label="Teléfono del pedido">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="1144556677" />
        </Field>
        <Button type="submit" className="self-end">
          Ver estado
        </Button>
      </form>

      {order.isLoading ? <Skeleton className="mt-8 h-80" /> : null}
      {order.isError ? <p className="mt-6 text-blood">{order.error.message}</p> : null}
      {order.data ? (
        <div className="mt-8 space-y-6 rounded-3xl bg-cream p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-soft">Pedido</p>
              <p className="font-mono text-sm">{order.data.id}</p>
            </div>
            <StatusBadge status={order.data.status} />
          </div>
          <ol className="space-y-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                    index <= currentIndex ? 'bg-ink text-cream' : 'bg-paper text-ink-soft'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={index <= currentIndex ? 'font-semibold' : 'text-ink-soft'}>
                  {ORDER_STATUS_LABEL[step]}
                </span>
              </li>
            ))}
          </ol>
          <ul className="space-y-2 text-sm">
            {order.data.items.map((item) => {
              const pendingFinal = item.finalLineTotal == null;
              const estimated =
                item.estimatedLineTotalMax && item.estimatedLineTotalMax !== item.estimatedLineTotal
                  ? `${formatMoney(item.estimatedLineTotal)} – ${formatMoney(item.estimatedLineTotalMax)}`
                  : formatMoney(item.estimatedLineTotal);
              return (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {item.productName}
                    {item.saleUnit === 'KILOGRAM' || item.estimatedMinKg ? (
                      <>
                        {' '}
                        · {item.estimatedMinKg ? `${item.quantity} u. · estimado ${item.estimatedMinKg}–${item.estimatedMaxKg} kg` : `Solicitado: ${formatQty(item.requestedKg ?? item.quantity, 'KILOGRAM')}`}
                        {item.actualKg ? ` · Real: ${formatQty(item.actualKg, 'KILOGRAM')}` : ' · Peso real: pendiente'}
                      </>
                    ) : (
                      <> · {formatQty(item.quantity, 'UNIT')}</>
                    )}
                  </span>
                  <span>
                    {pendingFinal ? estimated : formatMoney(item.finalLineTotal)}
                    {pendingFinal ? <span className="block text-xs text-ink-soft">estimado</span> : <span className="block text-xs text-ok">final</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between border-t border-line pt-4">
            <span>{order.data.finalTotal ? 'Total final' : 'Total estimado'}</span>
            <span className="font-display text-3xl">
              {order.data.finalTotal
                ? formatMoney(order.data.finalTotal)
                : order.data.estimatedTotalMax && order.data.estimatedTotalMax !== order.data.estimatedTotal
                  ? `${formatMoney(order.data.estimatedTotal)} – ${formatMoney(order.data.estimatedTotalMax)}`
                  : formatMoney(order.data.estimatedTotal)}
            </span>
          </div>
          {order.data.finalTotal == null ? (
            <p className="text-sm font-medium text-warn">
              El importe final se calcula cuando la carnicería registra el peso real. Todavía no está cobrado.
            </p>
          ) : (
            <p className="text-sm text-ink-soft">
              Pedido del {formatDate(order.data.orderedAt)}. Coordinamos la entrega con vos.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TrackSearchPage() {
  const [id, setId] = useState('');
  const [phone, setPhone] = useState('');
  const [lookup, setLookup] = useState<{ id: string; phone: string } | null>(null);
  const order = useQuery({
    queryKey: ['track-search', lookup],
    queryFn: () => storeApi.track(lookup!.id, lookup!.phone),
    enabled: Boolean(lookup),
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="font-display text-4xl">¿Dónde está tu pedido?</h1>
      <p className="mt-2 text-ink-soft">Ingresá el número de pedido y el teléfono con el que lo hiciste.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setLookup({ id, phone });
        }}
      >
        <Field label="Número de pedido">
          <Input value={id} onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="Teléfono">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full">
          Consultar
        </Button>
      </form>
      {order.data ? (
        <div className="mt-6 rounded-3xl bg-cream p-5">
          <StatusBadge status={order.data.status} />
          <p className="mt-3 font-display text-2xl">{formatMoney(order.data.estimatedTotal)}</p>
          <p className="text-sm text-ink-soft">Pedido del {formatDate(order.data.orderedAt)}</p>
        </div>
      ) : null}
      {order.isError ? <p className="mt-4 text-blood">{order.error.message}</p> : null}
    </div>
  );
}
