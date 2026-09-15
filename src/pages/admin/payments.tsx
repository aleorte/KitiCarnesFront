import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ordersApi, paymentsApi, salesApi } from '../../api/services';
import { Button, Field, Input, Modal, PageHeader, Select, Skeleton } from '../../components/ui';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '../../types/api';
import { formatDateTime, formatMoney } from '../../utils/format';

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const payments = useQuery({
    queryKey: ['payments', method, from, to],
    queryFn: () => paymentsApi.list({
      method: method || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: 50,
    }),
  });
  const pendingOrders = useQuery({ queryKey: ['unpaid-orders'], queryFn: () => ordersApi.list({ paymentStatus: 'SIN_PAGAR', limit: 20 }), enabled: open });
  const pendingSales = useQuery({ queryKey: ['unpaid-sales'], queryFn: () => salesApi.list({ paymentStatus: 'SIN_PAGAR', limit: 20 }), enabled: open });
  const [form, setForm] = useState({ amount: '', method: 'EFECTIVO' as PaymentMethod, orderId: '', saleId: '' });
  const create = useMutation({
    mutationFn: () => paymentsApi.create({
      amount: form.amount,
      method: form.method,
      orderId: form.orderId || undefined,
      saleId: form.saleId || undefined,
    }),
    onSuccess: () => { toast.success('Pago registrado'); queryClient.invalidateQueries({ queryKey: ['payments'] }); setOpen(false); },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader title="Pagos" actions={<Button onClick={() => setOpen(true)}>Registrar pago</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Todos los métodos</option>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {payments.isLoading ? <Skeleton className="h-72" /> : (
        <div className="space-y-3">
          {payments.data?.data.map((payment) => (
            <article key={payment.id} className="flex items-center justify-between rounded-3xl bg-cream p-4">
              <div>
                <p className="font-semibold">{PAYMENT_METHOD_LABEL[payment.method]}</p>
                <p className="text-sm text-ink-soft">{formatDateTime(payment.paidAt)}</p>
              </div>
              <p className="font-display text-2xl">{formatMoney(payment.amount)}</p>
            </article>
          ))}
        </div>
      )}
      <Modal open={open} title="Nuevo pago" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Importe"><Input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Método">
            <Select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Pedido">
            <Select value={form.orderId} onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value, saleId: '' }))}>
              <option value="">Ninguno</option>
              {pendingOrders.data?.data.map((order) => (
                <option key={order.id} value={order.id}>{order.customer?.lastName} · {formatMoney(order.estimatedTotal)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Venta">
            <Select value={form.saleId} onChange={(e) => setForm((f) => ({ ...f, saleId: e.target.value, orderId: '' }))}>
              <option value="">Ninguna</option>
              {pendingSales.data?.data.map((sale) => (
                <option key={sale.id} value={sale.id}>{formatMoney(sale.total)}</option>
              ))}
            </Select>
          </Field>
          <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
