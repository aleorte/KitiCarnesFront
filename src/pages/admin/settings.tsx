import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { settingsApi } from '../../api/services';
import { Button, Field, Input, PageHeader, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import { formatWhatsAppDisplay, toWhatsAppNumber } from '../../utils/whatsapp';

const schema = z.object({
  whatsappPhone: z
    .string()
    .trim()
    .refine((value) => value === '' || toWhatsAppNumber(value), {
      message: 'Ingresá un WhatsApp válido, por ejemplo +54 9 3493 123456',
    }),
});

export function SettingsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { whatsappPhone: '' } });

  useEffect(() => {
    if (!settings.data) return;
    form.reset({
      whatsappPhone: formatWhatsAppDisplay(settings.data.whatsappPhone) ?? '',
    });
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: (whatsappPhone: string) =>
      settingsApi.update({
        whatsappPhone: whatsappPhone.trim() ? whatsappPhone.trim() : null,
      }),
    onSuccess: (result) => {
      toast.success('Configuración guardada');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      form.reset({
        whatsappPhone: formatWhatsAppDisplay(result.whatsappPhone) ?? '',
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader title="Configuración" description="Sesión, permisos y WhatsApp de Rinde Más Carnes." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl bg-cream p-5">
          <h2 className="font-display text-2xl">Sesión</h2>
          <p className="mt-3">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-sm text-ink-soft">{user?.email}</p>
          <p className="mt-2 text-sm">Rol {user?.role}</p>
        </section>
        <section className="rounded-3xl bg-cream p-5">
          <h2 className="font-display text-2xl">Tienda pública</h2>
          <p className="mt-3 text-sm text-ink-soft">
            El mostrador vive en la misma app, sin login, y carga pedidos reales contra `/store`.
          </p>
          <Link to="/" className="mt-4 inline-block text-blood">
            Abrir mostrador
          </Link>
        </section>
        <section className="rounded-3xl bg-cream p-5 md:col-span-2">
          <h2 className="font-display text-2xl">Número de WhatsApp</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Lo usan el mostrador y el equipo para hablar con clientes. El pedido confirmado se abre
            hacia el teléfono del cliente, no hacia este número.
          </p>
          {settings.isLoading ? (
            <Skeleton className="mt-4 h-28" />
          ) : (
            <form
              className="mt-4 max-w-md space-y-3"
              onSubmit={form.handleSubmit((values) => save.mutate(values.whatsappPhone))}
            >
              <Field
                label="Número de WhatsApp"
                hint={
                  settings.data?.whatsappPhone
                    ? `Guardado: ${formatWhatsAppDisplay(settings.data.whatsappPhone)}`
                    : 'No configurado'
                }
                error={form.formState.errors.whatsappPhone?.message}
              >
                <Input
                  inputMode="tel"
                  placeholder="+54 9 3493 XXXXXXX"
                  disabled={!canEdit}
                  {...form.register('whatsappPhone')}
                />
              </Field>
              {canEdit ? (
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              ) : (
                <p className="text-sm text-ink-soft">Solo un administrador puede cambiarlo.</p>
              )}
            </form>
          )}
        </section>
        <section className="rounded-3xl bg-cream p-5 md:col-span-2">
          <h2 className="font-display text-2xl">Permisos</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {user?.permissions.map((permission) => (
              <span key={permission} className="rounded-full bg-paper px-3 py-1 text-xs">
                {permission}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
