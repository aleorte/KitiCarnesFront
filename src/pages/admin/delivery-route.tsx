import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink, MapPinned, Navigation } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { customersApi, deliveryRouteApi, ordersApi, paymentsApi } from '../../api/services';
import { WhatsAppButton } from '../../components/whatsapp-button';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type DeliveryRouteStop,
  type PaymentMethod,
} from '../../types/api';
import { formatDateSlash, formatMoney, formatQty, orderPublicCode } from '../../utils/format';
import { buildDeliveryWhatsAppMessage } from '../../utils/order-whatsapp';
import { DeliveryMap, type MapGroup } from './delivery-map';

function mapsSearchUrl(address: string, locality: string, region: string, country: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${address}, ${locality}, ${region}, ${country}`,
  )}`;
}

function mapsDirUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function locationKey(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function StopDetails({
  stop,
  locality,
  region,
  country,
}: {
  stop: DeliveryRouteStop;
  locality: string;
  region: string;
  country: string;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-display text-xl leading-tight">{stop.customerName}</p>
        <p className="mt-1 break-words text-ink-soft">{stop.address}</p>
        {stop.phone ? <p className="mt-1 text-ink-soft">{stop.phone}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {stop.lat != null && stop.lng != null ? (
          <a
            href={mapsDirUrl(Number(stop.lat), Number(stop.lng))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-cream"
          >
            <Navigation className="h-4 w-4" />
            Cómo llegar
          </a>
        ) : (
          <a
            href={mapsSearchUrl(stop.address, locality, region, country)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-cream"
          >
            <ExternalLink className="h-4 w-4" />
            Buscar en Maps
          </a>
        )}
        {stop.phone ? (
          <WhatsAppButton
            phone={stop.phone}
            message={buildDeliveryWhatsAppMessage(stop.customerName, stop.orders)}
            label="Avisar entrega"
          />
        ) : null}
      </div>
      {stop.orders.map((order) => (
        <div key={order.id} className="rounded-2xl bg-paper px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Pedido #{orderPublicCode(order)} · {ORDER_STATUS_LABEL[order.status]}
            </p>
            <Link
              to={`/admin/pedidos/${order.id}`}
              className="text-sm font-semibold text-blood"
            >
              Ver pedido
            </Link>
          </div>
          <ul className="mt-2 space-y-1">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{item.productName}</span>
                <span className="shrink-0 font-semibold">{formatQty(item.quantity, item.saleUnit)}</span>
              </li>
            ))}
          </ul>
          {order.notes ? <p className="mt-2 text-ink-soft">{order.notes}</p> : null}
        </div>
      ))}
    </div>
  );
}

function DeliveryOrderCard({
  stop,
  order,
  canManage,
  delivering,
  onDeliver,
  onPay,
}: {
  stop: DeliveryRouteStop;
  order: DeliveryRouteStop['orders'][number];
  canManage: boolean;
  delivering: boolean;
  onDeliver: () => void;
  onPay: () => void;
}) {
  const delivered = order.status === 'ENTREGADO';
  const paid = order.paymentStatus === 'PAGADO';
  const ready = order.status === 'LISTO' || order.status === 'EN_ENTREGA';
  return (
    <article className={`rounded-3xl p-4 ${delivered ? 'bg-paper' : 'bg-cream'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight">{stop.customerName}</p>
          <p className="mt-1 text-sm text-ink-soft">{stop.phone}</p>
          <p className="text-sm text-ink-soft">{stop.address}</p>
          <p className="mt-2 text-xs text-ink-soft">
            Pedido #{orderPublicCode(order)} · {ORDER_STATUS_LABEL[order.status]}
            {order.paymentStatus ? ` · ${PAYMENT_STATUS_LABEL[order.paymentStatus]}` : ''}
            {stop.geoStatus !== 'LOCATED' ? ' · Sin localizar' : ''}
          </p>
        </div>
        <p className="font-display text-2xl">{formatMoney(order.finalTotal ?? 0)}</p>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="min-w-0 break-words">
              {item.productName}
              {item.unavailableReason ? ` · falta (${item.unavailableReason})` : ''}
            </span>
            <span className="shrink-0 font-semibold">
              {formatQty(item.actualQuantity ?? item.quantity, item.saleUnit)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {stop.phone ? (
          <WhatsAppButton
            className="min-h-11 justify-center rounded-2xl bg-paper px-4"
            phone={stop.phone}
            message={buildDeliveryWhatsAppMessage(stop.customerName, [order])}
            label="Avisar por WhatsApp"
          />
        ) : null}
        {canManage && ready ? (
          <Button className="min-h-11" disabled={delivering} onClick={onDeliver}>
            {delivering ? 'Registrando...' : 'Marcar como entregado'}
          </Button>
        ) : null}
        {canManage && delivered && !paid ? (
          <Button className="min-h-11" variant="secondary" onClick={onPay}>
            Registrar pago
          </Button>
        ) : null}
        {paid ? <p className="self-center text-sm font-semibold text-ok">Pagado</p> : null}
      </div>
    </article>
  );
}

export function DeliveryRoutePage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManageCustomers = hasPermission('customers:manage');
  const canManageOrders = hasPermission('orders:manage');
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined);
  const [listFilter, setListFilter] = useState<'pending' | 'delivered'>('pending');
  const [delivering, setDelivering] = useState<string | null>(null);
  const [paying, setPaying] = useState<{ orderId: string; amount: string } | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('EFECTIVO');
  const [orderMode, setOrderMode] = useState<'name' | 'nearby'>('name');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<DeliveryRouteStop | null>(null);
  const [addressDraft, setAddressDraft] = useState('');

  const route = useQuery({
    queryKey: ['delivery-route', weekStart],
    queryFn: () => deliveryRouteApi.week(weekStart),
    placeholderData: keepPreviousData,
  });

  const data = route.data;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['delivery-route'] });
    void queryClient.invalidateQueries({ queryKey: ['customers'] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['payments'] });
  };

  const deliver = useMutation({
    mutationFn: (orderId: string) => ordersApi.updateStatus(orderId, 'ENTREGADO'),
    onSuccess: () => {
      toast.success('Pedido entregado');
      setDelivering(null);
      refresh();
    },
    onError: (error: Error) => {
      const status = error instanceof ApiError ? error.status : undefined;
      console.warn('No se pudo marcar el pedido como entregado', {
        status,
        message: error.message,
      });
      toast.error(error.message || 'No se pudo marcar el pedido como entregado');
    },
  });

  const pay = useMutation({
    mutationFn: () => {
      if (!paying) throw new Error('Pedido inválido');
      return paymentsApi.create({
        orderId: paying.orderId,
        amount: paying.amount,
        method: payMethod,
      });
    },
    onSuccess: () => {
      toast.success('Pago registrado');
      setPaying(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const numberedStops = useMemo(() => {
    if (!data) return [];
    if (orderMode === 'nearby' && data.proximityOrder.length) {
      const rank = new Map(data.proximityOrder.map((id, index) => [id, index]));
      return [...data.stops].sort(
        (left, right) => (rank.get(left.customerId) ?? 999) - (rank.get(right.customerId) ?? 999),
      );
    }
    return data.stops;
  }, [data, orderMode]);

  const groups = useMemo<MapGroup[]>(() => {
    const buckets = new Map<string, MapGroup>();
    numberedStops.forEach((stop, index) => {
      const lat = Number(stop.lat);
      const lng = Number(stop.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const key = locationKey(lat, lng);
      const existing = buckets.get(key);
      if (existing) {
        existing.stops.push(stop);
        existing.pending = existing.pending || stop.pending;
        return;
      }
      buckets.set(key, {
        key,
        lat,
        lng,
        pending: stop.pending,
        number: index + 1,
        stops: [stop],
      });
    });
    return [...buckets.values()];
  }, [numberedStops]);

  const selectedGroup = groups.find((group) => group.key === selectedKey) ?? null;

  const geocode = useMutation({
    mutationFn: (customerId: string) => deliveryRouteApi.geocode(customerId),
    onSuccess: () => {
      toast.success('Se volvió a buscar la dirección');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveAddress = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('Cliente inválido');
      const next = addressDraft.trim();
      if (next.length < 5) throw new Error('Ingresá una dirección más completa');
      await customersApi.update(editing.customerId, { address: next });
      return deliveryRouteApi.geocode(editing.customerId);
    },
    onSuccess: () => {
      toast.success('Dirección actualizada');
      setEditing(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (route.isError) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Recorrido" description="No se pudo cargar el mapa de entregas." />
        <EmptyState
          title="No se pudo cargar el recorrido"
          description={route.error instanceof Error ? route.error.message : 'Reintentá en unos segundos.'}
        />
        <Button className="mt-4" onClick={() => void route.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (route.isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  const area = data.area;
  const allStops = [...data.stops, ...data.unlocated];
  const allOrders = allStops.flatMap((stop) => stop.orders.map((order) => ({ stop, order })));
  const pendingOrders = allOrders.filter(
    (row) => row.order.status === 'LISTO' || row.order.status === 'EN_ENTREGA',
  );
  const deliveredOrders = allOrders.filter((row) => row.order.status === 'ENTREGADO');
  const listed = listFilter === 'pending' ? pendingOrders : deliveredOrders;

  return (
    <div className="mx-auto min-w-0 max-w-7xl">
      <PageHeader
        eyebrow={data.shortLabel}
        title="Recorrido"
        description={`Pedidos preparados del ciclo ${formatDateSlash(data.weekStart, false)} → ${formatDateSlash(data.weekEnd, false)}. El listado incluye también las direcciones sin localizar.`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setWeekStart(data.previousWeekStart)}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button variant="primary" onClick={() => setWeekStart(undefined)}>
            Semana actual
          </Button>
          <Button variant="secondary" onClick={() => setWeekStart(data.nextWeekStart)}>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="rounded-3xl bg-cream p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Pendientes</p>
          <p className="mt-1 font-display text-3xl">{data.summary.pending}</p>
        </article>
        <article className="rounded-3xl bg-cream p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Entregadas</p>
          <p className="mt-1 font-display text-3xl">{data.summary.delivered}</p>
        </article>
        <article className="rounded-3xl bg-cream p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Sin localizar</p>
          <p className="mt-1 font-display text-3xl">{data.summary.unlocated}</p>
        </article>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={orderMode === 'name' ? 'secondary' : 'ghost'}
          className="min-h-11"
          onClick={() => setOrderMode('name')}
        >
          Orden alfabético
        </Button>
        <Button
          type="button"
          variant={orderMode === 'nearby' ? 'secondary' : 'ghost'}
          className="min-h-11"
          onClick={() => setOrderMode('nearby')}
        >
          Orden por cercanía
        </Button>
      </div>
      {orderMode === 'nearby' ? (
        <p className="mt-2 text-sm text-ink-soft">
          El orden por cercanía usa distancia en línea recta desde {area.locality}. No es una ruta de manejo ni un
          tiempo estimado.
        </p>
      ) : null}

      <section className="mt-4 min-w-0">
        {data.stops.length ? (
          <DeliveryMap
            center={area.center}
            groups={groups}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
          />
        ) : (
          <div className="flex h-[40vh] min-h-[220px] flex-col items-center justify-center rounded-3xl bg-cream px-4 text-center">
            <MapPinned className="h-8 w-8 text-ink-soft" />
            <p className="mt-3 font-display text-2xl">Sin puntos en el mapa</p>
            <p className="mt-1 max-w-md text-sm text-ink-soft">
              Esta semana no hay direcciones localizadas. Revisá el listado de abajo o esperá a que haya pedidos para
              entregar.
            </p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blood" /> Pendiente
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-forest" /> Entregado
          </span>
        </div>
      </section>

      {selectedGroup ? (
        <section className="mt-4 space-y-3 rounded-3xl bg-cream p-4">
          {selectedGroup.stops.length > 1 ? (
            <p className="text-sm text-ink-soft">
              {selectedGroup.stops.length} clientes en la misma dirección.
            </p>
          ) : null}
          {selectedGroup.stops.map((stop) => (
            <StopDetails
              key={stop.customerId}
              stop={stop}
              locality={area.locality}
              region={area.region}
              country={area.country}
            />
          ))}
        </section>
      ) : data.stops.length ? (
        <p className="mt-3 text-sm text-ink-soft">Tocá un punto del mapa para ver el cliente y su pedido.</p>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl">Pedidos del recorrido</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Todos los pedidos preparados de este ciclo, estén o no en el mapa.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1">
            <button
              type="button"
              onClick={() => setListFilter('pending')}
              className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${
                listFilter === 'pending' ? 'bg-ink text-cream' : 'text-ink'
              }`}
            >
              Pendientes ({pendingOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setListFilter('delivered')}
              className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${
                listFilter === 'delivered' ? 'bg-ink text-cream' : 'text-ink'
              }`}
            >
              Entregados ({deliveredOrders.length})
            </button>
          </div>
        </div>
        {listed.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-cream px-4 py-5 text-sm text-ink-soft">
            {listFilter === 'pending'
              ? 'No hay pedidos preparados pendientes de entrega en este ciclo.'
              : 'Todavía no hay entregas registradas en este ciclo.'}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {listed.map(({ stop, order }) => (
              <DeliveryOrderCard
                key={order.id}
                stop={stop}
                order={order}
                canManage={canManageOrders}
                delivering={deliver.isPending && delivering === order.id}
                onDeliver={() => setDelivering(order.id)}
                onPay={() =>
                  setPaying({
                    orderId: order.id,
                    amount: String(order.finalTotal ?? ''),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Direcciones sin localizar</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Estos pedidos siguen en el recorrido, pero no se les asignó un punto en el mapa para no enviar el reparto a
          una ubicación inventada.
        </p>
        {data.unlocated.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-cream px-4 py-5 text-sm text-ink-soft">
            Todas las direcciones de esta semana se pudieron localizar.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.unlocated.map((stop) => (
              <article key={stop.customerId} className="rounded-3xl bg-cream p-4">
                <StopDetails
                  stop={stop}
                  locality={area.locality}
                  region={area.region}
                  country={area.country}
                />
                {stop.geoFailureReason ? (
                  <p className="mt-3 text-sm text-warn">{stop.geoFailureReason}</p>
                ) : (
                  <p className="mt-3 text-sm text-ink-soft">Todavía no se buscó esta dirección en el mapa.</p>
                )}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {canManageCustomers ? (
                    <Button
                      type="button"
                      className="min-h-11 w-full sm:w-auto"
                      onClick={() => {
                        setEditing(stop);
                        setAddressDraft(stop.address);
                      }}
                    >
                      Corregir dirección
                    </Button>
                  ) : null}
                  {canManageCustomers ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11 w-full sm:w-auto"
                      disabled={geocode.isPending}
                      onClick={() => geocode.mutate(stop.customerId)}
                    >
                      Volver a localizar
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(editing)}
        title="Corregir dirección"
        description="Se conserva el texto que cargues. Después se vuelve a buscar en el mapa, sin adivinar coordenadas."
        onClose={() => setEditing(null)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={saveAddress.isPending}
              onClick={() => saveAddress.mutate()}
            >
              {saveAddress.isPending ? 'Guardando...' : 'Guardar y localizar'}
            </Button>
          </div>
        }
      >
        {editing ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold">{editing.customerName}</p>
            <Field label="Dirección">
              <Textarea
                rows={3}
                value={addressDraft}
                onChange={(event) => setAddressDraft(event.target.value)}
              />
            </Field>
            <p className="text-sm text-ink-soft">
              Si falta la localidad, el sistema completa {area.locality}, {area.region}, {area.country} al buscarla.
            </p>
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(delivering)}
        title="¿Marcar como entregado?"
        description="El pedido pasa a Entregado. Recién después se puede registrar el pago."
        confirmLabel="Marcar entregado"
        loading={deliver.isPending}
        onClose={() => {
          if (!deliver.isPending) setDelivering(null);
        }}
        onConfirm={() => {
          if (delivering && !deliver.isPending) deliver.mutate(delivering);
        }}
      />
      <Modal
        open={Boolean(paying)}
        title="Registrar pago"
        description="Se usa el módulo de pagos existente. El importe es el total final del pedido."
        onClose={() => setPaying(null)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setPaying(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pay.isPending || !paying?.amount} onClick={() => pay.mutate()}>
              {pay.isPending ? 'Registrando...' : 'Confirmar pago'}
            </Button>
          </div>
        }
      >
        {paying ? (
          <div className="space-y-3">
            <p className="text-sm">Importe: {formatMoney(paying.amount)}</p>
            <Field label="Método">
              <Select value={payMethod} onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}>
                {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
