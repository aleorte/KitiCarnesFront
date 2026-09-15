import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { storeApi } from '../../api/services';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';
import { useCart } from '../../hooks/use-cart';
import { DELIVERY_WINDOWS } from '../../types/api';
import { dateOnly, formatMoney, toDecimalString } from '../../utils/format';

const schema = z.object({
  firstName: z.string().min(2, 'Ingresá el nombre'),
  lastName: z.string().min(2, 'Ingresá el apellido'),
  phone: z.string().min(8, 'Ingresá un teléfono'),
  address: z.string().min(5, 'Ingresá la dirección'),
  notes: z.string().optional(),
  estimatedDeliveryDate: z.string().min(1),
  window: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function CheckoutPage() {
  const { items, estimatedTotal, hasWeightItems, clear } = useCart();
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      estimatedDeliveryDate: dateOnly(),
      window: '09:00|12:00',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const [start, end] = values.window.split('|');
      return storeApi.checkout({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        address: values.address,
        notes: values.notes,
        estimatedDeliveryDate: values.estimatedDeliveryDate,
        deliveryWindowStart: start,
        deliveryWindowEnd: end,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: toDecimalString(item.quantity, item.saleUnit === 'KILOGRAM' ? 3 : 3),
          requestedKg: item.saleUnit === 'KILOGRAM' ? toDecimalString(item.quantity) : undefined,
        })),
      });
    },
    onSuccess: (order) => {
      const phone = form.getValues('phone');
      sessionStorage.setItem('kitikitikiti.lastPhone', phone);
      navigate(`/pedido/${order.id}`, { state: { phone } });
      clear();
    },
  });

  useEffect(() => {
    if (!items.length && !mutation.isPending && !mutation.isSuccess) {
      navigate('/carrito', { replace: true });
    }
  }, [items.length, mutation.isPending, mutation.isSuccess, navigate]);

  if (!items.length) return null;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="font-display text-4xl">Confirmar entrega</h1>
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
        <Field label="Fecha de entrega">
          <Input type="date" {...form.register('estimatedDeliveryDate')} />
        </Field>
        <Field label="Franja horaria">
          <Select {...form.register('window')}>
            {DELIVERY_WINDOWS.map((window) => (
              <option key={window.label} value={`${window.start}|${window.end}`}>
                {window.label} · {window.start} a {window.end}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Indicaciones">
          <Textarea rows={4} {...form.register('notes')} placeholder="Timbre, referencias, punto de entrega..." />
        </Field>
        {mutation.isError ? (
          <p className="text-sm text-blood">{mutation.error.message}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enviando pedido...' : 'Confirmar pedido'}
        </Button>
      </form>
      <aside className="h-fit rounded-3xl bg-cream p-5">
        <h2 className="font-display text-2xl">Resumen</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span>
                {item.name}
                <span className="block text-ink-soft/70">
                  {item.saleUnit === 'KILOGRAM' ? `${item.quantity} kg` : `${item.quantity} u.`}
                </span>
              </span>
              <span>{formatMoney(Number(item.salePrice) * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-between border-t border-line pt-4">
          <span>Estimado</span>
          <span className="font-display text-3xl">{formatMoney(estimatedTotal)}</span>
        </div>
        {hasWeightItems ? <p className="mt-3 text-sm text-warn">El peso final puede ajustar el total.</p> : null}
      </aside>
    </div>
  );
}
