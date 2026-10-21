import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { storeApi } from '../../api/services';
import { StoreOrderTracking } from '../../components/store-order-tracking';
import { Button, Field, Input, Skeleton } from '../../components/ui';
import { WhatsAppIcon } from '../../components/whatsapp-button';
import type { StoreCheckoutConfirmation } from '../../types/api';
import { parseTrackingOrderCode } from '../../utils/tracking-order-code';

const CHECKOUT_CONFIRMATION_KEY = 'kitikitikiti.checkoutConfirmation';

type TrackingLocationState = {
  phone?: string;
  confirmation?: StoreCheckoutConfirmation;
};

function readStoredConfirmation(orderId: string): StoreCheckoutConfirmation | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_CONFIRMATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoreCheckoutConfirmation & { orderId?: string };
    if (parsed.orderId && parsed.orderId !== orderId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function OrderTrackingPage({ confirmation = false }: { confirmation?: boolean }) {
  const { id = '' } = useParams();
  const location = useLocation();
  const locationState = location.state as TrackingLocationState | null;
  const [phone, setPhone] = useState(
    locationState?.phone ?? sessionStorage.getItem('kitikitikiti.lastPhone') ?? '',
  );
  const [submittedPhone, setSubmittedPhone] = useState(confirmation ? phone : '');
  const [whatsAppBlocked, setWhatsAppBlocked] = useState(false);
  const checkoutConfirmation = locationState?.confirmation ?? readStoredConfirmation(id);

  const order = useQuery({
    queryKey: ['track', id, submittedPhone],
    queryFn: () => storeApi.track(id, submittedPhone),
    enabled: Boolean(id && submittedPhone),
  });

  const pendingWhatsApp =
    confirmation &&
    (order.data?.status === 'PENDIENTE_WHATSAPP' || (!order.data && Boolean(checkoutConfirmation)));

  useEffect(() => {
    if (!confirmation || !checkoutConfirmation?.whatsappUrl) return;
    const key = `kitikitikiti.waOpened.${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const opened = window.open(checkoutConfirmation.whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!opened) setWhatsAppBlocked(true);
  }, [checkoutConfirmation, confirmation, id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-blood">
        {pendingWhatsApp ? 'Pedido pendiente' : confirmation ? 'Pedido recibido' : 'Seguimiento'}
      </p>
      <h1 className="font-display text-4xl">
        {pendingWhatsApp
          ? 'Enviá el mensaje para confirmar'
          : confirmation
            ? 'Ya estamos con tu pedido'
            : 'Consultá tu pedido'}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {pendingWhatsApp
          ? 'Para confirmar tu pedido, se abrirá WhatsApp con el mensaje preparado. Solo tenés que enviarlo a la carnicería.'
          : 'Acá ves el estado, el código y el resumen de tu pedido.'}
      </p>

      {pendingWhatsApp ? (
        <div className="mt-6 space-y-4 rounded-3xl bg-cream p-5">
          <p className="text-sm text-ink">
            Para confirmar tu pedido, se abrirá WhatsApp con el mensaje preparado. Solo tenés que enviarlo a la carnicería.
          </p>
          {checkoutConfirmation?.whatsappUrl ? (
            <a
              href={checkoutConfirmation.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.02]"
            >
              <WhatsAppIcon className="h-6 w-6" />
              Abrir conversación
            </a>
          ) : (
            <p className="text-sm text-warn">
              No pudimos abrir la conversación porque la carnicería todavía no tiene un número configurado. Comunicate con el local para confirmar el pedido.
            </p>
          )}
          {whatsAppBlocked && checkoutConfirmation?.whatsappUrl ? (
            <p className="text-sm text-ink-soft">
              Si no se abrió la conversación, usá el botón de arriba para enviarla vos.
            </p>
          ) : null}
        </div>
      ) : null}

      <form
        className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedPhone(phone);
        }}
      >
        <Field label="Teléfono del pedido">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="1144556677" />
        </Field>
        <Button type="submit" className="min-h-12 self-end">
          Ver estado
        </Button>
      </form>

      {order.isLoading ? <Skeleton className="mt-8 h-80" /> : null}
      {order.isError ? <p className="mt-6 text-blood">{order.error.message}</p> : null}
      {order.data ? (
        <div className="mt-8">
          <StoreOrderTracking order={order.data} />
        </div>
      ) : null}
    </div>
  );
}

export function TrackSearchPage() {
  const [id, setId] = useState('');
  const [phone, setPhone] = useState('');
  const [formatError, setFormatError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ id: string; phone: string } | null>(null);
  const order = useQuery({
    queryKey: ['track-search', lookup],
    queryFn: () => storeApi.track(lookup!.id, lookup!.phone),
    enabled: Boolean(lookup),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-blood">Seguimiento</p>
      <h1 className="font-display text-4xl">¿Dónde está tu pedido?</h1>
      <p className="mt-2 text-ink-soft">
        Ingresá el número de pedido (podés pegar el texto de WhatsApp) y el teléfono con el que lo hiciste.
      </p>
      <form
        className="mt-6 space-y-4 rounded-3xl bg-cream p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const code = parseTrackingOrderCode(id);
          if (!code) {
            setLookup(null);
            setFormatError(
              'No reconocimos el número de pedido. Pegá el texto de WhatsApp o el código, por ejemplo 8BC59911.',
            );
            return;
          }
          if (!phone.trim()) {
            setLookup(null);
            setFormatError('Ingresá el teléfono con el que hiciste el pedido.');
            return;
          }
          setFormatError(null);
          setLookup({ id: code, phone: phone.trim() });
        }}
      >
        <Field label="Número de pedido">
          <Input
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setFormatError(null);
            }}
            placeholder="Pedido: #8BC59911"
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Teléfono">
          <Input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setFormatError(null);
            }}
            placeholder="1144556677"
            inputMode="tel"
          />
        </Field>
        {formatError ? <p className="text-sm text-blood">{formatError}</p> : null}
        <Button type="submit" className="min-h-12 w-full" disabled={order.isFetching}>
          {order.isFetching ? 'Consultando...' : 'Consultar'}
        </Button>
      </form>
      {lookup && order.isFetching ? <Skeleton className="mt-6 h-80" /> : null}
      {lookup && order.data && !order.isFetching ? (
        <div className="mt-8">
          <StoreOrderTracking order={order.data} />
        </div>
      ) : null}
      {lookup && order.isError && !order.isFetching ? (
        <p className="mt-4 text-blood">{order.error.message}</p>
      ) : null}
    </div>
  );
}
