import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardApi } from '../../api/services';
import { PageHeader, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import { formatMoney, formatQty } from '../../utils/format';

export function StatsPage() {
  const { hasPermission } = useAuth();
  const overview = useQuery({ queryKey: ['stats-overview'], queryFn: dashboardApi.overview });
  const evolution = useQuery({ queryKey: ['stats-evolution'], queryFn: () => dashboardApi.evolution('week') });
  const top = useQuery({ queryKey: ['stats-top'], queryFn: dashboardApi.topProducts });

  if (!overview.data) return <Skeleton className="h-96" />;

  return (
    <div>
      <PageHeader title="Estadísticas" description="Lectura rápida de ventas, cortes y costos. Los números salen del backend." />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-cream p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Pedidos</p>
          <p className="font-display text-4xl">{overview.data.orders.total}</p>
        </div>
        <div className="rounded-3xl bg-cream p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Mes</p>
          <p className="font-display text-4xl">{formatMoney(overview.data.sales.month)}</p>
        </div>
        {hasPermission('dashboard:financial') && overview.data.financial ? (
          <div className="rounded-3xl bg-ink p-5 text-cream">
            <p className="text-xs uppercase tracking-[0.16em] text-gold">Compras del mes</p>
            <p className="font-display text-4xl">{formatMoney(overview.data.financial.monthCosts)}</p>
            <p className="mt-2 text-xs text-cream/70">
              Coste de lo vendido {formatMoney(overview.data.financial.monthCogs)} · ganancia{' '}
              {formatMoney(overview.data.financial.monthEstimatedProfit)}
            </p>
          </div>
        ) : (
          <div className="rounded-3xl bg-cream p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Pendiente de cobro</p>
            <p className="font-display text-4xl">{formatMoney(overview.data.pendingPayments.outstandingAmount)}</p>
          </div>
        )}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-cream p-5">
          <h2 className="font-display text-2xl">Evolución semanal</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolution.data?.series ?? []}>
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#7A1F2B" radius={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl bg-cream p-5">
          <h2 className="font-display text-2xl">Productos más vendidos</h2>
          <p className="mt-1 text-sm text-ink-soft">Según los kilos realmente entregados.</p>
          <ul className="mt-4 space-y-3">
            {(top.data ?? overview.data.topProducts).map((item) => (
              <li key={item.productId} className="flex justify-between gap-3">
                <span>
                  {item.productName}
                  {Number(item.kg) > 0 ? (
                    <span className="block text-sm text-ink-soft/70">
                      {formatQty(item.kg, 'KILOGRAM')}
                    </span>
                  ) : null}
                </span>
                <span>{formatMoney(item.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
