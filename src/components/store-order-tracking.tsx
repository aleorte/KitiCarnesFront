import { StatusBadge } from './commerce';
import { ORDER_STATUS_LABEL, type Order, type OrderStatus } from '../types/api';
import { formatDate } from '../utils/format';
import {
  TRACKING_STEPS,
  trackingItemAmount,
  trackingItemDetail,
  trackingNextStep,
  trackingStepIndex,
  trackingTotalLabel,
  trackingTotalValue,
  orderPublicCode,
} from '../utils/order-tracking';

function statusCardClass(status: OrderStatus) {
  if (status === 'ENTREGADO' || status === 'LISTO') return 'bg-ok/15 text-ink';
  if (status === 'CANCELADO') return 'bg-blood/10 text-ink';
  if (status === 'PENDIENTE' || status === 'PENDIENTE_WHATSAPP') return 'bg-warn/15 text-ink';
  return 'bg-ink text-cream';
}

export function StoreOrderTracking({ order }: { order: Order }) {
  const currentIndex = trackingStepIndex(order.status);
  const code = orderPublicCode(order);
  const nextStep = trackingNextStep(order.status);

  return (
    <div className="space-y-4">
      <section className={`rounded-3xl p-5 sm:p-6 ${statusCardClass(order.status)}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Estado actual</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-3xl sm:text-4xl">{ORDER_STATUS_LABEL[order.status]}</h2>
          <span className="rounded-full bg-cream/95 px-1 py-1">
            <StatusBadge status={order.status} />
          </span>
        </div>
        <p className="mt-3 text-sm opacity-90">{nextStep}</p>
      </section>

      <section className="rounded-3xl bg-cream p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft/70">
          Código de seguimiento
        </p>
        <p className="mt-2 font-mono text-2xl font-semibold tracking-wide">#{code}</p>
        <p className="mt-2 text-sm text-ink-soft">Pedido del {formatDate(order.orderedAt)}</p>
      </section>

      {order.customer ? (
        <section className="rounded-3xl bg-cream p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft/70">
            Datos del pedido
          </p>
          <p className="mt-3 font-semibold">
            {order.customer.firstName} {order.customer.lastName}
          </p>
          <p className="text-sm text-ink-soft">{order.customer.phone}</p>
          <p className="text-sm text-ink-soft">{order.customer.address}</p>
          {order.notes ? <p className="mt-3 text-sm text-ink">{order.notes}</p> : null}
        </section>
      ) : null}

      <section className="rounded-3xl bg-cream p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft/70">Progreso</p>
        <ol className="mt-4 space-y-3">
          {TRACKING_STEPS.map((step, index) => {
            const done = currentIndex >= 0 && index <= currentIndex;
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                    done ? 'bg-ink text-cream' : 'bg-paper text-ink-soft'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={done ? 'font-semibold' : 'text-ink-soft'}>
                  {ORDER_STATUS_LABEL[step]}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-3xl bg-cream p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft/70">Resumen</p>
        <ul className="mt-4 space-y-3 text-sm">
          {order.items.map((item) => {
            const amount = trackingItemAmount(item);
            return (
              <li key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.productName}
                  <span className="mt-0.5 block text-ink-soft">{trackingItemDetail(item)}</span>
                </span>
                <span className="text-right">
                  {amount.amount}
                  <span className={`block text-xs ${amount.pending ? 'text-ink-soft' : 'text-ok'}`}>
                    {amount.pending ? 'estimado' : 'final'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
          <span>{trackingTotalLabel(order)}</span>
          <span className="font-display text-3xl">{trackingTotalValue(order)}</span>
        </div>
        {order.finalTotal == null ? (
          <p className="mt-3 text-sm font-medium text-warn">
            El importe final se calcula cuando la carnicería registra el peso real. Todavía no está cobrado.
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">Coordinamos la entrega con vos.</p>
        )}
      </section>
    </div>
  );
}
