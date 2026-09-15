import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { customersApi } from '../../api/services';
import { Button, EmptyState, Field, Input, Modal, PageHeader, Skeleton, Textarea } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import type { Customer } from '../../types/api';
import { formatDate, formatMoney } from '../../utils/format';

const schema = z.object({
  firstName: z.string().min(2, 'Ingresá el nombre'),
  lastName: z.string().min(2, 'Ingresá el apellido'),
  phone: z.string().min(8, 'Ingresá un teléfono'),
  address: z.string().min(5, 'Ingresá la dirección'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const customers = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.list({ search: search || undefined, limit: 50 }),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const save = useMutation({
    mutationFn: (values: FormValues) =>
      editing ? customersApi.update(editing.id, values) : customersApi.create(values),
    onSuccess: () => {
      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openForm = (customer?: Customer) => {
    setEditing(customer ?? null);
    form.reset({
      firstName: customer?.firstName ?? '',
      lastName: customer?.lastName ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      notes: customer?.notes ?? '',
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Solo los datos que hacen falta para entregar: nombre, teléfono y dirección."
        actions={hasPermission('customers:manage') ? <Button onClick={() => openForm()}>Nuevo cliente</Button> : null}
      />
      <Input className="mb-4 max-w-md" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
      {customers.isLoading ? (
        <Skeleton className="h-72" />
      ) : customers.data?.data.length ? (
        <div className="space-y-3">
          {customers.data.data.map((customer) => (
            <article key={customer.id} className="flex items-center justify-between gap-3 rounded-3xl bg-cream p-4">
              <Link to={`/admin/clientes/${customer.id}`} className="min-w-0">
                <p className="font-semibold">{customer.firstName} {customer.lastName}</p>
                <p className="text-sm text-ink-soft">{customer.phone} · {customer.address}</p>
              </Link>
              {hasPermission('customers:manage') ? (
                <Button variant="secondary" onClick={() => openForm(customer)}>Editar</Button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Todavía no hay clientes" description="Van a aparecer acá cuando alguien pida desde el mostrador o los cargues a mano." />
      )}
      <Modal open={open} title={editing ? 'Editar cliente' : 'Nuevo cliente'} description="Solo nombre, teléfono, dirección y una nota si hace falta." onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Field label="Nombre" error={form.formState.errors.firstName?.message}><Input {...form.register('firstName')} /></Field>
          <Field label="Apellido" error={form.formState.errors.lastName?.message}><Input {...form.register('lastName')} /></Field>
          <Field label="Teléfono" error={form.formState.errors.phone?.message}><Input {...form.register('phone')} /></Field>
          <Field label="Dirección" error={form.formState.errors.address?.message}><Input {...form.register('address')} /></Field>
          <Field label="Notas"><Textarea {...form.register('notes')} /></Field>
          <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar'}</Button>
        </form>
      </Modal>
    </div>
  );
}

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const customer = useQuery({ queryKey: ['customer', id], queryFn: () => customersApi.one(id) });
  const history = useQuery({ queryKey: ['customer-history', id], queryFn: () => customersApi.history(id) });

  if (!customer.data) return <Skeleton className="h-80" />;

  return (
    <div>
      <PageHeader
        title={`${customer.data.firstName} ${customer.data.lastName}`}
        description={`${customer.data.phone} · ${customer.data.address}`}
      />
      <p className="mb-6 text-ink-soft">{customer.data.notes || 'Sin indicaciones extra.'}</p>
      <p className="mb-6 text-sm text-ink-soft">
        {history.data?.orders.length ?? 0} pedidos · {history.data?.sales.length ?? 0} ventas de mostrador
      </p>
      <h2 className="font-display text-2xl">Pedidos</h2>
      {history.data?.orders.length ? (
        <ul className="mt-3 space-y-3">
          {history.data.orders.map((order) => (
            <li key={order.id} className="rounded-2xl bg-cream p-4">
              <Link to={`/admin/pedidos/${order.id}`} className="font-semibold hover:text-blood">
                {formatDate(order.orderedAt)} · {formatMoney(order.estimatedTotal)}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">Todavía no pidió por delivery.</p>
      )}
      <h2 className="mt-8 font-display text-2xl">Ventas</h2>
      {history.data?.sales.length ? (
        <ul className="mt-3 space-y-3">
          {history.data.sales.map((sale) => (
            <li key={sale.id} className="rounded-2xl bg-cream p-4">
              {formatDate(sale.soldAt)} · {formatMoney(sale.total)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">Sin ventas de mostrador asociadas.</p>
      )}
    </div>
  );
}
