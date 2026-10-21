import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { customersApi, ordersApi, productsApi } from '../../api/services';
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import type { Customer, Product } from '../../types/api';
import { estimatedLineTotals, formatMoneyRange, toDecimalString } from '../../utils/format';
import { toWhatsAppNumber } from '../../utils/whatsapp';

type DraftItem = {
  productId: string;
  name: string;
  saleUnit: Product['saleUnit'];
  salePrice: string;
  estimatedMinKg?: string | null;
  estimatedMaxKg?: string | null;
  quantity: string;
};

export function CreateOrderDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (orderId: string) => void;
}) {
  const customers = useQuery({
    queryKey: ['customers', 'order-create'],
    queryFn: () => customersApi.list({ limit: 100 }),
    enabled: open,
  });
  const products = useQuery({
    queryKey: ['products', 'order-create'],
    queryFn: () => productsApi.list({ limit: 100, status: 'active' }),
    enabled: open,
  });

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
  });
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState('');

  const selected = useMemo(
    () => products.data?.data.find((product) => product.id === productId),
    [productId, products.data],
  );

  const totals = items.reduce(
    (acc, item) => {
      const range = estimatedLineTotals({
        ...item,
        quantity: Number(item.quantity) || 0,
      });
      return { min: acc.min + range.min, max: acc.max + range.max };
    },
    { min: 0, max: 0 },
  );

  function reset() {
    setMode('existing');
    setCustomerId('');
    setNewCustomer({ firstName: '', lastName: '', phone: '', address: '' });
    setProductId('');
    setQty('1');
    setItems([]);
    setNotes('');
  }

  function addItem() {
    if (!selected) {
      toast.error('Elegí un corte');
      return;
    }
    const quantity = Number(qty.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Ingresá una cantidad válida');
      return;
    }
    if (selected.saleUnit === 'UNIT' && !Number.isInteger(quantity)) {
      toast.error('Para este corte la cantidad tiene que ser un número entero');
      return;
    }
    setItems((current) => {
      const existing = current.find((item) => item.productId === selected.id);
      if (existing) {
        return current.map((item) =>
          item.productId === selected.id
            ? { ...item, quantity: String(Number(item.quantity) + quantity) }
            : item,
        );
      }
      return [
        ...current,
        {
          productId: selected.id,
          name: selected.name,
          saleUnit: selected.saleUnit,
          salePrice: selected.salePrice,
          estimatedMinKg: selected.estimatedMinKg,
          estimatedMaxKg: selected.estimatedMaxKg,
          quantity: String(quantity),
        },
      ];
    });
    setQty('1');
  }

  const create = useMutation({
    mutationFn: async () => {
      if (items.length === 0) {
        throw new Error('Agregá al menos un corte');
      }
      let resolvedCustomerId = customerId;
      if (mode === 'new') {
        if (newCustomer.firstName.trim().length < 2 || newCustomer.lastName.trim().length < 2) {
          throw new Error('Completá el nombre y el apellido del cliente');
        }
        if (!toWhatsAppNumber(newCustomer.phone)) {
          throw new Error('Ingresá un WhatsApp válido, por ejemplo +54 9 3493 123456');
        }
        if (newCustomer.address.trim().length < 5) {
          throw new Error('Ingresá la dirección del cliente');
        }
        const customer = await customersApi.create({
          firstName: newCustomer.firstName.trim(),
          lastName: newCustomer.lastName.trim(),
          phone: newCustomer.phone.trim(),
          address: newCustomer.address.trim(),
        });
        resolvedCustomerId = customer.id;
      }
      if (!resolvedCustomerId) {
        throw new Error('Elegí un cliente o cargá uno nuevo');
      }
      return ordersApi.create({
        customerId: resolvedCustomerId,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: toDecimalString(Number(item.quantity)),
          requestedKg: item.saleUnit === 'KILOGRAM' ? toDecimalString(Number(item.quantity)) : undefined,
        })),
      });
    },
    onSuccess: (order) => {
      toast.success(`Pedido #${order.trackingCode ?? order.id.slice(0, 8)} registrado`);
      reset();
      onCreated(order.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Modal
      open={open}
      size="xl"
      title="Nuevo pedido"
      description="Pedido tomado por teléfono, WhatsApp o en el local. No usa el límite de la web ni abre WhatsApp."
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <div className="space-y-5">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'existing' ? 'secondary' : 'ghost'}
            onClick={() => setMode('existing')}
          >
            Cliente existente
          </Button>
          <Button
            type="button"
            variant={mode === 'new' ? 'secondary' : 'ghost'}
            onClick={() => setMode('new')}
          >
            Cliente nuevo
          </Button>
        </div>

        {mode === 'existing' ? (
          <Field label="Cliente">
            <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Elegí un cliente</option>
              {(customers.data?.data ?? []).map((customer: Customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.lastName}, {customer.firstName} · {customer.phone}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <Input
                value={newCustomer.firstName}
                onChange={(event) =>
                  setNewCustomer((current) => ({ ...current, firstName: event.target.value }))
                }
              />
            </Field>
            <Field label="Apellido">
              <Input
                value={newCustomer.lastName}
                onChange={(event) =>
                  setNewCustomer((current) => ({ ...current, lastName: event.target.value }))
                }
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={newCustomer.phone}
                inputMode="tel"
                onChange={(event) =>
                  setNewCustomer((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={newCustomer.address}
                onChange={(event) =>
                  setNewCustomer((current) => ({ ...current, address: event.target.value }))
                }
              />
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <Field label="Corte">
            <Select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Elegí un corte</option>
              {(products.data?.data ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={selected?.saleUnit === 'KILOGRAM' ? 'Kilos' : 'Unidades'}>
            <Input value={qty} inputMode="decimal" onChange={(event) => setQty(event.target.value)} />
          </Field>
          <Button type="button" className="self-end" onClick={addItem}>
            Agregar
          </Button>
        </div>

        {items.length > 0 ? (
          <ul className="space-y-2 rounded-2xl bg-paper p-3 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex items-center justify-between gap-3">
                <span>
                  {item.name}
                  <span className="block text-ink-soft">
                    {item.saleUnit === 'KILOGRAM' ? `${item.quantity} kg` : `${item.quantity} u.`}
                  </span>
                </span>
                <button
                  type="button"
                  className="text-blood"
                  onClick={() =>
                    setItems((current) => current.filter((row) => row.productId !== item.productId))
                  }
                >
                  Quitar
                </button>
              </li>
            ))}
            <li className="flex justify-between border-t border-line pt-2 font-semibold">
              <span>Estimado</span>
              <span>{formatMoneyRange(totals.min, totals.max)}</span>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Todavía no hay cortes en este pedido.</p>
        )}

        <Field label="Notas">
          <Textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Tomado por teléfono, indicaciones de entrega..."
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Registrando...' : 'Crear pedido'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
