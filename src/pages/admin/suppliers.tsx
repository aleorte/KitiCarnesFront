import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { suppliersApi } from '../../api/services';
import { Button, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Skeleton, Textarea } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import type { Supplier } from '../../types/api';

const schema = z.object({
  name: z.string().min(2, 'Ingresá el nombre'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SuppliersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [pending, setPending] = useState<Supplier | null>(null);
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => suppliersApi.list({ limit: 100 }) });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const save = useMutation({
    mutationFn: (values: FormValues) => (editing ? suppliersApi.update(editing.id, values) : suppliersApi.create(values)),
    onSuccess: () => {
      toast.success(editing ? 'Proveedor actualizado' : 'Proveedor creado');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => suppliersApi.remove(id),
    onSuccess: () => {
      toast.success('Proveedor eliminado o desactivado');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setPending(null);
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
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Proveedores"
        description="Frigoríficos y mayoristas. Si un proveedor tiene compras, se desactiva para no romper el historial."
        actions={hasPermission('suppliers:manage') ? <Button onClick={() => openForm()}>Nuevo proveedor</Button> : null}
      />
      {suppliers.isLoading ? (
        <Skeleton className="h-72" />
      ) : suppliers.data?.data.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {suppliers.data.data.map((supplier) => (
            <article key={supplier.id} className="rounded-3xl bg-cream p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl">{supplier.name}</h2>
                {!supplier.isActive ? <span className="rounded-full bg-paper px-2 py-1 text-xs text-ink-soft">Inactivo</span> : null}
              </div>
              <p className="text-sm text-ink-soft">{supplier.phone} · {supplier.email}</p>
              <p className="text-sm text-ink-soft">{supplier.address}</p>
              {hasPermission('suppliers:manage') ? (
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" onClick={() => openForm(supplier)}>Editar</Button>
                  <Button variant="danger" onClick={() => setPending(supplier)}>Eliminar</Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin proveedores" description="Cargá el primero para registrar compras y costos." />
      )}
      <Modal
        open={open}
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        onClose={() => setOpen(false)}
      >
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Field label="Nombre" error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
          <Field label="Teléfono"><Input {...form.register('phone')} /></Field>
          <Field label="Email"><Input {...form.register('email')} /></Field>
          <Field label="Dirección"><Input {...form.register('address')} /></Field>
          <Field label="Notas"><Textarea rows={3} {...form.register('notes')} /></Field>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar'}</Button>
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Eliminar proveedor"
        description={`Si “${pending?.name}” tiene compras, se desactiva para conservar el historial. Si no, se elimina.`}
        confirmLabel="Confirmar"
        danger
        loading={remove.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && remove.mutate(pending.id)}
      />
    </div>
  );
}
