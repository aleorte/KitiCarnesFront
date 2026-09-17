import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { suppliersApi, weeklyOrdersApi, type WholesaleItemInput } from '../../api/services';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import { WHOLESALE_STATUS_LABEL, type WeeklyProductSummary } from '../../types/api';
import { formatCopyQty, formatDateSlash, formatMoney, formatQty } from '../../utils/format';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^\d+(\.\d{1,3})?$/;

type DraftRow = {
  quantityToOrder: string;
  unitCost: string;
  supplierId: string;
  receivedQty: string;
};

function planFor(product: WeeklyProductSummary, supplierId: string) {
  const link = product.suppliers?.find((supplier) => supplier.supplierId === supplierId);
  const demand = Number(product.planningDemand ?? product.totalQuantity);
  const min = link?.minPurchaseQty ? Number(link.minPurchaseQty) : 0;
  return {
    demand,
    min: link?.minPurchaseQty ?? null,
    suggested: demand,
    belowMinimum: demand > 0 && min > demand,
    purchasePrice: link?.purchasePrice ?? '',
  };
}

function receptionFor(demand: string | number, received: string | number) {
  const activeDemand = Number(demand) || 0;
  const receivedQty = Number(received) || 0;
  return {
    surplus: Math.max(0, receivedQty - activeDemand),
    shortage: Math.max(0, activeDemand - receivedQty),
  };
}

function excludedQty(excluded: boolean, value: number) {
  return excluded ? 0 : value;
}

function supplierOrderText(
  weekStart: string,
  weekEnd: string,
  rows: Array<{ product: WeeklyProductSummary; quantity: string; supplierName: string }>,
) {
  const bySupplier = new Map<string, Array<{ name: string; quantity: string; unit: WeeklyProductSummary['planningUnit'] }>>();
  for (const row of rows) {
    const key = row.supplierName || 'Sin proveedor';
    const list = bySupplier.get(key) ?? [];
    list.push({
      name: row.product.productName,
      quantity: row.quantity,
      unit: row.product.planningUnit ?? row.product.saleUnit,
    });
    bySupplier.set(key, list);
  }

  const lines = [
    `Pedido semana ${formatDateSlash(weekStart, false)} al ${formatDateSlash(weekEnd, false)}`,
    '',
  ];
  for (const [supplier, items] of bySupplier) {
    lines.push(supplier.toUpperCase());
    for (const item of items) {
      lines.push(`- ${item.name}: ${formatCopyQty(item.quantity, item.unit)}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fallback below */
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(area);
  if (!copied) {
    throw new Error('clipboard');
  }
}

function emptyDraft(): DraftRow {
  return { quantityToOrder: '', unitCost: '', supplierId: '', receivedQty: '' };
}

const TABLE_CONTROL = 'w-full min-w-0 rounded-xl px-2.5 py-1.5 text-sm';

function SupplierSelect({
  product,
  value,
  disabled,
  onChange,
}: {
  product: WeeklyProductSummary;
  value: string;
  disabled?: boolean;
  onChange: (supplierId: string) => void;
}) {
  const options = product.suppliers ?? [];
  return (
    <Select
      className={TABLE_CONTROL}
      value={value}
      disabled={disabled || options.length === 0}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{options.length ? 'Elegí proveedor' : 'Sin proveedores asociados'}</option>
      {options.map((supplier) => (
        <option key={supplier.supplierId} value={supplier.supplierId}>
          {supplier.supplierName}
        </option>
      ))}
    </Select>
  );
}

function ExcludeButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title="Dar de baja"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-blood transition hover:bg-blood/10 disabled:opacity-50"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export function WeeklyOrdersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManageOrders = hasPermission('orders:manage');
  const canManagePurchases = hasPermission('purchases:manage');
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmingWeek, setConfirmingWeek] = useState(false);
  const [confirmingWholesale, setConfirmingWholesale] = useState(false);
  const [generatingPurchases, setGeneratingPurchases] = useState(false);
  const [excludingProduct, setExcludingProduct] = useState<WeeklyProductSummary | null>(null);
  const [resettingWeek, setResettingWeek] = useState(false);

  const week = useQuery({
    queryKey: ['weekly-orders', weekStart],
    queryFn: () => weeklyOrdersApi.week({ weekStart, limit: 1 }),
    placeholderData: keepPreviousData,
  });
  const suppliers = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => suppliersApi.list({ limit: 100, isActive: true }),
  });

  const data = week.data;
  const products = useMemo(
    () =>
      (data?.products ?? []).filter(
        (product) =>
          Number(product.totalQuantity) > 0 ||
          Number(product.cancelledQuantity ?? 0) > 0 ||
          Boolean(product.excluded),
      ),
    [data?.products],
  );
  const activeProducts = useMemo(
    () => products.filter((product) => !product.excluded),
    [products],
  );
  const wholesale = data?.wholesaleOrder ?? null;
  const wholesaleEditable = !wholesale || wholesale.status === 'BORRADOR' || wholesale.status === 'PREPARADO';
  const awaitingReception = wholesale?.status === 'CONFIRMADO' && !(wholesale.purchases?.length);
  const receptionDone = Boolean(wholesale?.receivedAt) || Boolean(wholesale?.purchases?.length);
  const canExclude = !receptionDone;
  const canAssignSupplier = !receptionDone;

  useEffect(() => {
    if (!data) return;
    const saved = new Map((wholesale?.items ?? []).map((item) => [item.productId, item]));
    setDraft(
      Object.fromEntries(
        products.map((product) => {
          const item = saved.get(product.productId);
          const supplierFromItem = item?.supplierId ?? item?.supplier?.id ?? '';
          const onlySupplier = product.suppliers?.length === 1 ? product.suppliers[0].supplierId : '';
          const nextSupplier = supplierFromItem || onlySupplier;
          const plan = planFor(product, nextSupplier);
          const ordered = item?.quantityToOrder ?? String(plan.suggested);
          return [
            product.productId,
            {
              quantityToOrder: ordered,
              unitCost: item?.unitCost ?? plan.purchasePrice,
              supplierId: nextSupplier,
              receivedQty: item?.receivedQty ?? ordered,
            },
          ];
        }),
      ),
    );
    setSupplierId(wholesale?.supplier?.id ?? '');
    setNotes(wholesale?.notes ?? '');
  }, [data, products, wholesale]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['weekly-orders'] });

  const confirmWeek = useMutation({
    mutationFn: () => weeklyOrdersApi.confirmWeekOrders(data?.weekStart),
    onSuccess: (result) => {
      toast.success(
        result.confirmed
          ? `${result.confirmed} pedido(s) confirmados`
          : 'No había pedidos pendientes en esta semana',
      );
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setConfirmingWeek(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveWholesale = useMutation({
    mutationFn: (items: WholesaleItemInput[]) =>
      wholesale
        ? weeklyOrdersApi.updateWholesale(wholesale.id, {
            items,
            notes,
            supplierId: supplierId || undefined,
          })
        : weeklyOrdersApi.upsertWholesale({
            weekStart: data?.weekStart,
            items,
            notes,
            supplierId: supplierId || undefined,
          }),
    onSuccess: () => {
      toast.success('Pedido al proveedor guardado');
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmWholesale = useMutation({
    mutationFn: () => weeklyOrdersApi.confirmWholesale(wholesale!.id),
    onSuccess: () => {
      toast.success('Pedido a proveedores confirmado. Ahora cargá la cantidad realmente recibida.');
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setConfirmingWholesale(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const generatePurchases = useMutation({
    mutationFn: () =>
      weeklyOrdersApi.generatePurchases(
        wholesale!.id,
        (wholesale?.items ?? [])
          .filter((item) => !item.excludedAt)
          .map((item) => ({
            productId: item.productId,
            receivedQty: draft[item.productId]?.receivedQty ?? '0',
          })),
      ),
    onSuccess: (created) => {
      toast.success(
        created.length
          ? `${created.length} compra(s) registradas. Solo el sobrante entra al stock.`
          : 'Recepción registrada. No hubo sobrante para ingresar a stock.',
      );
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['purchases'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      setGeneratingPurchases(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignSupplier = useMutation({
    mutationFn: (payload: { productId: string; supplierId: string; unitCost?: string }) =>
      weeklyOrdersApi.assignSuppliers(wholesale!.id, [payload]),
    onSuccess: () => {
      toast.success('Proveedor actualizado');
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const excludeProduct = useMutation({
    mutationFn: (productId: string) => weeklyOrdersApi.excludeProduct(productId, data?.weekStart),
    onSuccess: (result) => {
      toast.success(
        `${result.productName} dado de baja. El historial se conservó y ya no suma a la demanda.`,
      );
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setExcludingProduct(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetWeek = useMutation({
    mutationFn: () => weeklyOrdersApi.resetWeek(data?.weekStart),
    onSuccess: (result) => {
      toast.success(
        `Semana reseteada. ${result.purchasesDeleted} compra(s) revertidas, ${result.ordersReverted} pedido(s) volvieron a pendiente.`,
      );
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['purchases'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setResettingWeek(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const draftTotalCost = useMemo(
    () =>
      activeProducts.reduce((acc, product) => {
        const row = draft[product.productId];
        if (!row?.unitCost || !MONEY_PATTERN.test(row.unitCost)) return acc;
        return acc + Number(row.unitCost) * Number(row.quantityToOrder || 0);
      }, 0),
    [draft, activeProducts],
  );

  const wholesaleBySupplier = useMemo(() => {
    const groups = new Map<string, Array<{ name: string; qty: string; unit: WeeklyProductSummary['planningUnit'] }>>();
    for (const product of activeProducts) {
      const row = draft[product.productId];
      if (!row || Number(row.quantityToOrder) <= 0) continue;
      const supplierName =
        suppliers.data?.data.find((supplier) => supplier.id === row.supplierId)?.name ?? 'Sin proveedor';
      const list = groups.get(supplierName) ?? [];
      list.push({
        name: product.productName,
        qty: row.quantityToOrder,
        unit: product.planningUnit ?? product.saleUnit,
      });
      groups.set(supplierName, list);
    }
    return [...groups.entries()];
  }, [draft, activeProducts, suppliers.data]);

  async function copyOrder() {
    if (!data || !activeProducts.length) {
      toast.error('No hay productos para copiar en esta semana');
      return;
    }

    try {
      await copyText(
        supplierOrderText(
          data.weekStart,
          data.weekEnd,
          activeProducts.map((product) => ({
            product,
            quantity: draft[product.productId]?.quantityToOrder ?? product.suggestedQty,
            supplierName:
              suppliers.data?.data.find((supplier) => supplier.id === draft[product.productId]?.supplierId)?.name ??
              '',
          })),
        ),
      );
      toast.success('Pedido copiado. Ya lo podés pegar en WhatsApp.');
    } catch {
      toast.error('No se pudo copiar el pedido');
    }
  }

  function submitWholesale() {
    const items: WholesaleItemInput[] = [];

    for (const product of products) {
      const row = draft[product.productId];
      if (product.excluded) {
        items.push({
          productId: product.productId,
          quantityToOrder: '0',
          unitCost: (row?.unitCost ?? '').trim() || undefined,
          supplierId: (row?.supplierId ?? '').trim() || undefined,
        });
        continue;
      }

      const quantityToOrder = (row?.quantityToOrder ?? '').trim();
      const unitCost = (row?.unitCost ?? '').trim();
      const plan = planFor(product, row?.supplierId ?? '');

      if (!quantityToOrder || !QUANTITY_PATTERN.test(quantityToOrder)) {
        toast.error(`Revisá la cantidad a encargar de ${product.productName}`);
        return;
      }
      if (unitCost && !MONEY_PATTERN.test(unitCost)) {
        toast.error(`Revisá el precio de coste de ${product.productName}`);
        return;
      }
      if (Number(quantityToOrder) === 0) continue;
      if (plan.demand > 0 && !(row?.supplierId ?? '').trim()) {
        toast.error(`Asigná un proveedor a ${product.productName}`);
        return;
      }

      items.push({
        productId: product.productId,
        quantityToOrder,
        unitCost: unitCost || undefined,
        supplierId: (row?.supplierId ?? '').trim() || undefined,
      });
    }

    if (!items.length) {
      toast.error('Cargá al menos un producto con cantidad');
      return;
    }

    saveWholesale.mutate(items);
  }

  function submitReception() {
    for (const product of activeProducts) {
      const received = (draft[product.productId]?.receivedQty ?? '').trim();
      if (!received || !QUANTITY_PATTERN.test(received)) {
        toast.error(`Revisá la cantidad recibida de ${product.productName}`);
        return;
      }
    }
    setGeneratingPurchases(true);
  }

  function applySupplier(product: WeeklyProductSummary, nextSupplierId: string) {
    const plan = planFor(product, nextSupplierId);
    setDraft((prev) => {
      const row = prev[product.productId] ?? emptyDraft();
      return {
        ...prev,
        [product.productId]: {
          ...row,
          supplierId: nextSupplierId,
          unitCost: plan.purchasePrice,
        },
      };
    });

    if (
      wholesale &&
      !receptionDone &&
      nextSupplierId &&
      wholesale.items.some((item) => item.productId === product.productId)
    ) {
      assignSupplier.mutate({
        productId: product.productId,
        supplierId: nextSupplierId,
        unitCost: plan.purchasePrice || undefined,
      });
    }
  }

  if (week.isError) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Pedidos semanales" description="No se pudo cargar la semana." />
        <EmptyState
          title="No se pudo cargar la semana"
          description={week.error instanceof Error ? week.error.message : 'Reintentá en unos segundos.'}
        />
        <Button className="mt-4" onClick={() => void week.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (week.isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  const missingCost = activeProducts.filter(
    (product) => Number(draft[product.productId]?.quantityToOrder) > 0 && !draft[product.productId]?.unitCost,
  ).length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={data.isCurrent ? 'Semana actual' : 'Otra semana'}
        title="Pedidos semanales"
        description={`${data.shortLabel ?? data.label}. Del jueves al miércoles: la demanda activa es lo que hay que cubrir con el pedido a proveedores.`}
        actions={
          <Button variant="danger" onClick={() => setResettingWeek(true)}>
            Resetear pedido semanal
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setWeekStart(data.previousWeekStart)}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant={data.isCurrent ? 'primary' : 'secondary'}
            onClick={() => setWeekStart(undefined)}
          >
            Semana actual
          </Button>
          <Button variant="secondary" onClick={() => setWeekStart(data.nextWeekStart)}>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <label className="sm:ml-auto">
          <span className="sr-only">Elegir fecha</span>
          <Input
            type="date"
            value={data.weekStart}
            onChange={(event) => setWeekStart(event.target.value || undefined)}
            className="max-w-48"
          />
        </label>
      </div>

      <section className="mt-6 rounded-3xl bg-ink p-6 text-cream">
        <p className="text-xs uppercase tracking-[0.18em] text-gold">{data.shortLabel}</p>
        <p className="mt-2 font-display text-4xl leading-none sm:text-5xl">
          {formatDateSlash(data.weekStart, false)} → {formatDateSlash(data.weekEnd, false)}
        </p>
        <p className="mt-3 text-sm text-cream/70">
          {data.summary.orders} pedido(s) · {data.summary.customers} cliente(s) · {data.summary.pending} pendiente(s)
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => void copyOrder()} disabled={!activeProducts.length}>
            <Copy className="h-4 w-4" />
            Copiar pedido al mayorista
          </Button>
          {canManageOrders ? (
            <Button
              variant="secondary"
              onClick={() => setConfirmingWeek(true)}
              disabled={!data.summary.pending}
            >
              <CheckCheck className="h-4 w-4" />
              Confirmar pedidos de la semana
            </Button>
          ) : null}
        </div>
      </section>

      {products.length ? (
        <>
          <section className="mt-6 overflow-hidden rounded-3xl bg-cream">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-2xl">Demanda semanal y pedido a proveedores</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Asigná un proveedor a cada corte. El precio y el mínimo se cargan de esa relación.
              </p>
            </div>
            <div className="px-2 pb-2 md:px-3">
              <table className="hidden w-full table-fixed text-left text-sm md:table">
                <thead className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  <tr>
                    <th className="px-2 py-3 font-medium">Producto</th>
                    <th className="w-[11%] px-2 py-3 font-medium">Demanda</th>
                    <th className="w-[22%] px-2 py-3 font-medium">Proveedor</th>
                    <th className="w-[12%] px-2 py-3 font-medium">Precio</th>
                    <th className="w-[10%] px-2 py-3 font-medium">Mínimo</th>
                    <th className="w-[12%] px-2 py-3 font-medium">A comprar</th>
                    {awaitingReception || receptionDone ? (
                      <th className="w-[12%] px-2 py-3 font-medium">Recibido</th>
                    ) : null}
                    <th className="w-[10%] px-2 py-3 font-medium">Sobrante</th>
                    {canExclude ? <th className="w-10 px-1 py-3 font-medium" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const row = draft[product.productId] ?? emptyDraft();
                    const saved = wholesale?.items.find((item) => item.productId === product.productId);
                    const plan = planFor(product, row.supplierId);
                    const unit = product.planningUnit ?? product.saleUnit;
                    const frozenQty = Boolean(saved) && !wholesaleEditable;
                    const demand = product.planningDemand;
                    const min = plan.min ?? (frozenQty ? saved?.minPurchaseQty : null);
                    const buy = wholesaleEditable ? row.quantityToOrder : saved?.quantityToOrder ?? row.quantityToOrder;
                    const received = awaitingReception
                      ? row.receivedQty
                      : saved?.receivedQty ?? row.receivedQty;
                    const excluded = Boolean(product.excluded || saved?.excludedAt);
                    const reception = receptionFor(demand ?? 0, received || '0');
                    const plannedSurplus = Math.max(0, Number(buy || 0) - Number(demand || 0));
                    const surplus = excludedQty(
                      excluded,
                      receptionDone || awaitingReception ? reception.surplus : plannedSurplus,
                    );
                    const shortage = excludedQty(
                      excluded,
                      receptionDone || awaitingReception ? reception.shortage : 0,
                    );
                    const belowMinimum =
                      !excluded && Number(demand) > 0 && Number(min) > Number(demand);
                    const supplierName =
                      product.suppliers?.find((supplier) => supplier.supplierId === row.supplierId)?.supplierName ??
                      saved?.supplier?.name;
                    return (
                      <tr
                        key={product.productId}
                        className={`border-t border-line align-middle ${
                          excluded ? 'bg-paper-2/50 text-ink-soft' : 'hover:bg-paper/50'
                        }`}
                      >
                        <td className="px-2 py-2.5">
                          <span className="font-semibold leading-tight text-ink">{product.productName}</span>
                          {excluded ? (
                            <span className="mt-1 block">
                              <Badge tone="danger">Cancelado</Badge>
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 font-semibold">
                          {formatQty(excluded ? 0 : demand, unit)}
                        </td>
                        <td className="px-2 py-2.5">
                          {canAssignSupplier && !excluded ? (
                            <SupplierSelect
                              product={product}
                              value={row.supplierId}
                              onChange={(nextSupplierId) => applySupplier(product, nextSupplierId)}
                            />
                          ) : (
                            <span className="line-clamp-2">{supplierName ?? '—'}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5">
                          {row.unitCost ? formatMoney(row.unitCost) : '—'}
                        </td>
                        <td className={`whitespace-nowrap px-2 py-2.5 ${belowMinimum ? 'text-warn' : ''}`}>
                          {min ? formatQty(min, unit) : '—'}
                        </td>
                        <td className="px-2 py-2.5">
                          {wholesaleEditable && !excluded ? (
                            <Input
                              className={TABLE_CONTROL}
                              inputMode="decimal"
                              value={row.quantityToOrder}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [product.productId]: { ...row, quantityToOrder: event.target.value },
                                }))
                              }
                            />
                          ) : (
                            formatQty(excluded ? 0 : buy || '0', unit)
                          )}
                        </td>
                        {awaitingReception || receptionDone ? (
                          <td className="px-2 py-2.5">
                            {awaitingReception && !excluded ? (
                              <Input
                                className={TABLE_CONTROL}
                                inputMode="decimal"
                                value={row.receivedQty}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    [product.productId]: { ...row, receivedQty: event.target.value },
                                  }))
                                }
                              />
                            ) : (
                              formatQty(excluded ? 0 : received || '0', unit)
                            )}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-2 py-2.5">
                          {formatQty(surplus, unit)}
                          {shortage > 0 ? (
                            <span className="mt-0.5 block text-xs text-warn">Falta {formatQty(shortage, unit)}</span>
                          ) : null}
                        </td>
                        {canExclude ? (
                          <td className="px-1 py-2.5 text-right">
                            {excluded ? null : (
                              <ExcludeButton
                                label={`Dar de baja ${product.productName}`}
                                disabled={excludeProduct.isPending}
                                onClick={() => setExcludingProduct(product)}
                              />
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="space-y-4 p-4 md:hidden">
              {products.map((product) => {
                const row = draft[product.productId] ?? emptyDraft();
                const saved = wholesale?.items.find((item) => item.productId === product.productId);
                const plan = planFor(product, row.supplierId);
                const unit = product.planningUnit ?? product.saleUnit;
                const demand = product.planningDemand;
                const min = plan.min;
                const received = awaitingReception ? row.receivedQty : saved?.receivedQty ?? row.receivedQty;
                const reception = receptionFor(demand ?? 0, received || '0');
                const plannedSurplus = Math.max(0, Number(row.quantityToOrder || 0) - Number(demand || 0));
                const excluded = Boolean(product.excluded || saved?.excludedAt);
                const surplus = excludedQty(
                  excluded,
                  awaitingReception || receptionDone ? reception.surplus : plannedSurplus,
                );
                return (
                  <li
                    key={product.productId}
                    className={`rounded-2xl p-4 ${excluded ? 'bg-paper-2/70 text-ink-soft' : 'bg-paper'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-ink">{product.productName}</p>
                      {excluded ? (
                        <Badge tone="danger">Cancelado</Badge>
                      ) : canExclude ? (
                        <ExcludeButton
                          label={`Dar de baja ${product.productName}`}
                          disabled={excludeProduct.isPending}
                          onClick={() => setExcludingProduct(product)}
                        />
                      ) : null}
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-soft">Demanda</dt>
                        <dd className="font-semibold">{formatQty(excluded ? 0 : demand, unit)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-soft">Precio de compra</dt>
                        <dd>{row.unitCost ? formatMoney(row.unitCost) : '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-soft">Mínimo</dt>
                        <dd>{min ? formatQty(min, unit) : '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-soft">Cantidad a comprar</dt>
                        <dd>{formatQty(excluded ? 0 : row.quantityToOrder || '0', unit)}</dd>
                      </div>
                      {awaitingReception || receptionDone ? (
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-soft">Cantidad recibida</dt>
                          <dd>{formatQty(excluded ? 0 : received || '0', unit)}</dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-soft">Sobrante</dt>
                        <dd>{formatQty(surplus, unit)}</dd>
                      </div>
                    </dl>
                    {canAssignSupplier && !excluded ? (
                      <div className="mt-3 grid gap-3">
                        <Field label="Proveedor">
                          <SupplierSelect
                            product={product}
                            value={row.supplierId}
                            onChange={(supplierId) => applySupplier(product, supplierId)}
                          />
                        </Field>
                        {wholesaleEditable ? (
                          <Field label="Cantidad a comprar">
                            <Input
                              inputMode="decimal"
                              value={row.quantityToOrder}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [product.productId]: { ...row, quantityToOrder: event.target.value },
                                }))
                              }
                            />
                          </Field>
                        ) : null}
                      </div>
                    ) : null}
                    {awaitingReception && !excluded ? (
                      <div className="mt-3">
                        <Field label="Cantidad recibida">
                          <Input
                            inputMode="decimal"
                            value={row.receivedQty}
                            onChange={(event) =>
                              setDraft((prev) => ({
                                ...prev,
                                [product.productId]: { ...row, receivedQty: event.target.value },
                              }))
                            }
                          />
                        </Field>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {wholesaleBySupplier.length ? (
            <section className="mt-6 rounded-3xl bg-cream p-5">
              <h2 className="font-display text-2xl">Resumen para mayorista</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {wholesaleBySupplier.map(([name, items]) => (
                  <article key={name} className="rounded-2xl bg-paper p-4">
                    <p className="font-semibold">{name}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {items.map((item) => (
                        <li key={item.name} className="flex justify-between gap-3">
                          <span>{item.name}</span>
                          <span>{formatQty(item.qty, item.unit)}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6 rounded-3xl bg-cream p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">Precios de esta compra</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  El precio de coste es el de esta operación. Si después cambia, las compras ya hechas no se tocan.
                </p>
              </div>
              {wholesale ? <Badge>{WHOLESALE_STATUS_LABEL[wholesale.status]}</Badge> : null}
            </div>

            {wholesaleEditable ? (
              <>
                <div className="mt-4 grid gap-3">
                  <Field label="Proveedor general (opcional)">
                    <Select
                      value={supplierId}
                      onChange={(event) => setSupplierId(event.target.value)}
                    >
                      <option value="">Sin especificar</option>
                      {(suppliers.data?.data ?? []).map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <ul className="mt-4 space-y-4">
                  {activeProducts.map((product) => {
                    const row = draft[product.productId] ?? emptyDraft();
                    const lineTotal =
                      row.unitCost && MONEY_PATTERN.test(row.unitCost)
                        ? Number(row.unitCost) * Number(row.quantityToOrder || 0)
                        : null;
                    const unit = product.planningUnit ?? product.saleUnit;
                    return (
                      <li key={product.productId} className="border-b border-line pb-4 last:border-b-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold">{product.productName}</span>
                          <span className="text-sm text-ink-soft">
                            {lineTotal === null ? 'Sin coste' : formatMoney(lineTotal)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">
                          Demanda semanal {formatQty(product.planningDemand, unit)}
                        </p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <Field
                            label={product.planningUnit === 'KILOGRAM' ? 'Precio de coste por kg' : 'Precio de coste por unidad'}
                          >
                            <Input
                              inputMode="decimal"
                              placeholder="Ej: 7500.00"
                              value={row.unitCost}
                              onChange={(event) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [product.productId]: { ...row, unitCost: event.target.value },
                                }))
                              }
                            />
                          </Field>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Field label="Notas para el proveedor">
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </Field>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-sm text-ink-soft">Total de la compra</span>
                  <strong className="font-display text-3xl">{formatMoney(draftTotalCost)}</strong>
                </div>
                {missingCost ? (
                  <p className="mt-1 text-sm text-warn">
                    {missingCost} producto(s) sin precio de coste. Sin ese dato no se puede calcular la ganancia real.
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button disabled={saveWholesale.isPending} onClick={submitWholesale}>
                    {saveWholesale.isPending ? 'Guardando...' : 'Guardar pedido a proveedores'}
                  </Button>
                  {wholesale ? (
                    <Button variant="secondary" onClick={() => setConfirmingWholesale(true)}>
                      Confirmar pedido a proveedores
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <ul className="mt-4 space-y-4 text-sm">
                  {wholesale?.items.map((item) => {
                    const row = draft[item.productId] ?? emptyDraft();
                    const live = products.find((product) => product.productId === item.productId);
                    const demand = live?.planningDemand ?? item.purchaseNeed ?? '0';
                    const received = awaitingReception ? row.receivedQty : item.receivedQty ?? row.receivedQty;
                    const balance = receptionFor(demand, received || '0');
                    const excluded = Boolean(item.excludedAt || live?.excluded);
                    return (
                      <li key={item.id} className="rounded-2xl bg-paper p-4">
                        <div className="flex justify-between gap-3">
                          <span className="font-semibold">{item.productName}</span>
                          {excluded ? <Badge tone="danger">Dado de baja</Badge> : null}
                        </div>
                        <dl className="mt-3 grid gap-1">
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-soft">Demanda semanal</dt>
                            <dd className="font-semibold">{formatQty(excluded ? 0 : demand, item.saleUnit)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-soft">Proveedor</dt>
                            <dd>{item.supplier?.name ?? '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-soft">Precio de compra</dt>
                            <dd>{item.unitCost ? formatMoney(item.unitCost) : '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-soft">Mínimo de compra</dt>
                            <dd>{item.minPurchaseQty ? formatQty(item.minPurchaseQty, item.saleUnit) : '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-soft">Cantidad a comprar</dt>
                            <dd>{formatQty(item.quantityToOrder, item.saleUnit)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-soft">Cantidad recibida</dt>
                            <dd>{formatQty(received || '0', item.saleUnit)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-soft">Sobrante</dt>
                            <dd>
                              {formatQty(
                                receptionDone ? item.surplusQty ?? balance.surplus : balance.surplus,
                                item.saleUnit,
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-soft">Faltante</dt>
                            <dd>
                              {formatQty(
                                receptionDone ? item.shortageQty ?? balance.shortage : balance.shortage,
                                item.saleUnit,
                              )}
                            </dd>
                          </div>
                        </dl>
                        {awaitingReception && !excluded ? (
                          <div className="mt-3">
                            <Field label="Cantidad recibida">
                              <Input
                                inputMode="decimal"
                                value={row.receivedQty}
                                onChange={(event) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    [item.productId]: { ...row, receivedQty: event.target.value },
                                  }))
                                }
                              />
                            </Field>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                  <span className="text-sm text-ink-soft">
                    Total de la compra
                    {wholesale?.supplier ? ` · ${wholesale.supplier.name}` : ''}
                  </span>
                  <strong className="font-display text-3xl">
                    {wholesale?.totalCost ? formatMoney(wholesale.totalCost) : '—'}
                  </strong>
                </div>
                {awaitingReception &&
                canManagePurchases &&
                (wholesale?.items.filter((item) => !item.excludedAt).length ?? 0) > 0 ? (
                  <Button className="mt-4" onClick={submitReception}>
                    Registrar recepción y sobrante
                  </Button>
                ) : null}
                {receptionDone ? (
                  <p className="mt-3 text-sm text-ok">
                    Recepción registrada. Solo el sobrante (recibido − demanda) ingresó a stock, con el costo de esta
                    compra.
                  </p>
                ) : null}
              </>
            )}
          </section>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="Sin pedidos esta semana"
            description="Cuando los clientes pidan durante el jueves y el miércoles, acá vas a ver cuánta carne encargar."
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmingWeek}
        title="¿Confirmar todos los pedidos de esta semana?"
        description={`Esta acción cambiará el estado de los ${data.summary.pending} pedido(s) pendientes de esta semana. No toca los cancelados, entregados ni los que ya avanzaron.`}
        confirmLabel="Confirmar pedidos"
        loading={confirmWeek.isPending}
        onClose={() => setConfirmingWeek(false)}
        onConfirm={() => confirmWeek.mutate()}
      />

      <ConfirmDialog
        open={confirmingWholesale}
        title="¿Confirmar el pedido a proveedores?"
        description="Se confirma el pedido que se realizará a los proveedores. Quedan congelados demanda, cantidades solicitadas, proveedor y precio de coste. Después se carga la cantidad realmente recibida."
        confirmLabel="Confirmar pedido a proveedores"
        loading={confirmWholesale.isPending}
        onClose={() => setConfirmingWholesale(false)}
        onConfirm={() => confirmWholesale.mutate()}
      />

      <ConfirmDialog
        open={generatingPurchases}
        title="¿Registrar la recepción de esta semana?"
        description="La cantidad recibida cubre la demanda semanal. Solo el sobrante (recibido − demanda) entra a stock, con el precio de esta compra. Si ya se procesó, no se vuelve a sumar."
        confirmLabel="Registrar recepción"
        loading={generatePurchases.isPending}
        onClose={() => setGeneratingPurchases(false)}
        onConfirm={() => generatePurchases.mutate()}
      />

      <ConfirmDialog
        open={Boolean(excludingProduct)}
        title="¿Dar de baja este producto de la demanda semanal?"
        description={
          excludingProduct
            ? `${excludingProduct.productName} va a dejar de sumar a la demanda. El registro y los pedidos se conservan, marcados como dados de baja.`
            : 'El producto dejará de sumar a la demanda. El historial se conserva.'
        }
        confirmLabel="Dar de baja"
        danger
        loading={excludeProduct.isPending}
        onClose={() => setExcludingProduct(null)}
        onConfirm={() => {
          if (excludingProduct) excludeProduct.mutate(excludingProduct.productId);
        }}
      />

      <ConfirmDialog
        open={resettingWeek}
        title="¿Estás seguro de que querés resetear el pedido semanal?"
        description="Esta acción eliminará o restablecerá los datos generados para esta prueba y permitirá volver a asignar proveedores y procesar el stock. No toca ventas ni pedidos ya en preparación o entrega. Si el stock de esas compras ya se usó, la operación se bloquea."
        confirmLabel="Resetear pedido semanal"
        danger
        loading={resetWeek.isPending}
        onClose={() => setResettingWeek(false)}
        onConfirm={() => resetWeek.mutate()}
      />
    </div>
  );
}
