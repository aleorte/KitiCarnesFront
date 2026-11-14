import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ordersApi, paymentsApi, productsApi } from '../../api/services';
import { CreateOrderDialog } from './create-order-dialog';
import { OrderPrepCard } from './order-prep-card';
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
import { useAuth } from '../../hooks/use-auth';
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
  type Product,
  type SaleUnit,
} from '../../types/api';
import {
  estimatedLineTotals,
  formatDateSlash,
  formatKgDelta,
  formatMoney,
  formatMoneyRange,
  formatQty,
  needsWeighing,
  orderPublicCode,
  toDecimalString,
} from '../../utils/format';
import {
  buildConfirmedOrderWhatsAppMessage,
  canMessageOrderOnWhatsApp,
} from '../../utils/order-whatsapp';
import { allowedSaleUnits, priceForSaleUnit, unitLabel } from '../../utils/sale-mode';

const WEIGHT_PATTERN = /^\d+(\.\d{1,3})?$/;
const QUANTITY_PATTERN = /^\d+(\.\d{1,3})?$/;

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
  const { hasPermission } = useAuth();
  const canManage = hasPermission('orders:manage');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);
  const cycle = useQuery({
    queryKey: ['orders-cycle', weekStart],
    queryFn: () => ordersApi.cycle(weekStart),
  });
  const orders = useQuery({
    queryKey: ['orders', status, weekStart, cycle.data?.weekStart],
    queryFn: () =>
      ordersApi.list({
        status: status || undefined,
        weekStart: weekStart ?? cycle.data?.weekStart,
        limit: 100,
      }),
    enabled: Boolean(weekStart || cycle.data?.weekStart),
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

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Confirmá y prepará los pedidos del ciclo. Las entregas y los pagos se gestionan en Recorrido."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>Nuevo pedido</Button>
          ) : null
        }
      />
      {cycle.data ? (
        <section className="mb-4 rounded-3xl bg-ink p-5 text-cream">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">
            {cycle.data.isCurrent ? 'Ciclo actual' : 'Otro ciclo'}
          </p>
          <p className="mt-2 font-display text-3xl leading-none">
            {formatDateSlash(cycle.data.weekStart, false)} → {formatDateSlash(cycle.data.weekEnd, false)}
          </p>
          <p className="mt-2 text-sm text-cream/70">
            Cierre de recepción {formatDateSlash(cycle.data.weekEnd, false)} · Entrega{' '}
            {formatDateSlash(cycle.data.deliveryDate, false)} · {orders.data?.meta.total ?? 0} pedido(s)
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setWeekStart(cycle.data.previousWeekStart)}>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant={cycle.data.isCurrent ? 'primary' : 'secondary'}
              onClick={() => setWeekStart(undefined)}
            >
              Ciclo actual
            </Button>
            <Button variant="secondary" onClick={() => setWeekStart(cycle.data.nextWeekStart)}>
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}
      {cycle.data?.collected ? (
        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-3xl bg-cream p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Cobrado en efectivo</p>
            <p className="mt-1 font-display text-3xl">{formatMoney(cycle.data.collected.efectivo)}</p>
            <p className="mt-1 text-sm text-ink-soft">Pagos de pedidos de este ciclo</p>
          </article>
          <article className="rounded-3xl bg-cream p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Cobrado por transferencia</p>
            <p className="mt-1 font-display text-3xl">{formatMoney(cycle.data.collected.transferencia)}</p>
            <p className="mt-1 text-sm text-ink-soft">Pagos de pedidos de este ciclo</p>
          </article>
          <article className="rounded-3xl bg-cream p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Total cobrado</p>
            <p className="mt-1 font-display text-3xl">{formatMoney(cycle.data.collected.total)}</p>
            {Number(cycle.data.collected.tarjeta) > 0 || Number(cycle.data.collected.otro) > 0 ? (
              <p className="mt-1 text-sm text-ink-soft">
                Incluye tarjeta y otros métodos, si los hay.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">Efectivo más transferencia</p>
            )}
          </article>
        </section>
      ) : null}
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
        <div className="space-y-4">
          {filtered?.map((order) => (
            <OrderPrepCard
              key={order.id}
              order={order}
              canManage={canManage}
              actions={<OrderActions order={order} onEdit={setEditing} onDelete={setPendingDelete} />}
            />
          ))}
        </div>
      )}

      <CreateOrderDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(orderId) => {
          setCreating(false);
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          navigate(`/admin/pedidos/${orderId}`);
        }}
      />
      <OrderEditDialog
        order={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          void queryClient.invalidateQueries({ queryKey: ['weekly-orders'] });
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="¿Eliminar pedido?"
        description={
          pendingDelete
            ? `Estás por eliminar el pedido #${orderPublicCode(pendingDelete)} de ${customerName(pendingDelete)}. Esta acción no se puede deshacer.`
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

type EditDraftItem = {
  productId: string;
  name: string;
  saleUnit: Product['saleUnit'];
  salePrice: string;
  estimatedMinKg?: string | null;
  estimatedMaxKg?: string | null;
  quantity: string;
};

function itemsLockedReason(order: Order) {
  if (order.items.some((item) => item.actualKg != null && item.actualKg !== '')) {
    return 'Este pedido ya tiene pesos reales. Solo se pueden editar las notas.';
  }
  if (order.stockDeducted) {
    return 'El stock de este pedido ya se descontó. Solo se pueden editar las notas.';
  }
  if (order.items.some((item) => item.weeklyCoveredAt)) {
    return 'Este pedido ya se cubrió con la compra de la semana. Solo se pueden editar las notas.';
  }
  return null;
}

function draftFromOrder(order: Order): EditDraftItem[] {
  const drafts: EditDraftItem[] = [];
  for (const item of order.items) {
    if (item.cancelledAt || !item.productId) continue;
    const quantity = item.saleUnit === 'KILOGRAM' ? (item.requestedKg ?? item.quantity) : item.quantity;
    const existing = drafts.find(
      (row) => row.productId === item.productId && row.saleUnit === item.saleUnit,
    );
    if (existing) {
      existing.quantity = String(Number(existing.quantity) + Number(quantity));
      continue;
    }
    drafts.push({
      productId: item.productId,
      name: item.productName,
      saleUnit: item.saleUnit,
      salePrice: item.unitPrice,
      estimatedMinKg: item.estimatedMinKg,
      estimatedMaxKg: item.estimatedMaxKg,
      quantity: String(Number(quantity)),
    });
  }
  return drafts;
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
  const [items, setItems] = useState<EditDraftItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [saleUnit, setSaleUnit] = useState<SaleUnit>('KILOGRAM');
  const [qty, setQty] = useState('1');
  const [confirming, setConfirming] = useState(false);
  const lockedReason = order ? itemsLockedReason(order) : null;

  const catalog = useQuery({
    queryKey: ['products', 'order-edit'],
    queryFn: () => productsApi.list({ limit: 100, status: 'active' }),
    enabled: Boolean(order) && !lockedReason,
  });

  useEffect(() => {
    if (!order) return;
    setNotes(order.notes ?? '');
    setItems(draftFromOrder(order));
    setProductSearch('');
    setProductId('');
    setSaleUnit('KILOGRAM');
    setQty('1');
    setConfirming(false);
  }, [order]);

  const products = catalog.data?.data ?? [];
  const selected = useMemo(
    () => products.find((product) => product.id === productId),
    [productId, products],
  );
  const matches = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products
      .filter((product) => !term || product.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [productSearch, products]);

  const originalKeys = useMemo(
    () =>
      new Set(
        order
          ? draftFromOrder(order).map((item) => `${item.productId}:${item.saleUnit}`)
          : [],
      ),
    [order],
  );
  const removedCount = [...originalKeys].filter(
    (key) => !items.some((item) => `${item.productId}:${item.saleUnit}` === key),
  ).length;

  const totals = items.reduce(
    (acc, item) => {
      const range = estimatedLineTotals({
        ...item,
        quantity: Number(item.quantity) || 0,
      });
      return { min: acc.min + range.min, max: acc.max + range.max };
    },
    { min: 0, max: 0 },
  );

  function addItem() {
    if (!order) return;
    if (!selected) {
      toast.error('Elegí un corte');
      return;
    }
    const quantity = Number(qty.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Ingresá una cantidad válida');
      return;
    }
    const units = allowedSaleUnits(selected);
    const chosen = units.includes(saleUnit) ? saleUnit : units[0];
    if (chosen === 'UNIT' && !Number.isInteger(quantity)) {
      toast.error('Para este corte la cantidad tiene que ser un número entero');
      return;
    }
    setItems((current) => {
      const existing = current.find((item) => item.productId === selected.id && item.saleUnit === chosen);
      if (existing) {
        return current.map((item) =>
          item.productId === selected.id && item.saleUnit === chosen
            ? { ...item, quantity: String(Number(item.quantity) + quantity) }
            : item,
        );
      }
      const original = order.items.find(
        (item) => item.productId === selected.id && item.saleUnit === chosen && !item.cancelledAt,
      );
      const keepSnapshot = Boolean(original);
      return [
        ...current,
        {
          productId: selected.id,
          name: keepSnapshot ? original!.productName : selected.name,
          saleUnit: chosen,
          salePrice: keepSnapshot ? original!.unitPrice : priceForSaleUnit(selected, chosen),
          estimatedMinKg: keepSnapshot
            ? original!.estimatedMinKg
            : chosen === 'KILOGRAM'
              ? null
              : selected.estimatedMinKg,
          estimatedMaxKg: keepSnapshot
            ? original!.estimatedMaxKg
            : chosen === 'KILOGRAM'
              ? null
              : selected.estimatedMaxKg,
          quantity: String(quantity),
        },
      ];
    });
    setQty('1');
    toast.success(`${selected.name} actualizado en el pedido`);
  }

  const save = useMutation({
    mutationFn: () => {
      if (!order) throw new Error('Pedido inválido');
      if (!lockedReason) {
        if (items.length === 0) {
          throw new Error('El pedido tiene que tener al menos un corte');
        }
        for (const item of items) {
          const quantity = item.quantity.trim().replace(',', '.');
          if (!quantity || !QUANTITY_PATTERN.test(quantity) || Number(quantity) <= 0) {
            throw new Error(`Revisá la cantidad de ${item.name}`);
          }
          if (item.saleUnit === 'UNIT' && !Number.isInteger(Number(quantity))) {
            throw new Error(`La cantidad de ${item.name} tiene que ser un número entero`);
          }
        }
      }
      return ordersApi.update(order.id, {
        notes,
        ...(lockedReason
          ? {}
          : {
              items: items.map((item) => ({
                productId: item.productId,
                saleUnit: item.saleUnit,
                quantity: toDecimalString(Number(item.quantity.replace(',', '.'))),
                requestedKg:
                  item.saleUnit === 'KILOGRAM'
                    ? toDecimalString(Number(item.quantity.replace(',', '.')))
                    : undefined,
              })),
            }),
      });
    },
    onSuccess: () => {
      toast.success('Pedido actualizado');
      setConfirming(false);
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function requestSave() {
    if (!lockedReason && removedCount > 0) {
      setConfirming(true);
      return;
    }
    save.mutate();
  }

  return (
    <>
      <Modal
        open={Boolean(order)}
        size="xl"
        title={order ? `Editar pedido #${orderPublicCode(order)}` : 'Editar pedido'}
        description={
          lockedReason ??
          'Agregá, quitá o cambiá cantidades. Los precios de los cortes que ya estaban se conservan.'
        }
        footer={
          order ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" className="min-h-12 w-full sm:w-auto" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" className="min-h-12 w-full sm:w-auto" disabled={save.isPending} onClick={requestSave}>
                {save.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          ) : null
        }
        onClose={onClose}
      >
        {order ? (
          <div className="space-y-4">
            {!lockedReason ? (
              <>
                <div className="grid gap-3">
                  <Field label="Buscar corte" hint={selected ? selected.name : 'Elegí un producto de la lista'}>
                    <Input
                      value={productSearch}
                      onChange={(event) => {
                        setProductSearch(event.target.value);
                        setProductId('');
                      }}
                      placeholder="Nalga, vacío, milanesa..."
                      className="min-h-12"
                    />
                  </Field>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    {selected && allowedSaleUnits(selected).length > 1 ? (
                      <Field label="Modalidad">
                        <Select
                          value={saleUnit}
                          onChange={(event) => setSaleUnit(event.target.value as SaleUnit)}
                          className="min-h-12"
                        >
                          {allowedSaleUnits(selected).map((unit) => (
                            <option key={unit} value={unit}>
                              {unit === 'KILOGRAM' ? 'Por kg' : 'Por unidad'}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ) : null}
                    <Field label={saleUnit === 'KILOGRAM' ? 'Kilos' : 'Unidades'}>
                      <Input
                        value={qty}
                        inputMode="decimal"
                        onChange={(event) => setQty(event.target.value)}
                        className="min-h-12"
                      />
                    </Field>
                    <Button type="button" className="min-h-12 self-end px-5" onClick={addItem}>
                      Agregar
                    </Button>
                  </div>
                </div>
                {matches.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {matches.map((product) => {
                      const inOrder = items.some((item) => item.productId === product.id);
                      return (
                        <li key={product.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setProductId(product.id);
                              setProductSearch(product.name);
                              setSaleUnit(allowedSaleUnits(product)[0]);
                            }}
                            className={`min-h-12 w-full rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                              productId === product.id
                                ? 'bg-ink text-cream'
                                : 'bg-paper text-ink hover:bg-paper-2'
                            }`}
                          >
                            <span className="font-semibold break-words">{product.name}</span>
                            <span className="mt-0.5 block text-xs opacity-80">
                              {allowedSaleUnits(product)
                                .map((unit) => `${formatMoney(priceForSaleUnit(product, unit))} / ${unitLabel(unit)}`)
                                .join(' · ')}
                              {inOrder ? ' · ya está en el pedido' : ''}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-soft">No hay cortes que coincidan con la búsqueda.</p>
                )}

                {items.length > 0 ? (
                  <ul className="space-y-2 rounded-2xl bg-paper p-3 text-sm">
                    {items.map((item) => (
                      <li
                        key={`${item.productId}:${item.saleUnit}`}
                        className="flex flex-col gap-2 border-b border-line/70 py-3 last:border-b-0"
                      >
                        <span className="min-w-0">
                          <span className="font-semibold break-words">{item.name}</span>
                          <span className="block text-ink-soft">
                            {formatMoney(item.salePrice)} · {item.saleUnit === 'KILOGRAM' ? 'kg' : 'u.'}
                          </span>
                        </span>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Input
                            className="min-h-12"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(event) =>
                              setItems((current) =>
                                current.map((row) =>
                                  row.productId === item.productId && row.saleUnit === item.saleUnit
                                    ? { ...row, quantity: event.target.value }
                                    : row,
                                ),
                              )
                            }
                            aria-label={`Cantidad de ${item.name}`}
                          />
                          <Button
                            type="button"
                            variant="danger"
                            className="min-h-12 px-4"
                            onClick={() =>
                              setItems((current) =>
                                current.filter(
                                  (row) =>
                                    !(row.productId === item.productId && row.saleUnit === item.saleUnit),
                                ),
                              )
                            }
                          >
                            Quitar
                          </Button>
                        </div>
                      </li>
                    ))}
                    <li className="flex justify-between gap-3 pt-1 font-semibold">
                      <span>Estimado</span>
                      <span className="text-right">{formatMoneyRange(totals.min, totals.max)}</span>
                    </li>
                  </ul>
                ) : (
                  <p className="text-sm text-ink-soft">Todavía no hay cortes en este pedido.</p>
                )}
              </>
            ) : null}

            <Field label="Notas">
              <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={confirming}
        title="¿Quitar cortes de este pedido?"
        description={`Vas a eliminar ${removedCount} corte(s) del pedido. El código de seguimiento, el cliente y los estados de pago y entrega no cambian.`}
        confirmLabel="Guardar y quitar"
        danger
        loading={save.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() => save.mutate()}
      />
    </>
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
    queryClient.invalidateQueries({ queryKey: ['weekly-orders'] });
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
    if (next === 'ENTREGADO') {
      toast.error('Las entregas se marcan desde Recorrido');
      return;
    }
    if (next === 'LISTO' && kgItems.length) {
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
              disabled={
                data.status !== 'ENTREGADO' ||
                data.paymentStatus === 'PAGADO' ||
                data.finalTotal == null ||
                payMutation.isPending
              }
              onClick={() => payMutation.mutate()}
            >
              {data.paymentStatus === 'PAGADO'
                ? 'Pagado'
                : data.status !== 'ENTREGADO'
                  ? 'El pago se registra después de entregar'
                  : 'Registrar pago'}
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
        description={`Estás por eliminar el pedido #${orderPublicCode(data)} de ${customerName(data)}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar pedido"
        danger
        loading={removeMutation.isPending}
        onClose={() => setPendingDelete(false)}
        onConfirm={() => removeMutation.mutate()}
      />
    </div>
  );
}
