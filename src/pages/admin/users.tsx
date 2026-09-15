import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { usersApi } from '../../api/services';
import { Button, Field, Input, Modal, PageHeader, Select, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';

const schema = z.object({
  firstName: z.string().min(2, 'Ingresá el nombre'),
  lastName: z.string().min(2, 'Ingresá el apellido'),
  email: z.string().email('Ingresá un email válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['ADMIN', 'EMPLEADO']),
});

export function UsersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const users = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { role: 'EMPLEADO' as const } });
  const create = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success('Usuario creado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      form.reset({ role: 'EMPLEADO' });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!hasPermission('users:manage')) return <p>No tenés acceso a usuarios.</p>;

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Accesos del equipo. El rol define qué ven en el panel."
        actions={<Button onClick={() => { form.reset({ role: 'EMPLEADO' }); setOpen(true); }}>Nuevo usuario</Button>}
      />
      {users.isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="space-y-3">
          {users.data?.data.map((user) => (
            <article key={user.id} className="rounded-3xl bg-cream p-4">
              <p className="font-semibold">{user.firstName} {user.lastName}</p>
              <p className="text-sm text-ink-soft">{user.email} · {user.role}</p>
            </article>
          ))}
        </div>
      )}
      <Modal open={open} title="Nuevo usuario" onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
          <Field label="Nombre" error={form.formState.errors.firstName?.message}><Input {...form.register('firstName')} /></Field>
          <Field label="Apellido" error={form.formState.errors.lastName?.message}><Input {...form.register('lastName')} /></Field>
          <Field label="Email" error={form.formState.errors.email?.message}><Input {...form.register('email')} /></Field>
          <Field label="Contraseña" error={form.formState.errors.password?.message}><Input type="password" {...form.register('password')} /></Field>
          <Field label="Rol">
            <Select {...form.register('role')}>
              <option value="EMPLEADO">Empleado</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creando...' : 'Crear'}</Button>
        </form>
      </Modal>
    </div>
  );
}
