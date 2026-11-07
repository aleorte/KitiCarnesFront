import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ordersApi } from '../../api/services';
import { StatusBadge } from '../../components/commerce';
import { Button, Input } from '../../components/ui';
import type { Order, OrderItem } from '../../types/api';
import { formatMoney, formatQty, toDecimalString } from '../../utils/format';
import {
  incompletePrepItems,
  needsRealWeight,
  preparedQuantity,
  prepUnitLabel,
  requestedQuantity,
} from '../../utils/order-prep';
import { orderPublicCode } from '../../utils/format';

type DraftItem = {
  itemId: string;
  prepared: boolean;
  actualQuantity: string;
  unavailableReason: string;
};

function toDraft(item: OrderItem): DraftItem {
  return {
    itemId: item.id,
    prepared: Boolean(item.preparedAt) && !item.unavailableReason,
    actualQuantity: preparedQuantity(item),
    unavailableReason: item.unavailableReason ?? '',
  };
}

export function OrderPrepCard({
  order,
  canManage,
  actions,
}: {
  order: Order;
  canManage: boolean;
  actions: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<DraftItem[]>(() => order.items.filter((item) => !item.cancelledAt).map(toDraft));
  const preparing = order.status === 'EN_PREPARACION' || order.status === 'LISTO';
  const editable = canManage && (order.status === 'EN_PREPARACION' || order.status === 'LISTO');

  useEffect(() => {
    setDrafts(order.items.filter((item) => !item.cancelledAt).map(toDraft));
  }, [order]);

  const savePrep = useMutation({
    mutationFn: (items: DraftItem[]) =>
      ordersApi.updatePreparation(
        order.id,
        items.map((item) => ({
          itemId: item.itemId,
          prepared: item.prepared,
          actualQuantity: toDecimalString(Number(item.actualQuantity.replace(',', '.')) || 0),
          actualKg: needsRealWeight(order.items.find((row) => row.id === item.itemId)!)
            ? toDecimalString(Number(item.actualQuantity.replace(',', '.')) || 0)
            : undefined,
          unavailableReason: item.unavailableReason.trim() || null,
        })),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['delivery-route'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const start = useMutation({
    mutationFn: () => ordersApi.updateStatus(order.id, 'EN_PREPARACION'),
    onSuccess: () => {
      toast.success('Preparación iniciada');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const missing = drafts.filter((item) => !item.prepared && !item.unavailableReason.trim());
      if (missing.length) {
        throw new Error(
          `Falta controlar: ${missing
            .map((item) => order.items.find((row) => row.id === item.itemId)?.productName)
            .join(', ')}`,
        );
      }
      await savePrep.mutateAsync(drafts);
      return ordersApi.updateStatus(order.id, 'LISTO');
    },
    onSuccess: () => {
      toast.success('Pedido preparado. Ya figura en Recorrido.');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['delivery-route'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function patchItem(itemId: string, patch: Partial<DraftItem>, save = false) {
    setDrafts((current) => {
      const next = current.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item));
      if (save && editable) {
        void savePrep.mutateAsync(next).catch(() => undefined);
      }
      return next;
    });
  }

  function persist() {
    if (!editable) return;
    void savePrep.mutateAsync(drafts).catch(() => undefined);
  }

  const customer = `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim() || 'Cliente';
  const pending = incompletePrepItems({ ...order, items: order.items.map((item) => {
    const draft = drafts.find((row) => row.itemId === item.id);
    return {
      ...item,
      preparedAt: draft?.prepared ? item.preparedAt ?? new Date().toISOString() : null,
      unavailableReason: draft?.unavailableReason || null,
    };
  }) });

  return (
    <article className="rounded-3xl bg-cream p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight break-words">{customer}</p>
          <p className="mt-1 text-sm text-ink-soft">{order.customer?.phone}</p>
          <p className="text-sm text-ink-soft">{order.customer?.address}</p>
          <p className="mt-2 text-xs text-ink-soft">
            Pedido #{orderPublicCode(order)} · {formatMoney(order.finalTotal ?? order.estimatedTotal)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <ul className="mt-4 space-y-3">
        {order.items
          .filter((item) => !item.cancelledAt)
          .map((item) => {
            const draft = drafts.find((row) => row.itemId === item.id) ?? toDraft(item);
            const unit = prepUnitLabel(item.saleUnit);
            const done = draft.prepared;
            const missing = Boolean(draft.unavailableReason.trim());
            return (
              <li
                key={item.id}
                className={`rounded-2xl px-3 py-3 ${
                  done ? 'bg-ok/10' : missing ? 'bg-warn/10' : 'bg-paper'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => {
                      patchItem(
                        item.id,
                        {
                          prepared: !done,
                          unavailableReason: done ? draft.unavailableReason : '',
                        },
                        true,
                      );
                    }}
                    className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 transition disabled:opacity-50 ${
                      done ? 'border-ok bg-ok text-cream' : 'border-line bg-cream'
                    }`}
                    aria-label={`Marcar ${item.productName}`}
                  >
                    {done ? <Check className="h-5 w-5" /> : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{item.productName}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      Solicitado: {formatQty(requestedQuantity(item), item.saleUnit)}
                    </p>
                    {preparing ? (
                      <label className="mt-2 block">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                          Cantidad real ({unit})
                        </span>
                        <Input
                          className="mt-1 min-h-11"
                          inputMode="decimal"
                          disabled={!editable}
                          value={draft.actualQuantity}
                          onChange={(event) => patchItem(item.id, { actualQuantity: event.target.value })}
                          onBlur={persist}
                        />
                      </label>
                    ) : (
                      <p className="mt-1 text-sm font-semibold">
                        {formatQty(requestedQuantity(item), item.saleUnit)}
                      </p>
                    )}
                    {editable ? (
                      <label className="mt-2 block">
                        <span className="text-xs text-ink-soft">Si falta, anotá el motivo</span>
                        <Input
                          className="mt-1 min-h-11"
                          value={draft.unavailableReason}
                          placeholder="Sin stock, no llegó, etc."
                          onChange={(event) =>
                            patchItem(item.id, {
                              unavailableReason: event.target.value,
                              prepared: event.target.value.trim() ? false : draft.prepared,
                            })
                          }
                          onBlur={persist}
                        />
                      </label>
                    ) : missing ? (
                      <p className="mt-1 text-sm text-warn">Faltante: {draft.unavailableReason}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
      </ul>

      {canManage && order.status === 'CONFIRMADO' ? (
        <Button className="mt-4 min-h-12 w-full" disabled={start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? 'Iniciando...' : 'Iniciar preparación'}
        </Button>
      ) : null}

      {canManage && order.status === 'EN_PREPARACION' ? (
        <Button
          className="mt-4 min-h-12 w-full"
          disabled={finish.isPending || savePrep.isPending}
          onClick={() => finish.mutate()}
        >
          {finish.isPending ? 'Finalizando...' : `Finalizar preparación${pending.length ? ` (${pending.length} pendientes)` : ''}`}
        </Button>
      ) : null}

      {order.status === 'LISTO' ? (
        <p className="mt-4 rounded-2xl bg-ok/15 px-3 py-2 text-sm font-semibold">
          Preparado. La entrega se marca desde Recorrido.
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">{actions}</div>
    </article>
  );
}
