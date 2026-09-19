import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { productsApi, supplierCategoriesApi, suppliersApi } from '../../api/services';
import { CategoryManager } from '../../components/category-manager';
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
import type { Product, Supplier, SupplierCategory } from '../../types/api';
import { formatMoney } from '../../utils/format';

const schema = z.object({
  name: z.string().min(2, 'Ingresá el nombre'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  categoryId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SuppliersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('suppliers:manage');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [pending, setPending] = useState<Supplier | null>(null);
  const [assigning, setAssigning] = useState<Supplier | null>(null);
  const [linkProductId, setLinkProductId] = useState('');
  const [linkPrice, setLinkPrice] = useState('');
  const [linkMin, setLinkMin] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const suppliers = useQuery({
    queryKey: ['suppliers', categoryFilter],
    queryFn: () =>
      suppliersApi.list({
        limit: 100,
        isActive: true,
        categoryId: categoryFilter && categoryFilter !== 'none' ? categoryFilter : undefined,
        uncategorized: categoryFilter === 'none' ? true : undefined,
      }),
  });
  const categories = useQuery({
    queryKey: ['supplier-categories'],
    queryFn: () => supplierCategoriesApi.list({ limit: 100 }),
  });
  const activeCategories = useMemo(
    () => (categories.data?.data ?? []).filter((category) => category.isActive !== false),
    [categories.data],
  );

  const products = useQuery({
    queryKey: ['admin-products-all'],
    queryFn: () => productsApi.list({ limit: 100, isActive: true }),
    enabled: Boolean(assigning),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = { ...values, categoryId: values.categoryId || null };
      return editing ? suppliersApi.update(editing.id, payload) : suppliersApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Proveedor actualizado' : 'Proveedor creado');
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => suppliersApi.remove(id),
    onSuccess: (result) => {
      toast.success(
        result.strategy === 'deleted'
          ? 'Proveedor eliminado.'
          : 'Proveedor dado de baja. El historial de compras se conservó.',
      );
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier-categories'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-orders'] });
      setPending(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const linkProduct = useMutation({
    mutationFn: () =>
      suppliersApi.linkProduct(assigning!.id, {
        productId: linkProductId,
        purchasePrice: linkPrice || undefined,
        minPurchaseQty: linkMin || undefined,
      }),
    onSuccess: () => {
      toast.success('Producto asignado al proveedor');
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setLinkProductId('');
      setLinkPrice('');
      setLinkMin('');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const unlinkProduct = useMutation({
    mutationFn: (productId: string) => suppliersApi.unlinkProduct(assigning!.id, productId),
    onSuccess: () => {
      toast.success('Producto desvinculado');
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openForm = (supplier?: Supplier) => {
    setEditing(supplier ?? null);
    form.reset({
      name: supplier?.name ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      address: supplier?.address ?? '',
      notes: supplier?.notes ?? '',
      categoryId: supplier?.categoryId ?? '',
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Proveedores"
        description="Frigoríficos y mayoristas. Si un proveedor tiene historial, se da de baja y las compras quedan registradas."
        actions={canManage ? <Button onClick={() => openForm()}>Nuevo proveedor</Button> : null}
      />
      <CategoryManager<SupplierCategory>
        eyebrow="Categorías"
        title="Tipos de proveedor"
        description="Mayorista, distribuidor, embutidos... Las definís vos. Son opcionales: si eliminás una, los proveedores quedan sin categoría."
        canManage={canManage}
        queryKey="supplier-categories"
        invalidateKeys={['suppliers']}
        api={supplierCategoriesApi}
        countOf={(category) => category._count?.suppliers ?? 0}
        linkedNoun={{ singular: 'proveedor', plural: 'proveedores' }}
      />
      {activeCategories.length ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryFilter('')}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${categoryFilter === '' ? 'bg-ink text-cream' : 'bg-cream'}`}
          >
            Todos
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
      ) : null}
      {suppliers.isLoading ? (
        <Skeleton className="h-72" />
      ) : suppliers.data?.data.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {suppliers.data.data.map((supplier) => (
            <article key={supplier.id} className="rounded-3xl bg-cream p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/60">
                    {supplier.category?.name ?? 'Sin categoría'}
                  </p>
                  <h2 className="font-display text-2xl">{supplier.name}</h2>
                </div>
                {!supplier.isActive ? (
                  <span className="rounded-full bg-paper px-2 py-1 text-xs text-ink-soft">
                    Inactivo
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-ink-soft">
                {[supplier.phone, supplier.email].filter(Boolean).join(' · ') || 'Sin contacto'}
              </p>
              <p className="text-sm text-ink-soft">{supplier.address}</p>
              {supplier.products?.length ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {supplier.products.map((link) => (
                    <li key={link.id} className="flex justify-between gap-2">
                      <span>{link.product.name}</span>
                      <span>
                        {link.purchasePrice ? `${formatMoney(link.purchasePrice)}/kg` : 'sin precio'}
                        {link.minPurchaseQty ? ` · mín. ${link.minPurchaseQty}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-soft/70">Sin productos asignados</p>
              )}
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => openForm(supplier)}>
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAssigning(supplier);
                      setLinkProductId('');
                      setLinkPrice('');
                      setLinkMin('');
                    }}
                  >
                    Productos
                  </Button>
                  <Button variant="danger" onClick={() => setPending(supplier)}>
                    Eliminar
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin proveedores"
          description="Cargá el primero para registrar compras y costos."
        />
      )}
      <Modal
        open={open}
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        onClose={() => setOpen(false)}
      >
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Field label="Nombre" error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} />
          </Field>
          <Field label="Categoría (opcional)" hint="El proveedor puede existir sin categoría.">
            <Select {...form.register('categoryId')}>
              <option value="">Sin categoría</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Teléfono">
            <Input {...form.register('phone')} />
          </Field>
          <Field label="Email">
            <Input {...form.register('email')} />
          </Field>
          <Field label="Dirección">
            <Input {...form.register('address')} />
          </Field>
          <Field label="Notas">
            <Textarea rows={3} {...form.register('notes')} />
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(assigning)}
        title={assigning ? `Productos de ${assigning.name}` : 'Productos'}
        description="El precio acá es el actual/referencial de este proveedor. Las compras históricas no cambian si lo actualizás."
        onClose={() => setAssigning(null)}
      >
        {assigning ? (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(
                suppliers.data?.data.find((supplier) => supplier.id === assigning.id)?.products ??
                assigning.products ??
                []
              ).map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2">
                  <span>
                    {link.product.name}
                    <span className="block text-xs text-ink-soft">
                      {link.purchasePrice ? `${formatMoney(link.purchasePrice)} / kg` : 'Sin precio actual'}
                      {link.minPurchaseQty ? ` · mínimo ${link.minPurchaseQty}` : ''}
                    </span>
                  </span>
                  <Button variant="danger" onClick={() => unlinkProduct.mutate(link.productId)}>
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
            <Field label="Producto">
              <Select value={linkProductId} onChange={(event) => setLinkProductId(event.target.value)}>
                <option value="">Elegí un producto</option>
                {(products.data?.data ?? []).map((product: Product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Precio de compra actual / kg">
              <Input value={linkPrice} onChange={(event) => setLinkPrice(event.target.value)} placeholder="Ej: 7500.00" />
            </Field>
            <Field label="Mínimo de compra">
              <Input value={linkMin} onChange={(event) => setLinkMin(event.target.value)} placeholder="Ej: 20.000" />
            </Field>
            <Button
              disabled={!linkProductId || linkProduct.isPending}
              onClick={() => linkProduct.mutate()}
            >
              {linkProduct.isPending ? 'Asignando...' : 'Asignar producto'}
            </Button>
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Eliminar proveedor"
        description={`¿Eliminar a “${pending?.name}”? Si tiene compras o pedidos a proveedores, se da de baja para no perder el historial.`}
        confirmLabel="Eliminar"
        danger
        loading={remove.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && remove.mutate(pending.id)}
      />
    </div>
  );
}
