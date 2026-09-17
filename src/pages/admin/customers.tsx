import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { customersApi } from '../../api/services';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Textarea,
} from '../../components/ui';
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
type SortKey = 'name' | 'phone';

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('customers:manage');
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sort, setSort] = useState<SortKey>('name');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);

  const customers = useQuery({
    queryKey: ['customers', search, includeArchived],
    queryFn: () =>
      customersApi.list({
        search: search || undefined,
        includeDeleted: includeArchived || undefined,
        limit: 50,
      }),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const rows = useMemo(() => {
    const data = [...(customers.data?.data ?? [])];
    return data.sort((a, b) =>
      sort === 'phone'
        ? a.phone.localeCompare(b.phone, 'es')
        : `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'),
    );
  }, [customers.data, sort]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      editing ? customersApi.update(editing.id, values) : customersApi.create(values),
    onSuccess: () => {
      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado');
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: (result) => {
      toast.success(
        result.strategy === 'archived'
          ? `Cliente dado de baja. Se conservan ${result.orders} pedido(s) y ${result.sales} venta(s).`
          : 'Cliente eliminado',
      );
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      setPendingDelete(null);
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
        actions={canManage ? <Button onClick={() => openForm()}>Nuevo cliente</Button> : null}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-md flex-1"
          placeholder="Buscar por nombre, teléfono o dirección"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Ver dados de baja
        </label>
      </div>
      {customers.isLoading ? (
        <Skeleton className="h-72" />
      ) : rows.length ? (
        <div className="overflow-hidden rounded-3xl bg-cream">
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-line text-xs uppercase tracking-[0.12em] text-ink-soft/70 sm:table-header-group">
              <tr>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => setSort('name')} className="uppercase">
                    Nombre {sort === 'name' ? '↑' : ''}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => setSort('phone')} className="uppercase">
                    Teléfono {sort === 'phone' ? '↑' : ''}
                  </button>
                </th>
                <th className="px-4 py-3">Dirección</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((customer) => (
                <tr
                  key={customer.id}
                  className="flex flex-col gap-1 px-4 py-4 sm:table-row sm:gap-0 sm:px-0 sm:py-0"
                >
                  <td className="sm:px-4 sm:py-3">
                    <Link
                      to={`/admin/clientes/${customer.id}`}
                      className="font-semibold hover:text-blood"
                    >
                      {customer.firstName} {customer.lastName}
                    </Link>
                    {customer.deletedAt ? (
                      <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-xs text-ink-soft">
                        Dado de baja
                      </span>
                    ) : null}
                  </td>
                  <td className="sm:px-4 sm:py-3">
                    <a href={`tel:${customer.phone}`} className="hover:text-blood">
                      {customer.phone}
                    </a>
                  </td>
                  <td className="text-ink-soft sm:px-4 sm:py-3">{customer.address}</td>
                  <td className="sm:px-4 sm:py-3 sm:text-right">
                    {canManage ? (
                      <div className="flex gap-2 sm:justify-end">
                        <Button variant="secondary" onClick={() => openForm(customer)}>
                          Editar
                        </Button>
                        {!customer.deletedAt ? (
                          <Button variant="danger" onClick={() => setPendingDelete(customer)}>
                            Eliminar
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Todavía no hay clientes"
          description="Van a aparecer acá cuando alguien pida desde el mostrador o los cargues a mano."
        />
      )}
      <Modal
        open={open}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        description="Solo nombre, teléfono, dirección y una nota si hace falta."
        onClose={() => setOpen(false)}
      >
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Field label="Nombre" error={form.formState.errors.firstName?.message}>
            <Input {...form.register('firstName')} />
          </Field>
          <Field label="Apellido" error={form.formState.errors.lastName?.message}>
            <Input {...form.register('lastName')} />
          </Field>
          <Field label="Teléfono" error={form.formState.errors.phone?.message}>
            <Input {...form.register('phone')} />
          </Field>
          <Field label="Dirección" error={form.formState.errors.address?.message}>
            <Input {...form.register('address')} />
          </Field>
          <Field label="Notas">
            <Textarea {...form.register('notes')} />
          </Field>
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar cliente"
        description={`¿Eliminar a ${pendingDelete?.firstName} ${pendingDelete?.lastName}? Si tiene pedidos o ventas se da de baja para no perder el historial.`}
        confirmLabel="Eliminar"
        danger
        loading={remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  );
}

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const customer = useQuery({ queryKey: ['customer', id], queryFn: () => customersApi.one(id) });
  const history = useQuery({
    queryKey: ['customer-history', id],
    queryFn: () => customersApi.history(id),
  });

  if (!customer.data) return <Skeleton className="h-80" />;

  return (
    <div>
      <PageHeader
        title={`${customer.data.firstName} ${customer.data.lastName}`}
        description={`${customer.data.phone} · ${customer.data.address}`}
      />
      {customer.data.deletedAt ? (
        <p className="mb-6 rounded-2xl bg-paper p-3 text-sm text-ink-soft">
          Este cliente está dado de baja. Su historial se conserva para los reportes.
        </p>
      ) : null}
      <p className="mb-6 text-ink-soft">{customer.data.notes || 'Sin indicaciones extra.'}</p>
      <p className="mb-6 text-sm text-ink-soft">
        {history.data?.orders.length ?? 0} pedidos · {history.data?.sales.length ?? 0} ventas de
        mostrador
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
        <p className="mt-3 text-sm text-ink-soft">Todavía no hizo pedidos.</p>
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
