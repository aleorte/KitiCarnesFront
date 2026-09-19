import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../../api/client';
import { storeApi } from '../../api/services';
import { WeightPriceNotice } from '../../components/commerce';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { WhatsAppButton } from '../../components/whatsapp-button';
import { useCart } from '../../hooks/use-cart';
import type { StoreCheckoutConfirmation } from '../../types/api';
import { estimatedLineTotals, formatMoneyRange, toDecimalString } from '../../utils/format';
import { STORE_EXTRA_ORDER_WHATSAPP_MESSAGE, toWhatsAppNumber } from '../../utils/whatsapp';

const CHECKOUT_CONFIRMATION_KEY = 'kitikitikiti.checkoutConfirmation';

const schema = z.object({
  firstName: z.string().min(2, 'Ingresá el nombre'),
  lastName: z.string().min(2, 'Ingresá el apellido'),
  phone: z
    .string()
    .min(8, 'Ingresá un teléfono')
    .refine((value) => Boolean(toWhatsAppNumber(value)), {
      message: 'Ingresá un WhatsApp válido, por ejemplo +54 9 3493 123456',
    }),
  address: z.string().min(5, 'Ingresá la dirección'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function persistConfirmation(orderId: string, confirmation: StoreCheckoutConfirmation) {
  sessionStorage.setItem(
    CHECKOUT_CONFIRMATION_KEY,
    JSON.stringify({ orderId, ...confirmation }),
  );
}

export function CheckoutPage() {
  const { items, estimatedTotalMin, estimatedTotalMax, hasWeightItems, clear } = useCart();
  const navigate = useNavigate();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const whatsappTabRef = useRef<Window | null>(null);
  const submitLockRef = useRef(false);
  const catalog = useQuery({
    queryKey: ['store-products', '', ''],
    queryFn: () => storeApi.products(),
    enabled: items.length > 0,
  });
  const contact = useQuery({
    queryKey: ['store-contact'],
    queryFn: storeApi.contact,
    staleTime: 5 * 60 * 1000,
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
      persistConfirmation(order.id, order.confirmation);
      sessionStorage.setItem('kitikitikiti.lastPhone', phone);
      const url = order.confirmation.whatsappUrl;
      const tab = whatsappTabRef.current;
      const openedKey = `kitikitikiti.waOpened.${order.id}`;
      if (url && tab && !tab.closed) {
        tab.location.href = url;
        sessionStorage.setItem(openedKey, '1');
      } else if (url) {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (opened) sessionStorage.setItem(openedKey, '1');
      } else {
        tab?.close();
      }
      whatsappTabRef.current = null;
      navigate(`/pedido/${order.id}`, {
        state: { phone, confirmation: order.confirmation },
      });
      clear();
    },
    onError: () => {
      submitLockRef.current = false;
      whatsappTabRef.current?.close();
      whatsappTabRef.current = null;
    },
  });

  useEffect(() => {
    if (!items.length && !mutation.isPending && !mutation.isSuccess) {
      navigate('/carrito', { replace: true });
    }
  }, [items.length, mutation.isPending, mutation.isSuccess, navigate]);

  if (!items.length) return null;

  const limitError =
    mutation.error instanceof ApiError && mutation.error.status === 429
      ? mutation.error
      : null;
  const submitting = mutation.isPending;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          if (submitting || submitLockRef.current) return;
          submitLockRef.current = true;
          whatsappTabRef.current = window.open('about:blank', '_blank');
          mutation.mutate(values);
        })}
      >
        <h1 className="font-display text-4xl">Confirmar pedido</h1>
        <p className="text-sm text-ink-soft">
          Para confirmar tu pedido, se abrirá WhatsApp con el mensaje preparado. Solo tenés que enviarlo a la carnicería.
        </p>
        <Field label="Nombre" error={form.formState.errors.firstName?.message}>
          <Input {...form.register('firstName')} autoComplete="given-name" />
        </Field>
        <Field label="Apellido" error={form.formState.errors.lastName?.message}>
          <Input {...form.register('lastName')} autoComplete="family-name" />
        </Field>
        <Field label="Teléfono" error={form.formState.errors.phone?.message}>
          <Input {...form.register('phone')} autoComplete="tel" inputMode="tel" />
        </Field>
        <Field label="Dirección" error={form.formState.errors.address?.message}>
          <Input {...form.register('address')} autoComplete="street-address" />
        </Field>
        <Field label="Indicaciones">
          <Textarea rows={4} {...form.register('notes')} placeholder="Timbre, referencias, punto de entrega..." />
        </Field>
        {unavailable.length > 0 ? (
          <p className="text-sm text-blood">
            {unavailable.map((item) => item.name).join(', ')} ya no está disponible. Volvé al carrito y quitalo antes de confirmar.
          </p>
        ) : null}
        {limitError ? (
          <div className="flex items-start gap-3 rounded-2xl bg-cream p-4 text-sm text-ink">
            <p className="flex-1">{limitError.message}</p>
            <WhatsAppButton
              iconOnly
              phone={contact.data?.whatsappPhone}
              message={STORE_EXTRA_ORDER_WHATSAPP_MESSAGE}
              missingLabel="La carnicería todavía no tiene un número de contacto configurado."
            />
          </div>
        ) : mutation.isError ? (
          <p className="text-sm text-blood">{mutation.error?.message}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting || unavailable.length > 0}>
          {submitting ? 'Preparando tu pedido...' : 'Confirmar pedido'}
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
            Al confirmar el pedido el importe todavía no es definitivo. El precio final de los cortes de peso variable se calcula al entregar.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
