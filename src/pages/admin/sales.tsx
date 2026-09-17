import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { customersApi, productsApi, salesApi } from '../../api/services';
import { Button, Field, Input, Modal, PageHeader, Select, Skeleton } from '../../components/ui';
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  type PaymentMethod,
  type PaymentStatus,
} from '../../types/api';
import { formatDateTime, formatMoney, formatQty, toDecimalString } from '../../utils/format';

function billedQty(unit: string, quantity: string, kg?: string | null) {
  if (unit === 'KILOGRAM' || kg) return Number(kg ?? quantity);
  return Number(quantity);
}

function todayDateInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function SalesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const sales = useQuery({
    queryKey: ['sales', from, to],
    queryFn: () => salesApi.list({ limit: 50, from: from || undefined, to: to || undefined }),
  });
  const products = useQuery({
    queryKey: ['sale-products'],
    queryFn: () => productsApi.list({ limit: 100, status: 'active' }),
    enabled: open,
  });
  const customers = useQuery({ queryKey: ['sale-customers'], queryFn: () => customersApi.list({ limit: 100 }), enabled: open });
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [kg, setKg] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PAGADO');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayDateInput);

  const selected = useMemo(
    () => products.data?.data.find((product) => product.id === productId),
    [productId, products.data],
  );
  const variable = Boolean(selected?.estimatedMinKg && selected?.estimatedMaxKg);
  const byKg = selected?.saleUnit === 'KILOGRAM' || variable;
  const billed = byKg ? Number(variable ? kg || qty : qty) : Number(qty);
  const saleTotal = selected ? billed * Number(selected.salePrice) : 0;
  const costTotal = selected?.lastKnownCost ? billed * Number(selected.lastKnownCost) : null;
  const profit = costTotal === null ? null : saleTotal - costTotal;
  const insufficient = selected ? billed > Number(selected.stock) : false;
  const paidAmount = Number(paymentAmount || saleTotal);

  const create = useMutation({
    mutationFn: () =>
      salesApi.create({
        customerId: customerId || undefined,
        items: [
          {
            productId,
            quantity: toDecimalString(Number(qty)),
            kg: byKg ? toDecimalString(Number(variable ? kg || qty : qty)) : undefined,
          },
        ],
        payment:
          paymentStatus === 'SIN_PAGAR'
            ? undefined
            : {
                method: paymentMethod,
                amount: toDecimalString(paidAmount),
                paidAt: paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : undefined,
              },
      }),
    onSuccess: () => {
      toast.success(
        paymentStatus === 'SIN_PAGAR'
          ? 'Venta registrada sin pagar. El stock ya se descontó.'
          : 'Venta registrada. El stock ya se descontó.',
      );
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock-overview'] });
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setOpen(false);
      setProductId('');
      setQty('1');
      setKg('');
      setPaymentStatus('PAGADO');
      setPaymentMethod('EFECTIVO');
      setPaymentAmount('');
      setPaidAt(todayDateInput());
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader
        title="Ventas"
        description="Mostrador independiente. Usa los mismos métodos de pago que los pedidos y el mismo stock."
        actions={<Button onClick={() => setOpen(true)}>Nueva venta</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Field label="Desde"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {sales.isLoading ? <Skeleton className="h-72" /> : (
        <div className="space-y-3">
          {sales.data?.data.map((sale) => {
            const cost = sale.items.reduce((acc, item) => {
              if (!item.unitCost) return acc;
              return acc + Number(item.unitCost) * billedQty(item.saleUnit, item.quantity, item.kg);
            }, 0);
            const hasCost = sale.items.every((item) => item.unitCost);
            const methods = [...new Set((sale.payments ?? []).map((payment) => PAYMENT_METHOD_LABEL[payment.method]))];
            return (
              <article key={sale.id} className="rounded-3xl bg-cream p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Mostrador'}</p>
                    <p className="text-sm text-ink-soft">
                      {formatDateTime(sale.soldAt)} · {PAYMENT_STATUS_LABEL[sale.paymentStatus]}
                      {methods.length ? ` · ${methods.join(', ')}` : ''}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                      {sale.items.map((item) => (
                        <li key={item.id}>
                          {item.productName} · {formatQty(item.kg ?? item.quantity, item.saleUnit === 'KILOGRAM' || item.kg ? 'KILOGRAM' : item.saleUnit)}
                          {' · venta '}
                          {formatMoney(item.unitPrice)}
                          {item.unitCost ? ` · costo ${formatMoney(item.unitCost)}` : ' · sin costo'}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl">{formatMoney(sale.total)}</p>
                    <p className="text-sm text-ink-soft">Costo {hasCost ? formatMoney(cost) : '—'}</p>
                    <p className="text-sm">{hasCost ? `Ganancia ${formatMoney(Number(sale.total) - cost)}` : 'Sin costo de compra'}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Modal open={open} title="Registrar venta" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Cliente opcional">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Sin cliente</option>
              {customers.data?.data.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Producto">
            <Select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setKg('');
              }}
            >
              <option value="">Elegir</option>
              {products.data?.data.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · stock {product.stock}
                </option>
              ))}
            </Select>
          </Field>
          {selected ? (
            <div className="rounded-2xl bg-paper p-3 text-sm">
              <p>Precio de venta: {formatMoney(selected.salePrice)} {byKg ? '/ kg' : '/ u.'}</p>
              <p>Costo de compra: {selected.lastKnownCost ? `${formatMoney(selected.lastKnownCost)}${byKg ? ' / kg' : ' / u.'}` : 'todavía no hay compra registrada'}</p>
              <p>Stock disponible: {formatQty(selected.stock, byKg ? 'KILOGRAM' : selected.saleUnit)}</p>
            </div>
          ) : null}
          <Field label={selected?.saleUnit === 'KILOGRAM' ? 'Kilos' : 'Cantidad'}>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          {variable ? (
            <Field label="Peso real (kg)">
              <Input value={kg} onChange={(e) => setKg(e.target.value)} placeholder="Obligatorio para cobrar" />
            </Field>
          ) : null}
          {selected ? (
            <div className="rounded-2xl bg-paper p-3 text-sm">
              <p>Venta {formatMoney(saleTotal)}</p>
              <p>Costo {costTotal === null ? '—' : formatMoney(costTotal)}</p>
              <p>Ganancia {profit === null ? '—' : formatMoney(profit)}</p>
            </div>
          ) : null}
          <Field label="Estado de pago">
            <Select
              value={paymentStatus}
              onChange={(e) => {
                const next = e.target.value as PaymentStatus;
                setPaymentStatus(next);
                if (next === 'PAGADO' && selected) {
                  setPaymentAmount(toDecimalString(saleTotal));
                }
              }}
            >
              {Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          {paymentStatus !== 'SIN_PAGAR' ? (
            <>
              <Field label="Método de pago">
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Monto pagado">
                <Input
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={saleTotal ? String(saleTotal) : 'Total de la venta'}
                />
              </Field>
              <Field label="Fecha de pago">
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </Field>
            </>
          ) : null}
          {insufficient ? (
            <p className="text-sm text-blood">No hay stock suficiente para completar esta venta.</p>
          ) : null}
          <Button
            className="w-full"
            disabled={!productId || create.isPending || insufficient || (variable && !kg) || (paymentStatus === 'PAGO_PARCIAL' && !paymentAmount)}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Guardando...' : 'Guardar venta'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
