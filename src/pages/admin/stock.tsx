import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { productsApi, stockApi } from '../../api/services';
import {
  Badge,
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
import { useAuth } from '../../hooks/use-auth';
import {
  PRODUCT_STATUS_LABEL,
  STOCK_MOVEMENT_LABEL,
  type Product,
  type StockMovementType,
} from '../../types/api';
import { formatDateTime, formatMoney, formatQty } from '../../utils/format';

function catalogStatus(product: Product) {
  if (product.deletedAt) return 'archived' as const;
  if (!product.isActive) return 'inactive' as const;
  return 'active' as const;
}

export function StockPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canAdjust = hasPermission('stock:adjust');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<StockMovementType | ''>('');
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [clearing, setClearing] = useState<Product | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  const overview = useQuery({ queryKey: ['stock-overview'], queryFn: stockApi.overview });
  const products = useQuery({
    queryKey: ['stock-products', search],
    queryFn: () =>
      productsApi.list({
        limit: 100,
        status: 'all',
        search: search || undefined,
      }),
  });
  const movements = useQuery({
    queryKey: ['stock-movements', type],
    queryFn: () => stockApi.movements({ limit: 40, type: type || undefined }),
  });

  const clear = useMutation({
    mutationFn: (id: string) => stockApi.clear(id),
    onSuccess: (product) => {
      toast.success(`Stock de ${product.name} eliminado. El historial se conservó.`);
      void queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setClearing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjust = useMutation({
    mutationFn: () => stockApi.adjust(adjusting!.id, delta, reason || undefined),
    onSuccess: () => {
      toast.success('Movimiento de stock registrado');
      void queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setAdjusting(null);
      setDelta('');
      setReason('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const summary = overview.data;

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Cantidad disponible actualmente. No hay stock mínimo: el mínimo de compra vive en cada proveedor."
      />
      {overview.isLoading || !summary ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-cream p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Productos</p>
            <p className="mt-2 font-display text-3xl">{summary.products}</p>
          </div>
          <div className="rounded-3xl bg-ink p-5 text-cream">
            <p className="text-xs uppercase tracking-[0.16em] text-gold">Valor estimado</p>
            <p className="mt-2 font-display text-3xl">{formatMoney(summary.estimatedValue)}</p>
            <p className="mt-1 text-xs text-cream/70">Stock × precio de venta actual</p>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Field label="Buscar producto">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Asado, vacío..." />
        </Field>
      </div>

      {products.isLoading ? (
        <Skeleton className="mt-4 h-72" />
      ) : (
        <div className="mt-4 hidden overflow-hidden rounded-3xl bg-cream md:block">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-ink-soft">
              <tr>
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 font-medium">Stock</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(products.data?.data ?? []).map((product) => {
                const status = catalogStatus(product);
                return (
                  <tr key={product.id} className="border-t border-line">
                    <td className="px-5 py-3 font-semibold">
                      {product.name}
                      {status !== 'active' ? (
                        <span className="ml-2 inline-block">
                          <Badge tone={status === 'inactive' ? 'warn' : 'danger'}>
                            {PRODUCT_STATUS_LABEL[status]}
                          </Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      {formatQty(
                        product.stock,
                        product.saleUnit === 'KILOGRAM' || product.estimatedMinKg ? 'KILOGRAM' : product.saleUnit,
                      )}
                    </td>
                    <td className="px-5 py-3">{formatMoney(Number(product.stock) * Number(product.salePrice))}</td>
                    <td className="px-5 py-3 text-right">
                      {canAdjust ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setAdjusting(product);
                              setDelta('');
                              setReason('');
                            }}
                          >
                            Ajustar
                          </Button>
                          <Button
                            variant="danger"
                            disabled={Number(product.stock) <= 0}
                            onClick={() => setClearing(product)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:hidden">
        {(products.data?.data ?? []).map((product) => {
          const status = catalogStatus(product);
          return (
            <article key={product.id} className="rounded-3xl bg-cream p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-ink-soft">{formatQty(product.stock, product.saleUnit)}</p>
                  {status !== 'active' ? (
                    <Badge tone={status === 'inactive' ? 'warn' : 'danger'}>{PRODUCT_STATUS_LABEL[status]}</Badge>
                  ) : null}
                </div>
                {canAdjust ? (
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button variant="secondary" onClick={() => setAdjusting(product)}>
                      Ajustar
                    </Button>
                    <Button
                      variant="danger"
                      disabled={Number(product.stock) <= 0}
                      onClick={() => setClearing(product)}
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl">Movimientos</h2>
          <Field label="Tipo">
            <Select value={type} onChange={(event) => setType(event.target.value as StockMovementType | '')}>
              <option value="">Todos</option>
              {Object.entries(STOCK_MOVEMENT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {movements.isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <ul className="space-y-2">
            {(movements.data?.data ?? []).map((movement) => (
              <li key={movement.id} className="rounded-3xl bg-cream px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span>
                    <strong>{movement.product?.name ?? 'Producto'}</strong>
                    <span className="block text-ink-soft">
                      {STOCK_MOVEMENT_LABEL[movement.type]} · {formatDateTime(movement.createdAt)}
                    </span>
                  </span>
                  <span className={Number(movement.quantityDelta) < 0 ? 'text-blood' : 'text-ok'}>
                    {Number(movement.quantityDelta) > 0 ? '+' : ''}
                    {movement.quantityDelta}
                  </span>
                </div>
                {movement.reason ? <p className="mt-1 text-ink-soft/80">{movement.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(clearing)}
        title="Eliminar registro de stock"
        description={
          clearing
            ? `¿Estás seguro de que querés eliminar este registro de stock? Esta acción afectará únicamente el stock disponible de ${clearing.name} (${formatQty(clearing.stock, clearing.saleUnit)}). Compras, ventas y movimientos históricos se conservan.`
            : '¿Estás seguro de que querés eliminar este registro de stock? Esta acción afectará únicamente este registro.'
        }
        confirmLabel="Eliminar"
        danger
        loading={clear.isPending}
        onConfirm={() => {
          if (clearing) clear.mutate(clearing.id);
        }}
        onClose={() => setClearing(null)}
      />

      <Modal open={Boolean(adjusting)} title={adjusting ? `Ajustar ${adjusting.name}` : 'Ajustar'} onClose={() => setAdjusting(null)}>
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            Usá un número positivo para entrada y negativo para salida. Queda un movimiento con fecha, usuario y motivo.
          </p>
          <Field label="Cantidad (+ entrada / − salida)">
            <Input value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="Ej: -1.500" />
          </Field>
          <Field label="Motivo">
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Merma, conteo, devolución..." />
          </Field>
          <Button className="w-full" disabled={!delta || adjust.isPending} onClick={() => adjust.mutate()}>
            {adjust.isPending ? 'Guardando...' : 'Registrar movimiento'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
