import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { productsApi, purchasesApi, suppliersApi } from '../../api/services';
import {
  Button,
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
import { formatDate, formatMoney, formatQty } from '../../utils/format';

const itemSchema = z.object({
  productId: z.string().min(1, 'Elegí un producto'),
  quantity: z.string().min(1, 'Ingresá la cantidad'),
  unitCost: z.string().min(1, 'Ingresá el precio de compra'),
});

const schema = z.object({
  supplierId: z.string().min(1, 'Elegí un proveedor'),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

export function PurchasesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('purchases:manage');
  const [open, setOpen] = useState(false);

  const purchases = useQuery({
    queryKey: ['purchases'],
    queryFn: () => purchasesApi.list({ limit: 50 }),
  });
  const suppliers = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => suppliersApi.list({ limit: 100, isActive: true }),
  });
  const products = useQuery({
    queryKey: ['admin-products-all'],
    queryFn: () => productsApi.list({ limit: 100, isActive: true }),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', notes: '', items: [{ productId: '', quantity: '', unitCost: '' }] },
  });
  const items = useFieldArray({ control: form.control, name: 'items' });
  const supplierId = form.watch('supplierId');
  const selectedSupplier = useMemo(
    () => suppliers.data?.data.find((supplier) => supplier.id === supplierId),
    [supplierId, suppliers.data],
  );

  const save = useMutation({
    mutationFn: (values: FormValues) => purchasesApi.create(values),
    onSuccess: () => {
      toast.success('Compra registrada. El precio queda histórico en este comprobante.');
      void queryClient.invalidateQueries({ queryKey: ['purchases'] });
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader
        title="Compras al proveedor"
        description="Cada compra guarda una copia del precio usado. Si el proveedor cambia el precio después, estas compras no se modifican."
        actions={canManage ? <Button onClick={() => setOpen(true)}>Nueva compra</Button> : null}
      />
      {purchases.isLoading ? (
        <Skeleton className="h-80" />
      ) : purchases.data?.data.length ? (
        <div className="space-y-3">
          {purchases.data.data.map((purchase) => (
            <article key={purchase.id} className="rounded-3xl bg-cream p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{purchase.supplier.name}</h2>
                  <p className="text-sm text-ink-soft">{formatDate(purchase.purchasedAt)}</p>
                </div>
                <strong className="font-display text-3xl">{formatMoney(purchase.totalCost)}</strong>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {purchase.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span>
                      {item.product?.name ?? item.productId}
                      <span className="block text-ink-soft/70">
                        {formatQty(item.quantity, item.product?.saleUnit ?? 'KILOGRAM')} ·{' '}
                        {formatMoney(item.unitCost)} (histórico)
                      </span>
                    </span>
                    <span>{formatMoney(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {purchase.notes ? <p className="mt-3 text-sm text-ink-soft">{purchase.notes}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin compras"
          description="Registrá una compra manual o generála desde el pedido semanal."
        />
      )}
      <Modal
        open={open}
        title="Nueva compra"
        description="El precio que cargues queda copiado en esta compra y no cambia si después actualizás al proveedor."
        onClose={() => setOpen(false)}
        size="lg"
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Field label="Proveedor" error={form.formState.errors.supplierId?.message}>
            <Select {...form.register('supplierId')}>
              <option value="">Elegí un proveedor</option>
              {(suppliers.data?.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
          <ul className="space-y-4">
            {items.fields.map((field, index) => (
              <li key={field.id} className="grid gap-3 rounded-2xl bg-paper p-3 sm:grid-cols-[1fr_120px_140px_auto]">
                <Field label="Producto">
                  <Select
                    {...form.register(`items.${index}.productId`)}
                    onChange={(event) => {
                      form.setValue(`items.${index}.productId`, event.target.value);
                      const link = selectedSupplier?.products?.find((row) => row.productId === event.target.value);
                      if (link?.purchasePrice) {
                        form.setValue(`items.${index}.unitCost`, link.purchasePrice);
                      }
                    }}
                  >
                    <option value="">Elegí</option>
                    {(products.data?.data ?? []).map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Cantidad">
                  <Input {...form.register(`items.${index}.quantity`)} />
                </Field>
                <Field label="Precio de compra">
                  <Input {...form.register(`items.${index}.unitCost`)} />
                </Field>
                <Button
                  type="button"
                  variant="danger"
                  className="self-end"
                  onClick={() => items.remove(index)}
                  disabled={items.fields.length === 1}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="secondary"
            onClick={() => items.append({ productId: '', quantity: '', unitCost: '' })}
          >
            Agregar renglón
          </Button>
          <Field label="Notas">
            <Textarea rows={2} {...form.register('notes')} />
          </Field>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando...' : 'Registrar compra'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
