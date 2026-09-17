import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { storeApi } from '../../api/services';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { useCart } from '../../hooks/use-cart';
import { WeightPriceNotice } from '../../components/commerce';
import { estimatedLineTotals, formatMoneyRange, toDecimalString } from '../../utils/format';

const schema = z.object({
  firstName: z.string().min(2, 'Ingresá el nombre'),
  lastName: z.string().min(2, 'Ingresá el apellido'),
  phone: z.string().min(8, 'Ingresá un teléfono'),
  address: z.string().min(5, 'Ingresá la dirección'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CheckoutPage() {
  const { items, estimatedTotalMin, estimatedTotalMax, hasWeightItems, clear } = useCart();
  const navigate = useNavigate();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const catalog = useQuery({
    queryKey: ['store-products', '', ''],
    queryFn: () => storeApi.products(),
    enabled: items.length > 0,
  });
  const unavailable = items.filter(
    (item) => catalog.isSuccess && !(catalog.data ?? []).some((product) => product.id === item.productId),
  );

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (unavailable.length > 0) {
        throw new Error('Quitá los cortes que ya no están disponibles antes de confirmar.');
      }
      return storeApi.checkout({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        address: values.address,
        notes: values.notes,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: toDecimalString(item.quantity),
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
        <h1 className="font-display text-4xl">Confirmar pedido</h1>
        <p className="text-sm text-ink-soft">
          Dejanos tus datos y coordinamos la entrega con vos por teléfono.
        </p>
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
        <Field label="Indicaciones">
          <Textarea rows={4} {...form.register('notes')} placeholder="Timbre, referencias, punto de entrega..." />
        </Field>
        {unavailable.length > 0 ? (
          <p className="text-sm text-blood">
            {unavailable.map((item) => item.name).join(', ')} ya no está disponible. Volvé al carrito y quitalo antes de confirmar.
          </p>
        ) : null}
        {mutation.isError ? (
          <p className="text-sm text-blood">{mutation.error.message}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={mutation.isPending || unavailable.length > 0}>
          {mutation.isPending ? 'Enviando pedido...' : 'Confirmar pedido'}
        </Button>
      </form>
      <aside className="h-fit rounded-3xl bg-cream p-5">
        <h2 className="font-display text-2xl">Resumen</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((item) => {
            const range = estimatedLineTotals(item);
            return (
              <li key={item.productId}>
                <div className="flex justify-between gap-3">
                  <span>
                    {item.name}
                    <span className="block text-ink-soft/70">
                      {item.saleUnit === 'KILOGRAM' ? `${item.quantity} kg` : `${item.quantity} u.`}
                    </span>
                  </span>
                  <span>{formatMoneyRange(range.min, range.max)}</span>
                </div>
                <WeightPriceNotice product={item} quantity={item.quantity} />
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex justify-between border-t border-line pt-4">
          <span>Estimado</span>
          <span className="font-display text-3xl">{formatMoneyRange(estimatedTotalMin, estimatedTotalMax)}</span>
        </div>
        {hasWeightItems ? (
          <p className="mt-3 text-sm font-medium text-warn">
            Al confirmar el pedido el importe todavía no es definitivo. El precio final depende del peso real.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
