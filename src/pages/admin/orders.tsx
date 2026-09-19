import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { ordersApi, paymentsApi } from '../../api/services';
import { StatusBadge } from '../../components/commerce';
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { WhatsAppButton } from '../../components/whatsapp-button';
import {
  ORDER_FLOW,
  ORDER_STATUS_ACTIONS,
  ORDER_STATUS_FILTER,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  isOrderDeletable,
  isOrderEditable,
  orderFlowIndex,
  type Order,
  type OrderStatus,
  type PaymentMethod,
} from '../../types/api';
import { formatDate, formatKgDelta, formatMoney, formatQty, needsWeighing, shortOrderId } from '../../utils/format';
import {
  buildConfirmedOrderWhatsAppMessage,
  canMessageOrderOnWhatsApp,
} from '../../utils/order-whatsapp';

const WEIGHT_PATTERN = /^\d+(\.\d{1,3})?$/;
const QUANTITY_PATTERN = /^\d+(\.\d{1,3})?$/;

function missingActualKg(order: Order) {
  return order.items.filter(
    (item) =>
      !item.cancelledAt &&
      needsWeighing(item) &&
      (item.actualKg === null || item.actualKg === undefined || item.actualKg === ''),
  );
}

function canWeigh(status: OrderStatus) {
  return status === 'EN_PREPARACION' || status === 'LISTO' || status === 'EN_ENTREGA';
}

function customerName(order: Order) {
  return `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim() || 'cliente';
}

type OrderActionsProps = {
  order: Order;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
};

function OrderActions({ order, onEdit, onDelete }: OrderActionsProps) {
  const editable = isOrderEditable(order.status);
  const deletable = isOrderDeletable(order);

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        to={`/admin/pedidos/${order.id}`}
        title="Ver pedido"
        aria-label="Ver pedido"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-paper-2"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <button
        type="button"
        title={editable ? 'Editar pedido' : 'Este pedido ya no admite modificaciones'}
        aria-label="Editar pedido"
        disabled={!editable}
        onClick={() => onEdit(order)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {canMessageOrderOnWhatsApp(order.status) ? (
        <WhatsAppButton
          iconOnly
          phone={order.customer?.phone}
          message={buildConfirmedOrderWhatsAppMessage(order)}
        />
      ) : (
        <span className="inline-flex h-9 w-9" aria-hidden="true" />
      )}
      <button
        type="button"
        title={deletable ? 'Eliminar pedido' : 'Este pedido no se puede eliminar porque ya tiene historial'}
        aria-label="Eliminar pedido"
        disabled={!deletable}
        onClick={() => onDelete(order)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-blood transition hover:bg-blood/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Order | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);
  const orders = useQuery({
    queryKey: ['orders', status],
    queryFn: () => ordersApi.list({ status: status || undefined, limit: 50 }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OrderStatus }) => ordersApi.updateStatus(id, next),
    onSuccess: () => {
      toast.success('Estado actualizado');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error, variables) => {
      toast.error(error.message);
      if (error instanceof ApiError && error.status === 422) {
        navigate(`/admin/pedidos/${variables.id}`);
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => ordersApi.remove(id),
    onSuccess: () => {
      toast.success('Pedido eliminado');
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = orders.data?.data.filter((order) => {
    const haystack = `${order.customer?.firstName} ${order.customer?.lastName} ${order.customer?.phone}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  function runStatus(order: Order, next: OrderStatus) {
    if (next === 'ENTREGADO' && missingActualKg(order).length > 0) {
      toast.error('Registrá el peso real de cada corte de peso variable antes de entregar');
      navigate(`/admin/pedidos/${order.id}`);
      return;
    }
    statusMutation.mutate({ id: order.id, next });
  }

  return (
    <div>
      <PageHeader title="Pedidos" description="Confirmá, prepará y entregá. El peso real se pide solo en cortes de peso variable." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Cliente o teléfono" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {ORDER_STATUS_FILTER.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>
      {orders.isLoading ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-3xl bg-cream md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((order) => {
                  const primary = ORDER_STATUS_ACTIONS[order.status].find((action) => action.variant === 'primary');
                  return (
                    <tr key={order.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <Link to={`/admin/pedidos/${order.id}`} className="font-semibold hover:text-blood">
                          {customerName(order)}
                        </Link>
                        <p className="text-ink-soft">{order.customer?.address}</p>
                      </td>
                      <td className="px-4 py-3">{order.customer?.phone}</td>
                      <td className="px-4 py-3">{formatDate(order.orderedAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                        {primary ? (
                          <button
                            type="button"
                            className="mt-1 block text-xs font-semibold text-blood hover:underline disabled:opacity-50"
                            disabled={statusMutation.isPending}
                            onClick={() => runStatus(order, primary.to)}
                          >
                            {primary.label}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">{formatMoney(order.finalTotal ?? order.estimatedTotal)}</td>
                      <td className="px-4 py-3 text-right">
                        <OrderActions order={order} onEdit={setEditing} onDelete={setPendingDelete} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {filtered?.map((order) => {
              const primary = ORDER_STATUS_ACTIONS[order.status].find((action) => action.variant === 'primary');
              return (
                <article key={order.id} className="rounded-3xl bg-cream p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/admin/pedidos/${order.id}`} className="min-w-0">
                      <p className="font-semibold">{customerName(order)}</p>
                      <p className="mt-1 text-sm text-ink-soft">{order.customer?.phone}</p>
                      <p className="text-sm text-ink-soft">{order.customer?.address}</p>
                      <p className="mt-2">
                        {formatMoney(order.finalTotal ?? order.estimatedTotal)} · {formatDate(order.orderedAt)}
                      </p>
                    </Link>
                    <StatusBadge status={order.status} />
                  </div>
                  {primary ? (
                    <Button
                      className="mt-3 w-full"
                      disabled={statusMutation.isPending}
                      onClick={() => runStatus(order, primary.to)}
                    >
                      {primary.label}
                    </Button>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <OrderActions order={order} onEdit={setEditing} onDelete={setPendingDelete} />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <OrderEditDialog
        order={editing}
        onClose={() => setEditing(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="¿Eliminar pedido?"
        description={
          pendingDelete
            ? `Estás por eliminar el pedido #${shortOrderId(pendingDelete.id)} de ${customerName(pendingDelete)}. Esta acción no se puede deshacer.`
            : 'Esta acción no se puede deshacer.'
        }
        confirmLabel="Eliminar pedido"
        danger
        loading={removeMutation.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) removeMutation.mutate(pendingDelete.id);
        }}
      />
    </div>
  );
}

function OrderEditDialog({
  order,
  onClose,
  onSaved,
}: {
  order: Order | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const hasActualKg = Boolean(order?.items.some((item) => item.actualKg != null && item.actualKg !== ''));

  useEffect(() => {
    if (!order) return;
    setNotes(order.notes ?? '');
    setQuantities(
      Object.fromEntries(order.items.filter((item) => !item.cancelledAt).map((item) => [item.id, item.quantity])),
    );
  }, [order]);

  const save = useMutation({
    mutationFn: () => {
      if (!order) throw new Error('Pedido inválido');
      const items = hasActualKg
        ? undefined
        : order.items
            .filter((item) => !item.cancelledAt && item.productId)
            .map((item) => {
              const quantity = (quantities[item.id] ?? '').trim();
              if (!quantity || !QUANTITY_PATTERN.test(quantity) || Number(quantity) <= 0) {
                throw new Error(`Revisá la cantidad de ${item.productName}`);
              }
              return {
                productId: item.productId,
                quantity,
                requestedKg: item.saleUnit === 'KILOGRAM' ? quantity : undefined,
              };
            });
      return ordersApi.update(order.id, {
        notes,
        ...(items && items.length ? { items } : {}),
      });
    },
    onSuccess: () => {
      toast.success('Pedido actualizado');
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Modal
      open={Boolean(order)}
      title={order ? `Editar pedido #${shortOrderId(order.id)}` : 'Editar pedido'}
      description={
        hasActualKg
          ? 'Este pedido ya tiene pesos reales. Solo se pueden editar las notas.'
          : 'Podés actualizar las notas y las cantidades solicitadas. El precio de venta histórico no cambia.'
      }
      onClose={onClose}
    >
      {order ? (
        <div className="space-y-4">
          {!hasActualKg
            ? order.items
                .filter((item) => !item.cancelledAt)
                .map((item) => (
                  <Field
                    key={item.id}
                    label={`${item.productName} (${item.saleUnit === 'KILOGRAM' ? 'kg' : 'u.'})`}
                  >
                    <Input
                      inputMode="decimal"
                      value={quantities[item.id] ?? ''}
                      onChange={(event) =>
                        setQuantities((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                    />
                  </Field>
                ))
            : null}
          <Field label="Notas">
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.one(id) });
  const [weight, setWeight] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState({ amount: '', method: 'EFECTIVO' as PaymentMethod });
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const statusMutation = useMutation({
    mutationFn: (next: OrderStatus) => ordersApi.updateStatus(id, next),
    onSuccess: () => {
      toast.success('Estado actualizado');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const weightMutation = useMutation({
    mutationFn: (items: Array<{ itemId: string; actualKg: string }>) => ordersApi.updateWeights(id, items),
    onSuccess: () => {
      toast.success('Pesos reales guardados');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payMutation = useMutation({
    mutationFn: () => paymentsApi.create({ amount: payment.amount, method: payment.method, orderId: id }),
    onSuccess: () => {
      toast.success('Pago registrado');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: () => ordersApi.remove(id),
    onSuccess: () => {
      toast.success('Pedido eliminado');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate('/admin/pedidos');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!order.data) return;
    setWeight(
      Object.fromEntries(
        order.data.items
          .filter((item) => needsWeighing(item))
          .map((item) => [item.id, item.actualKg ?? '']),
      ),
    );
    if (order.data.finalTotal && order.data.paymentStatus !== 'PAGADO') {
      setPayment((prev) => ({ ...prev, amount: prev.amount || order.data!.finalTotal! }));
    }
  }, [order.data]);

  const kgItems = useMemo(
    () => order.data?.items.filter((item) => !item.cancelledAt && needsWeighing(item)) ?? [],
    [order.data],
  );

  if (order.isLoading || !order.data) return <Skeleton className="h-96" />;
  const data = order.data;
  const weighing = canWeigh(data.status);
  const actions = ORDER_STATUS_ACTIONS[data.status];
  const flowIndex = orderFlowIndex(data.status);

  function weightsPayload() {
    const rows = kgItems
      .map((item) => ({ itemId: item.id, actualKg: (weight[item.id] ?? '').trim() }))
      .filter((row) => row.actualKg !== '');
    if (rows.some((row) => !WEIGHT_PATTERN.test(row.actualKg))) {
      toast.error('El peso real debe ser un número positivo con hasta 3 decimales');
      return null;
    }
    return rows;
  }

  async function saveWeights() {
    if (!kgItems.length) return true;
    const rows = weightsPayload();
    if (!rows) return false;
    if (!rows.length) {
      toast.error('Ingresá el peso real de cada corte de peso variable');
      return false;
    }
    if (rows.length !== kgItems.length) {
      toast.error('Falta el peso real de uno o más cortes de peso variable');
      return false;
    }
    await weightMutation.mutateAsync(rows);
    return true;
  }

  async function runAction(next: OrderStatus) {
    if (next === 'ENTREGADO' && kgItems.length) {
      const saved = await saveWeights();
      if (!saved) return;
    }
    statusMutation.mutate(next);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.customer?.firstName} ${data.customer?.lastName}`}
        description={`${data.customer?.address} · ${data.customer?.phone}`}
        actions={
          <div className="flex items-center gap-1">
            <StatusBadge status={data.status} />
            <OrderActions
              order={data}
              onEdit={() => setEditing(true)}
              onDelete={() => setPendingDelete(true)}
            />
          </div>
        }
      />

      <ol className="flex gap-2 overflow-x-auto pb-1">
        {ORDER_FLOW.map((step, index) => (
          <li
            key={step}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              index <= flowIndex && data.status !== 'CANCELADO' ? 'bg-ink text-cream' : 'bg-cream text-ink-soft'
            }`}
          >
            {ORDER_STATUS_LABEL[step]}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-cream p-5 lg:col-span-2">
          <h2 className="font-display text-2xl">Productos</h2>
          {weighing && kgItems.length ? (
            <p className="mt-1 text-sm text-ink-soft">
              Cargá el peso real solo de los cortes de peso variable. Lo solicitado es el aproximado del cliente.
            </p>
          ) : null}
          <ul className="mt-4 space-y-5">
            {data.items.map((item) => {
              const weighable = needsWeighing(item);
              const requested = item.requestedKg ?? item.quantity;
              const actual = item.actualKg;
              const delta = weighable
                ? formatKgDelta(item.saleUnit === 'KILOGRAM' ? requested : item.estimatedMinKg, actual)
                : null;
              const pendingFinal = item.finalLineTotal == null;
              return (
                <li key={item.id} className="border-b border-line pb-4 last:border-b-0">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">{item.productName}</span>
                    <span>
                      {pendingFinal
                        ? item.estimatedLineTotalMax && item.estimatedLineTotalMax !== item.estimatedLineTotal
                          ? `${formatMoney(item.estimatedLineTotal)} – ${formatMoney(item.estimatedLineTotalMax)}`
                          : formatMoney(item.estimatedLineTotal)
                        : formatMoney(item.finalLineTotal)}
                      <span className="block text-xs text-ink-soft">{pendingFinal ? 'estimado' : 'importe final'}</span>
                    </span>
                  </div>
                  {weighable ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">
                          {item.saleUnit === 'UNIT' ? 'Solicitado' : 'Kg solicitados'}
                        </p>
                        <p className="font-display text-2xl">
                          {item.saleUnit === 'UNIT'
                            ? `${formatQty(item.quantity, 'UNIT')}${item.estimatedMinKg ? ` · est. ${item.estimatedMinKg}–${item.estimatedMaxKg} kg` : ''}`
                            : formatQty(requested, 'KILOGRAM')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Peso real</p>
                        {weighing ? (
                          <Input
                            inputMode="decimal"
                            placeholder="Ej: 3.25"
                            value={weight[item.id] ?? ''}
                            onChange={(e) => setWeight((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="mt-1"
                          />
                        ) : (
                          <p className="font-display text-2xl">
                            {actual ? formatQty(actual, 'KILOGRAM') : 'Pendiente'}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-ink-soft">
                      Cantidad: {formatQty(item.quantity, item.saleUnit)}
                      {item.saleUnit === 'KILOGRAM' ? ' · precio por kg fijo' : ''}
                    </p>
                  )}
                  {delta && actual ? (
                    <p
                      className={`mt-2 text-sm ${
                        Number(actual) - Number(item.saleUnit === 'KILOGRAM' ? requested : item.estimatedMinKg) >= 0
                          ? 'text-ok'
                          : 'text-blood'
                      }`}
                    >
                      Diferencia vs estimado: {delta}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {weighing && kgItems.length ? (
            <Button className="mt-4" disabled={weightMutation.isPending} onClick={() => void saveWeights()}>
              Guardar pesos reales
            </Button>
          ) : null}
          <div className="mt-4 flex justify-between text-sm">
            <span>{data.finalTotal ? 'Importe final' : 'Importe estimado'}</span>
            <strong>
              {data.finalTotal
                ? formatMoney(data.finalTotal)
                : data.estimatedTotalMax && data.estimatedTotalMax !== data.estimatedTotal
                  ? `${formatMoney(data.estimatedTotal)} – ${formatMoney(data.estimatedTotalMax)}`
                  : formatMoney(data.estimatedTotal)}
            </strong>
          </div>
          {data.finalTotal == null && kgItems.length ? (
            <p className="mt-2 text-sm font-medium text-warn">
              Registrá el peso real de los cortes variables para calcular el importe. Eso no registra el pago.
            </p>
          ) : null}
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl bg-cream p-5">
            <h2 className="font-display text-2xl">Estado</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {data.status === 'EN_PREPARACION'
                ? kgItems.length
                  ? 'Pesá los cortes de peso variable y después entregá el pedido.'
                  : 'Este pedido no tiene cortes de peso variable. Podés entregarlo.'
                : 'El siguiente paso del flujo, sin pantallas extra.'}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {actions.map((action) => (
                <Button
                  key={action.to}
                  variant={action.variant}
                  disabled={statusMutation.isPending || weightMutation.isPending}
                  onClick={() => void runAction(action.to)}
                >
                  {action.label}
                </Button>
              ))}
              {actions.length === 0 ? (
                <p className="text-sm text-ink-soft">Este pedido ya no cambia de estado.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-3xl bg-cream p-5">
            <h2 className="font-display text-2xl">Cobro</h2>
            {data.paymentStatus === 'PAGADO' ? (
              <p className="mt-3 rounded-2xl bg-ok/15 px-3 py-2 font-semibold text-ok">Pagado</p>
            ) : data.finalTotal == null && kgItems.length ? (
              <p className="mt-3 text-sm font-medium text-warn">
                El importe final todavía no está definido. Pesá los cortes variables antes de cobrar.
              </p>
            ) : data.finalTotal == null ? (
              <p className="mt-3 text-sm text-ink-soft">
                El importe se confirma al entregar. Este pedido no tiene cortes de peso variable.
              </p>
            ) : (
              <>
                <Field label="Importe">
                  <Input value={payment.amount} onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))} />
                </Field>
                <Field label="Método">
                  <Select
                    value={payment.method}
                    onChange={(e) => setPayment((p) => ({ ...p, method: e.target.value as PaymentMethod }))}
                  >
                    {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
            <Button
              className="mt-3 w-full"
              disabled={data.paymentStatus === 'PAGADO' || data.finalTotal == null || payMutation.isPending}
              onClick={() => payMutation.mutate()}
            >
              {data.paymentStatus === 'PAGADO' ? 'Pagado' : 'Registrar pago'}
            </Button>
          </div>
        </div>
      </div>

      <OrderEditDialog
        order={editing ? data : null}
        onClose={() => setEditing(false)}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={pendingDelete}
        title="¿Eliminar pedido?"
        description={`Estás por eliminar el pedido #${shortOrderId(data.id)} de ${customerName(data)}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar pedido"
        danger
        loading={removeMutation.isPending}
        onClose={() => setPendingDelete(false)}
        onConfirm={() => removeMutation.mutate()}
      />
    </div>
  );
}
