import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { categoriesApi, productsApi } from '../../api/services';
import { ProductMedia } from '../../components/commerce';
import { Button, ConfirmDialog, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import type { Product, SaleUnit } from '../../types/api';
import { formatMoney } from '../../utils/format';
import { CategoryManager } from './category-manager';

const schema = z.object({
  name: z.string().min(2, 'Ingresá el nombre'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  purchasePrice: z.string().min(1, 'Ingresá el precio de compra'),
  salePrice: z.string().min(1, 'Ingresá el precio de venta'),
  saleUnit: z.enum(['UNIT', 'KILOGRAM']),
  weightKg: z.string().optional(),
  stock: z.string().min(1, 'Ingresá el stock'),
  minStock: z.string().min(1, 'Ingresá el stock mínimo'),
  categoryId: z.string().min(1, 'Elegí una categoría'),
});

type FormValues = z.infer<typeof schema>;

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pending, setPending] = useState<Product | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const products = useQuery({
    queryKey: ['admin-products', categoryFilter],
    queryFn: () => productsApi.list({
      limit: 100,
      isActive: true,
      categoryId: categoryFilter || undefined,
    }),
  });
  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: () => categoriesApi.list({ limit: 100 }) });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const activeCategories = useMemo(
    () => (categories.data?.data ?? []).filter((category) => category.isActive !== false),
    [categories.data],
  );

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        imageUrl: values.imageUrl || undefined,
        weightKg: values.saleUnit === 'UNIT' && values.weightKg ? values.weightKg : undefined,
      };
      return editing ? productsApi.update(editing.id, payload) : productsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Producto actualizado' : 'Producto creado');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      toast.success('Producto desactivado');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setPending(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openForm = (product?: Product) => {
    setEditing(product ?? null);
    form.reset({
      name: product?.name ?? '',
      description: product?.description ?? '',
      imageUrl: product?.imageUrl ?? '',
      purchasePrice: product?.purchasePrice ?? '',
      salePrice: product?.salePrice ?? '',
      saleUnit: (product?.saleUnit ?? 'KILOGRAM') as SaleUnit,
      weightKg: product?.weightKg ?? '',
      stock: product?.stock ?? '0',
      minStock: product?.minStock ?? '0',
      categoryId: product?.categoryId ?? activeCategories[0]?.id ?? '',
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Precios, stock, imagen y categoría. El empleado consulta; el admin define costos."
        actions={hasPermission('products:manage') ? <Button onClick={() => openForm()}>Nuevo corte</Button> : null}
      />
      <CategoryManager />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={`rounded-full px-4 py-2 text-sm ${categoryFilter === '' ? 'bg-ink text-cream' : 'bg-cream'}`}
        >
          Todas
        </button>
        {activeCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setCategoryFilter(category.id)}
            className={`rounded-full px-4 py-2 text-sm ${categoryFilter === category.id ? 'bg-ink text-cream' : 'bg-cream'}`}
          >
            {category.name}
          </button>
        ))}
      </div>
      {products.isLoading ? <Skeleton className="h-80" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.data?.data.map((product) => {
            const low = Number(product.stock) < Number(product.minStock ?? 0);
            return (
              <article key={product.id} className="grid grid-cols-[112px_1fr] overflow-hidden rounded-3xl bg-cream">
                <ProductMedia product={product} className="h-full min-h-36 w-full" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/60">{product.category?.name}</p>
                      <h2 className="font-display text-2xl">{product.name}</h2>
                    </div>
                    {low ? <span className="rounded-full bg-warn/10 px-2 py-1 text-xs text-warn">Stock bajo</span> : null}
                  </div>
                  <p className="text-sm text-ink-soft">{product.saleUnit === 'KILOGRAM' ? 'Por kg' : 'Por unidad'} · {formatMoney(product.salePrice)}</p>
                  {product.purchasePrice ? <p className="text-xs text-ink-soft">Costo {formatMoney(product.purchasePrice)}</p> : null}
                  <p className="mt-1 text-sm">Stock {product.stock}{product.weightKg ? ` · ${product.weightKg} kg` : ''}</p>
                  {hasPermission('products:manage') ? (
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" onClick={() => openForm(product)}>Editar</Button>
                      <Button variant="danger" onClick={() => setPending(product)}>Desactivar</Button>
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
        description="Los precios y el stock quedan guardados en el backend. La categoría sale del listado configurable."
        onClose={() => setOpen(false)}
        size="lg"
      >
        <form className="grid gap-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Field label="Nombre" error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
          <Field label="Descripción"><Textarea rows={3} {...form.register('description')} /></Field>
          <Field label="URL de imagen"><Input {...form.register('imageUrl')} placeholder="https://..." /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Precio de compra" error={form.formState.errors.purchasePrice?.message}><Input {...form.register('purchasePrice')} /></Field>
            <Field label="Precio de venta" error={form.formState.errors.salePrice?.message}><Input {...form.register('salePrice')} /></Field>
          </div>
          <Field label="Unidad">
            <Select {...form.register('saleUnit')}>
              <option value="KILOGRAM">Por kilo</option>
              <option value="UNIT">Por unidad</option>
            </Select>
          </Field>
          <Field label="Peso típico (solo unidad)"><Input {...form.register('weightKg')} /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Stock" error={form.formState.errors.stock?.message}><Input {...form.register('stock')} /></Field>
            <Field label="Stock mínimo"><Input {...form.register('minStock')} /></Field>
          </div>
          <Field label="Categoría" error={form.formState.errors.categoryId?.message}>
            <Select {...form.register('categoryId')}>
              <option value="">Elegir</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar'}</Button>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Desactivar producto"
        description={`¿Desactivar ${pending?.name}? Dejará de verse en el mostrador.`}
        confirmLabel="Desactivar"
        danger
        loading={deactivate.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && deactivate.mutate(pending.id)}
      />
    </div>
  );
}
