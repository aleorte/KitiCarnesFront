import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { weeklyOrdersApi } from '../../api/services';
import { Button, EmptyState, Input, PageHeader, Skeleton } from '../../components/ui';
import type { WeeklyProductSummary } from '../../types/api';
import { formatCopyQty, formatDateSlash, formatQty } from '../../utils/format';

function supplierOrderText(
  weekStart: string,
  weekEnd: string,
  products: WeeklyProductSummary[],
  totalKg: string | number,
) {
  const lines = [
    `Pedido semana ${formatDateSlash(weekStart, false)} al ${formatDateSlash(weekEnd, false)}`,
    '',
    ...products
      .filter((product) => Number(product.totalQuantity) > 0)
      .map((product) =>
        product.saleUnit === 'KILOGRAM'
          ? `${product.productName}: ${formatCopyQty(product.totalQuantity, product.saleUnit)} solicitados`
          : `${product.productName}: ${formatCopyQty(product.totalQuantity, product.saleUnit)}`,
      ),
    '',
    `Total: ${formatCopyQty(totalKg, 'KILOGRAM')} solicitados`,
  ];

  return lines.join('\n');
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

export function WeeklyOrdersPage() {
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);

  const week = useQuery({
    queryKey: ['weekly-orders', weekStart],
    queryFn: () => weeklyOrdersApi.week({ weekStart, limit: 1 }),
    placeholderData: keepPreviousData,
  });

  const data = week.data;
  const products = useMemo(
    () => (data?.products ?? []).filter((product) => Number(product.totalQuantity) > 0),
    [data?.products],
  );

  async function copyOrder() {
    if (!data || !products.length) {
      toast.error('No hay productos para copiar en esta semana');
      return;
    }

    try {
      await copyText(supplierOrderText(data.weekStart, data.weekEnd, products, data.summary.kg));
      toast.success('Pedido copiado. Ya lo podés pegar en WhatsApp.');
    } catch {
      toast.error('No se pudo copiar el pedido');
    }
  }

  if (week.isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={data.isCurrent ? 'Semana actual' : 'Semana anterior'}
        title="Pedidos semanales"
        description={`Semana del ${formatDateSlash(data.weekStart)} al ${formatDateSlash(data.weekEnd)}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setWeekStart(data.previousWeekStart)}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button variant={data.isCurrent ? 'primary' : 'secondary'} onClick={() => setWeekStart(undefined)}>
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
        <p className="text-xs uppercase tracking-[0.18em] text-gold">Total de carne a pedir · kg solicitados</p>
        <p className="mt-2 font-display text-5xl leading-none sm:text-6xl">{formatQty(data.summary.kg, 'KILOGRAM')}</p>
        <Button className="mt-6 w-full sm:w-auto" onClick={() => void copyOrder()} disabled={!products.length}>
          <Copy className="h-4 w-4" />
          Copiar pedido al proveedor
        </Button>
      </section>

      {products.length ? (
        <section className="mt-6 overflow-hidden rounded-3xl bg-cream">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs uppercase tracking-[0.16em] text-ink-soft">
            <span>Producto</span>
            <span>Cantidad solicitada</span>
          </div>
          <ul>
            {products.map((product) => (
              <li
                key={product.productId}
                className="flex items-baseline justify-between gap-4 border-t border-line px-5 py-4 first:border-t-0"
              >
                <span className="text-base font-semibold sm:text-lg">{product.productName}</span>
                <span className="font-display text-2xl sm:text-3xl">
                  {product.saleUnit === 'KILOGRAM'
                    ? `${formatQty(product.totalQuantity, product.saleUnit)} solicitados`
                    : formatQty(product.totalQuantity, product.saleUnit)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="Sin pedidos esta semana"
            description="Cuando los clientes pidan durante el jueves y el miércoles, acá vas a ver cuánta carne encargar."
          />
        </div>
      )}
    </div>
  );
}
