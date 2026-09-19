import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { categoriesApi, productsApi } from '../../api/services';
import { CategoryManager } from '../../components/category-manager';
import { ProductMedia } from '../../components/commerce';
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
  type Category,
  type Product,
  type ProductListStatus,
  type ProductUsage,
  type SaleUnit,
} from '../../types/api';
import { formatMoney } from '../../utils/format';

const schema = z.object({
  name: z.string().min(2, 'Ingresá el nombre'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  salePrice: z.string().min(1, 'Ingresá el precio de venta'),
  saleUnit: z.enum(['UNIT', 'KILOGRAM']),
  estimatedMinKg: z.string().optional(),
  estimatedMaxKg: z.string().optional(),
  stock: z.string().min(1, 'Ingresá el stock'),
  categoryId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const STATUS_FILTERS: Array<{ id: ProductListStatus; label: string }> = [
  { id: 'catalog', label: 'Catálogo' },
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' },
  { id: 'archived', label: 'Fuera de catálogo' },
];

function catalogStatus(product: Product): Exclude<ProductListStatus, 'all' | 'catalog'> {
  if (product.deletedAt) return 'archived';
  if (!product.isActive) return 'inactive';
  return 'active';
}

function usageLines(usage: ProductUsage) {
  return [
    `${usage.orders} pedidos`,
    `${usage.sales} ventas`,
    `${usage.purchases} compras`,
    `${usage.stockMovements} movimientos de stock`,
    `${usage.wholesaleItems ?? 0} renglones al proveedor`,
  ];
}

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<Product | null>(null);
  const [pendingArchive, setPendingArchive] = useState<{
    product: Product;
    usage: ProductUsage;
  } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductListStatus>('catalog');
  const products = useQuery({
    queryKey: ['admin-products', categoryFilter, statusFilter],
    queryFn: () =>
      productsApi.list({
        limit: 100,
        status: statusFilter,
        categoryId: categoryFilter && categoryFilter !== 'none' ? categoryFilter : undefined,
        uncategorized: categoryFilter === 'none' ? true : undefined,
      }),
  });
  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => categoriesApi.list({ limit: 100 }),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const activeCategories = useMemo(
    () => (categories.data?.data ?? []).filter((category) => category.isActive !== false),
    [categories.data],
  );

  const refreshProducts = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    void queryClient.invalidateQueries({ queryKey: ['store-products'] });
    void queryClient.invalidateQueries({ queryKey: ['store-categories'] });
    void queryClient.invalidateQueries({ queryKey: ['store-product'] });
    void queryClient.invalidateQueries({ queryKey: ['sale-products'] });
    void queryClient.invalidateQueries({ queryKey: ['stock-products'] });
  };

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        imageUrl: values.imageUrl || undefined,
        estimatedMinKg:
          values.saleUnit === 'UNIT' && values.estimatedMinKg ? values.estimatedMinKg : null,
        estimatedMaxKg:
          values.saleUnit === 'UNIT' && values.estimatedMaxKg ? values.estimatedMaxKg : null,
        categoryId: values.categoryId || null,
      };
      return editing ? productsApi.update(editing.id, payload) : productsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Producto actualizado' : 'Producto creado');
      refreshProducts();
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => productsApi.deactivate(id),
    onSuccess: (updated) => {
      toast.success(`${updated.name} quedó inactivo. El cliente ya no lo ve.`);
      refreshProducts();
      setPendingDeactivate(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const activate = useMutation({
    mutationFn: (id: string) => productsApi.activate(id),
    onSuccess: (updated) => {
      toast.success(`${updated.name} volvió a estar activo para el cliente.`);
      refreshProducts();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => productsApi.archive(id),
    onSuccess: (result) => {
      toast.success(
        result.strategy === 'deleted'
          ? 'Producto eliminado del catálogo.'
          : 'Producto sacado del catálogo. El historial se conservó.',
      );
      refreshProducts();
      setPendingArchive(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openForm = (product?: Product) => {
    setEditing(product ?? null);
    form.reset({
      name: product?.name ?? '',
      description: product?.description ?? '',
      imageUrl: product?.imageUrl ?? '',
      salePrice: product?.salePrice ?? '',
      saleUnit: (product?.saleUnit ?? 'KILOGRAM') as SaleUnit,
      estimatedMinKg: product?.estimatedMinKg ?? '',
      estimatedMaxKg: product?.estimatedMaxKg ?? '',
      stock: product?.stock ?? '0',
      categoryId: product?.categoryId ?? '',
    });
    setOpen(true);
  };

  const startArchive = async (product: Product) => {
    try {
      const usage = await productsApi.usage(product.id);
      setPendingArchive({ product, usage });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo consultar el historial');
    }
  };

  return (
    <div>
      <PageHeader
        title="Productos"
        description="El producto define su precio de venta. Desactivar lo oculta al cliente; eliminar lo saca del catálogo y conserva pedidos, ventas y compras."
        actions={
          hasPermission('products:manage') ? (
            <Button onClick={() => openForm()}>Nuevo corte</Button>
          ) : null
        }
      />
      <CategoryManager<Category>
        eyebrow="Categorías"
        title="Cortes y elaborados"
        description="Se usan en el mostrador y al cargar productos. Son opcionales: si eliminás una, los productos quedan sin categoría."
        canManage={hasPermission('categories:manage')}
        queryKey="admin-categories"
        invalidateKeys={['admin-products', 'store-categories', 'store-products']}
        api={categoriesApi}
        countOf={(category) => category._count?.products ?? 0}
        linkedNoun={{ singular: 'producto', plural: 'productos' }}
      />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatusFilter(filter.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${statusFilter === filter.id ? 'bg-ink text-cream' : 'bg-cream'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={`shrink-0 rounded-full px-4 py-2 text-sm ${categoryFilter === '' ? 'bg-ink text-cream' : 'bg-cream'}`}
        >
          Todas
        </button>
        {activeCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setCategoryFilter(category.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${categoryFilter === category.id ? 'bg-ink text-cream' : 'bg-cream'}`}
          >
            {category.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCategoryFilter('none')}
          className={`shrink-0 rounded-full px-4 py-2 text-sm ${categoryFilter === 'none' ? 'bg-ink text-cream' : 'bg-cream'}`}
        >
          Sin categoría
        </button>
      </div>
      {products.isLoading ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.data?.data.map((product) => {
            const status = catalogStatus(product);
            return (
              <article
                key={product.id}
                className="grid grid-cols-[112px_1fr] overflow-hidden rounded-3xl bg-cream"
              >
                <ProductMedia product={product} className="h-full min-h-36 w-full" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/60">
                        {product.category?.name ?? 'Sin categoría'}
                      </p>
                      <h2 className="font-display text-2xl">{product.name}</h2>
                    </div>
                    <Badge tone={status === 'active' ? 'ok' : status === 'inactive' ? 'warn' : 'danger'}>
                      {PRODUCT_STATUS_LABEL[status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink-soft">
                    {product.saleUnit === 'KILOGRAM' || (product.estimatedMinKg && product.estimatedMaxKg)
                      ? 'Por kg'
                      : 'Por unidad'}{' '}
                    · {formatMoney(product.salePrice)}
                  </p>
                  {product.estimatedMinKg && product.estimatedMaxKg ? (
                    <p className="text-sm font-medium text-warn">
                      Peso estimado {product.estimatedMinKg}–{product.estimatedMaxKg} kg. El cliente pide unidades.
                    </p>
                  ) : null}
                  {product.lastKnownCost ? (
                    <p className="text-xs text-ink-soft">
                      Último coste de compra {formatMoney(product.lastKnownCost)}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-soft/70">Sin compras al proveedor todavía</p>
                  )}
                  <p className="mt-1 text-sm">Stock {product.stock}</p>
                  <p className="text-sm font-medium">Estado: {PRODUCT_STATUS_LABEL[status]}</p>
                  {hasPermission('products:manage') && status !== 'archived' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => openForm(product)}>
                        Editar
                      </Button>
                      {status === 'active' ? (
                        <Button
                          variant="secondary"
                          disabled={deactivate.isPending}
                          onClick={() => setPendingDeactivate(product)}
                        >
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          disabled={activate.isPending}
                          onClick={() => activate.mutate(product.id)}
                        >
                          {activate.isPending && activate.variables === product.id ? 'Activando...' : 'Activar'}
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => void startArchive(product)}>
                        Eliminar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Modal
        open={open}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        description="El precio de coste no se carga acá: se registra en el pedido al proveedor, porque cambia en cada compra."
        onClose={() => setOpen(false)}
        size="lg"
      >
        <form className="grid gap-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Field label="Nombre" error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} />
          </Field>
          <Field label="Descripción">
            <Textarea rows={3} {...form.register('description')} />
          </Field>
          <Field label="URL de imagen">
            <Input {...form.register('imageUrl')} placeholder="https://..." />
          </Field>
          <Field label="Precio de venta por kg o unidad" error={form.formState.errors.salePrice?.message}>
            <Input {...form.register('salePrice')} />
          </Field>
          <Field label="Unidad">
            <Select {...form.register('saleUnit')}>
              <option value="KILOGRAM">Por kilo (el cliente pide kg)</option>
              <option value="UNIT">Por unidad (pieza o elaborado)</option>
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Peso estimado mínimo (kg)"
              hint="Solo para piezas: el cliente pide 1 unidad, no este peso."
            >
              <Input {...form.register('estimatedMinKg')} placeholder="Ej: 2" />
            </Field>
            <Field label="Peso estimado máximo (kg)">
              <Input {...form.register('estimatedMaxKg')} placeholder="Ej: 4" />
            </Field>
          </div>
          <Field label="Stock" error={form.formState.errors.stock?.message}>
            <Input {...form.register('stock')} />
          </Field>
          <Field label="Categoría (opcional)" hint="El producto puede existir sin categoría.">
            <Select {...form.register('categoryId')}>
              <option value="">Sin categoría</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingDeactivate)}
        title="Desactivar producto"
        description={`¿Desactivar ${pendingDeactivate?.name}? Quedará inactivo: el cliente no lo verá. El administrador lo sigue viendo y puede volver a activarlo. El historial y el stock no se modifican.`}
        confirmLabel="Desactivar"
        danger
        loading={deactivate.isPending}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={() => pendingDeactivate && deactivate.mutate(pendingDeactivate.id)}
      />
      <ConfirmDialog
        open={Boolean(pendingArchive)}
        title="¿Eliminar producto?"
        description={`Estás por eliminar definitivamente "${pendingArchive?.product.name}". Esta acción eliminará el producto del catálogo y no podrá deshacerse. Si tiene pedidos, ventas o compras, el historial se conserva.`}
        confirmLabel="Eliminar"
        danger
        loading={archive.isPending}
        onClose={() => setPendingArchive(null)}
        onConfirm={() => pendingArchive && archive.mutate(pendingArchive.product.id)}
      >
        {pendingArchive ? (
          <ul className="mt-3 space-y-1 text-sm text-ink-soft">
            <li className="font-semibold text-ink">Este producto tiene:</li>
            {usageLines(pendingArchive.usage).map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
