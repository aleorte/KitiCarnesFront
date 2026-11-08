import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { dashboardApi, ordersApi } from '../../api/services';
import { BRAND_NAME } from '../../brand';
import { Button, Field, Input, Modal, PageHeader, Skeleton, Textarea } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import { ORDER_STATUS_LABEL, type DashboardOverview, type TreasuryIndicatorKey } from '../../types/api';
import { dateOnly, formatMoney } from '../../utils/format';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

const TREASURY_CARDS: Array<{
  key: keyof DashboardOverview['treasury'];
  indicator: TreasuryIndicatorKey;
  title: string;
}> = [
  { key: 'caja', indicator: 'CAJA', title: 'Caja' },
  { key: 'efectivo', indicator: 'EFECTIVO', title: 'Efectivo' },
  { key: 'cuentaCorriente', indicator: 'CUENTA_CORRIENTE', title: 'Cuenta corriente' },
];

function TreasuryPanel({
  treasury,
  canEdit,
}: {
  treasury: DashboardOverview['treasury'];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{
    indicator: TreasuryIndicatorKey;
    title: string;
    current: string;
    next: string;
    reason: string;
  } | null>(null);

  const adjust = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Indicador inválido');
      const next = editing.next.trim().replace(',', '.');
      if (!MONEY_PATTERN.test(next)) {
        throw new Error('El importe debe ser numérico, con hasta 2 decimales');
      }
      if (editing.reason.trim().length < 5) {
        throw new Error('Indicá un motivo de al menos 5 caracteres');
      }
      return dashboardApi.adjustTreasury({
        indicator: editing.indicator,
        newValue: next,
        reason: editing.reason.trim(),
      });
    },
    onSuccess: (nextTreasury) => {
      queryClient.setQueryData(['dashboard'], (old: DashboardOverview | undefined) =>
        old ? { ...old, treasury: nextTreasury } : old,
      );
      toast.success('Ajuste de tesorería guardado');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="mt-6">
      <h2 className="font-display text-2xl">Tesorería</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">
        Caja es el líquido del negocio. Efectivo es sólo el dinero físico. Cuenta corriente es lo que todavía deben los
        clientes por entregas y ventas ya hechas. Un ajuste no borra cobros, pagos ni deudas: queda registrado como
        movimiento.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TREASURY_CARDS.map((card) => {
          const data = treasury[card.key];
          return (
            <div key={card.indicator} className="rounded-3xl bg-cream p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">{card.title}</p>
              <p className="mt-2 font-display text-3xl">{formatMoney(data.value)}</p>
              <p className="mt-2 text-sm text-ink-soft">{data.description}</p>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 min-h-11 px-0"
                  onClick={() =>
                    setEditing({
                      indicator: card.indicator,
                      title: card.title,
                      current: String(data.value),
                      next: String(data.value),
                      reason: '',
                    })
                  }
                >
                  Ajustar
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      <Modal
        open={Boolean(editing)}
        title={editing ? `Ajustar ${editing.title}` : 'Ajustar'}
        description="El valor actual se conserva en el historial. Guardá sólo si el importe y el motivo son correctos."
        onClose={() => {
          if (!adjust.isPending) setEditing(null);
        }}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="min-h-11" disabled={adjust.isPending} onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={adjust.isPending || !editing}
              onClick={() => adjust.mutate()}
            >
              {adjust.isPending ? 'Guardando...' : 'Guardar ajuste'}
            </Button>
          </div>
        }
      >
        {editing ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">Valor actual: {formatMoney(editing.current)}</p>
            <Field label="Nuevo importe">
              <Input
                inputMode="decimal"
                value={editing.next}
                onChange={(event) => setEditing({ ...editing, next: event.target.value })}
              />
            </Field>
            <Field label="Motivo">
              <Textarea
                rows={3}
                value={editing.reason}
                onChange={(event) => setEditing({ ...editing, reason: event.target.value })}
                placeholder="Arqueo, corrección de saldo inicial, etc."
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const overview = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.overview });
  const evolution = useQuery({ queryKey: ['evolution'], queryFn: () => dashboardApi.evolution('day') });
  const todayOrders = useQuery({
    queryKey: ['orders-today'],
    queryFn: () => ordersApi.list({ from: dateOnly(), to: dateOnly(), limit: 8 }),
  });

  if (overview.isLoading || !overview.data) {
    return <Skeleton className="h-96" />;
  }

  const data = overview.data;
  const cards = [
    ['Ventas del día', formatMoney(data.sales.today)],
    ['Ventas de la semana', formatMoney(data.sales.week)],
    ['Ventas del mes', formatMoney(data.sales.month)],
    ['Pedidos pendientes', String(data.orders.pending)],
    ['Pedidos de hoy', String(todayOrders.data?.meta.total ?? 0)],
    ['Pedidos entregados', String(data.orders.delivered)],
    ['Pagos pendientes', formatMoney(data.pendingPayments.outstandingAmount)],
  ];

  return (
    <div>
      <PageHeader eyebrow={BRAND_NAME} title="Tablero" description="Lo que importa para despachar, cobrar y reponer." />
      {data.treasury ? (
        <TreasuryPanel treasury={data.treasury} canEdit={hasPermission('dashboard:financial')} />
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-3xl bg-cream p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">{label}</p>
            <p className="mt-2 font-display text-3xl">{value}</p>
          </div>
        ))}
        {hasPermission('dashboard:financial') && data.financial ? (
          <div className="rounded-3xl bg-ink p-5 text-cream">
            <p className="text-xs uppercase tracking-[0.16em] text-gold">Ganancia estimada del mes</p>
            <p className="mt-2 font-display text-3xl">{formatMoney(data.financial.monthEstimatedProfit)}</p>
            {data.financial.monthItemsWithoutCost ? (
              <p className="mt-2 text-xs text-cream/70">
                {data.financial.monthItemsWithoutCost} renglón(es) vendidos sin coste de compra
                registrado: la ganancia real puede ser menor.
              </p>
            ) : null}
          </div>
        ) : null}
        {data.stock ? (
          <div className="rounded-3xl bg-cream p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Valor de stock</p>
            <p className="mt-2 font-display text-3xl">{formatMoney(data.stock.estimatedValue)}</p>
            <p className="mt-1 text-sm text-ink-soft">{data.stock.products} productos en inventario</p>
          </div>
        ) : null}
        {data.businessWeek ? (
          <div className="rounded-3xl bg-cream p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Pedidos de la semana</p>
            <p className="mt-2 font-display text-3xl">{data.businessWeek.orders}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {data.businessWeek.label} · {data.businessWeek.pending} pendientes · {data.businessWeek.customers} clientes
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="rounded-3xl bg-cream p-5 lg:col-span-3">
          <h2 className="font-display text-2xl">Evolución de ventas</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolution.data?.series ?? []}>
                <XAxis dataKey="period" hide />
                <YAxis hide />
                <Tooltip />
                <Area dataKey="total" stroke="#7A1F2B" fill="#7A1F2B33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl bg-cream p-5 lg:col-span-2">
          <h2 className="font-display text-2xl">Pedidos de hoy</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {todayOrders.data?.data.length ? (
              todayOrders.data.data.map((order) => (
                <li key={order.id} className="flex justify-between gap-3">
                  <span>
                    {order.customer?.firstName} {order.customer?.lastName}
                    <span className="block text-ink-soft/70">
                      {order.customer?.phone} · {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </span>
                  <span>{formatMoney(order.finalTotal ?? order.estimatedTotal)}</span>
                </li>
              ))
            ) : (
              <li className="text-ink-soft">Todavía no entraron pedidos hoy.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
