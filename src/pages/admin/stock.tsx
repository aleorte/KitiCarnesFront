import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { productsApi, stockApi } from '../../api/services';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import { type Product, type StockMovementType, STOCK_MOVEMENT_LABEL } from '../../types/api';
import { formatDateTime, formatMoney, formatQty, isVariableWeight } from '../../utils/format';

function stockUnit(product: Pick<Product, 'saleUnit' | 'estimatedMinKg' | 'estimatedMaxKg'>) {
  return product.saleUnit === 'KILOGRAM' || isVariableWeight(product) ? 'KILOGRAM' : 'UNIT';
}

function parseQuantity(raw: string) {
  const value = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(value) ? value : NaN;
}

function quantityError(raw: string, unit: 'UNIT' | 'KILOGRAM') {
  if (!raw.trim()) return 'Ingresá la cantidad';
  const value = parseQuantity(raw);
  if (!Number.isFinite(value)) return 'Ingresá un número válido';
  if (value <= 0) return 'La cantidad debe ser mayor a cero';
  if (unit === 'UNIT' && !Number.isInteger(value)) return 'Para este corte la cantidad tiene que ser un número entero';
  return null;
}

export function StockPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canAdjust = hasPermission('stock:adjust');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<StockMovementType | ''>('');
  const [adding, setAdding] = useState<Product | null | 'pick'>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [clearing, setClearing] = useState<Product | null>(null);

  const overview = useQuery({ queryKey: ['stock-overview'], queryFn: stockApi.overview });
  const products = useQuery({
    queryKey: ['stock-products', search],
    queryFn: () =>
      productsApi.list({
        limit: 100,
        status: 'catalog',
        hasStock: true,
        search: search || undefined,
      }),
  });
  const restockCandidates = useQuery({
    queryKey: ['stock-restock-candidates', pickerSearch],
    queryFn: () =>
      productsApi.list({
        limit: 40,
        status: 'catalog',
        hasStock: false,
        search: pickerSearch || undefined,
      }),
    enabled: adding === 'pick',
  });
  const movements = useQuery({
    queryKey: ['stock-movements', type],
    queryFn: () => stockApi.movements({ limit: 40, type: type || undefined }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['stock-products'] });
    void queryClient.invalidateQueries({ queryKey: ['stock-restock-candidates'] });
    void queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
  };

  const add = useMutation({
    mutationFn: ({ product, amount }: { product: Product; amount: string }) =>
      stockApi.add(product.id, amount.replace(',', '.')),
    onSuccess: (product) => {
      toast.success(`${product.name}: ${formatQty(product.stock, stockUnit(product))}`);
      refresh();
      closeAdd();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjust = useMutation({
    mutationFn: () => stockApi.adjust(adjusting!.id, delta.replace(',', '.'), reason || undefined),
    onSuccess: () => {
      toast.success('Ajuste de stock registrado');
      refresh();
      setAdjusting(null);
      setDelta('');
      setReason('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clear = useMutation({
    mutationFn: (id: string) => stockApi.clear(id),
    onSuccess: (product) => {
      toast.success(`Stock de ${product.name} en 0. El producto sigue existiendo.`);
      refresh();
      setClearing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selected = adding === 'pick' ? null : adding;
  const addUnit = selected ? stockUnit(selected) : 'KILOGRAM';
  const addError = selected ? quantityError(quantity, addUnit) : null;
  const items = products.data?.data ?? [];
  const candidates = useMemo(
    () => restockCandidates.data?.data ?? [],
    [restockCandidates.data],
  );

  const closeAdd = () => {
    setAdding(null);
    setPickerSearch('');
    setQuantity('');
  };

  const openAddExisting = (product: Product) => {
    setAdding(product);
    setQuantity('');
  };

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Solo se listan cortes con cantidad disponible. Si un producto está en 0, sigue existiendo: agrégalo de nuevo cuando entre mercadería."
        actions={
          canAdjust ? (
            <Button className="min-h-12 w-full sm:w-auto" onClick={() => setAdding('pick')}>
              + Agregar al stock
            </Button>
          ) : null
        }
      />

      {overview.isLoading || !overview.data ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-cream p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft/70">Con stock</p>
            <p className="mt-1 font-display text-3xl">{overview.data.products}</p>
          </div>
          <div className="rounded-3xl bg-ink p-4 text-cream">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Valor</p>
            <p className="mt-1 font-display text-2xl leading-none sm:text-3xl">
              {formatMoney(overview.data.estimatedValue)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-5">
        <Field label="Buscar">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Asado, vacío..."
            className="min-h-12"
          />
        </Field>
      </div>

      {products.isLoading ? (
        <Skeleton className="mt-4 h-72" />
      ) : items.length ? (
        <div className="mt-4 space-y-3">
          {items.map((product) => {
            const unit = stockUnit(product);
            return (
              <article key={product.id} className="rounded-3xl bg-cream p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 font-display text-2xl leading-tight">{product.name}</h2>
                  <p className="shrink-0 font-display text-2xl">{formatQty(product.stock, unit)}</p>
                </div>
                {canAdjust ? (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Button className="min-h-12 px-2 text-xs sm:text-sm" onClick={() => openAddExisting(product)}>
                      Agregar
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-12 px-2 text-xs sm:text-sm"
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
                      className="min-h-12 px-2 text-xs sm:text-sm"
                      onClick={() => setClearing(product)}
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="No hay stock disponible"
            description="Los productos con cantidad 0 no se muestran acá. Siguen en el catálogo: buscalos con Agregar al stock."
            action={
              canAdjust ? (
                <Button className="min-h-12" onClick={() => setAdding('pick')}>
                  + Agregar al stock
                </Button>
              ) : null
            }
          />
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-2xl">Movimientos</h2>
          <Field label="Tipo">
            <Select
              className="min-h-12"
              value={type}
              onChange={(event) => setType(event.target.value as StockMovementType | '')}
            >
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
                  <span className="min-w-0">
                    <strong className="block truncate">{movement.product?.name ?? 'Producto'}</strong>
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

      <Modal
        open={adding !== null}
        title={selected ? `Agregar a ${selected.name}` : 'Agregar al stock'}
        description={
          selected
            ? `Stock actual: ${formatQty(selected.stock, stockUnit(selected))}. La cantidad se suma, no se reemplaza.`
            : 'Elegí un producto que hoy está en 0. No se crea un corte nuevo.'
        }
        onClose={closeAdd}
      >
        {selected ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (addError) return;
              add.mutate({ product: selected, amount: quantity });
            }}
          >
            <Field
              label={addUnit === 'KILOGRAM' ? 'Kilos a agregar' : 'Unidades a agregar'}
              error={quantity.trim() ? addError ?? undefined : undefined}
            >
              <Input
                className="min-h-12"
                inputMode={addUnit === 'KILOGRAM' ? 'decimal' : 'numeric'}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={addUnit === 'KILOGRAM' ? 'Ej: 5' : 'Ej: 2'}
                autoFocus
              />
            </Field>
            <Button type="submit" className="min-h-12 w-full" disabled={Boolean(addError) || add.isPending}>
              {add.isPending ? 'Guardando...' : 'Agregar stock'}
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <Field label="Buscar producto">
              <Input
                className="min-h-12"
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder="Asado, vacío, matambre..."
                autoFocus
              />
            </Field>
            {restockCandidates.isLoading ? (
              <Skeleton className="h-40" />
            ) : candidates.length ? (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {candidates.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-paper px-4 py-3 text-left"
                      onClick={() => openAddExisting(product)}
                    >
                      <span className="font-semibold">{product.name}</span>
                      <span className="text-sm text-ink-soft">{formatQty(product.stock, stockUnit(product))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">
                {pickerSearch
                  ? 'No hay productos en 0 con ese nombre.'
                  : 'Todos los cortes del catálogo ya tienen stock, o no hay productos cargados.'}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(adjusting)}
        title={adjusting ? `Ajustar ${adjusting.name}` : 'Ajustar'}
        description="Para sumar mercadería usá Agregar. El ajuste es para corregir (positivo o negativo)."
        onClose={() => setAdjusting(null)}
      >
        <div className="space-y-3">
          <Field label="Cantidad (+ entrada / − salida)">
            <Input
              className="min-h-12"
              inputMode="decimal"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              placeholder="Ej: -1.5"
            />
          </Field>
          <Field label="Motivo">
            <Textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Merma, conteo, devolución..."
            />
          </Field>
          <Button className="min-h-12 w-full" disabled={!delta || adjust.isPending} onClick={() => adjust.mutate()}>
            {adjust.isPending ? 'Guardando...' : 'Registrar ajuste'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(clearing)}
        title="Dejar stock en 0"
        description={
          clearing
            ? `${clearing.name} va a quedar en 0 ${stockUnit(clearing) === 'KILOGRAM' ? 'kg' : 'u.'}. El producto no se borra: podés volver a agregarlo cuando entre mercadería.`
            : 'El producto queda en 0 y sigue existiendo.'
        }
        confirmLabel="Dejar en 0"
        danger
        loading={clear.isPending}
        onConfirm={() => {
          if (clearing) clear.mutate(clearing.id);
        }}
        onClose={() => setClearing(null)}
      />
    </div>
  );
}
