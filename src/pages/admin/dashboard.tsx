import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardApi, ordersApi } from '../../api/services';
import { PageHeader, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import { dateOnly, formatMoney } from '../../utils/format';

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const overview = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.overview });
  const evolution = useQuery({ queryKey: ['evolution'], queryFn: () => dashboardApi.evolution('day') });
  const todayOrders = useQuery({
    queryKey: ['orders-today'],
    queryFn: () => ordersApi.list({ deliveryDate: dateOnly(), limit: 8 }),
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
      <PageHeader eyebrow="Hoy en la carnicería" title="Tablero" description="Lo que importa para despachar, cobrar y reponer." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                <Area dataKey="total" stroke="#9b1d1d" fill="#9b1d1d33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl bg-cream p-5 lg:col-span-2">
          <h2 className="font-display text-2xl">Entregas de hoy</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {todayOrders.data?.data.length ? (
              todayOrders.data.data.map((order) => (
                <li key={order.id} className="flex justify-between gap-3">
                  <span>
                    {order.customer?.firstName} {order.customer?.lastName}
                    <span className="block text-ink-soft/70">
                      {order.deliveryWindowStart}-{order.deliveryWindowEnd}
                    </span>
                  </span>
                  <span>{formatMoney(order.estimatedTotal)}</span>
                </li>
              ))
            ) : (
              <li className="text-ink-soft">No hay entregas cargadas para hoy.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
