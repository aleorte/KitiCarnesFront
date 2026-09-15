import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { customersApi, productsApi, salesApi } from '../../api/services';
import { Button, Field, Input, Modal, PageHeader, Select, Skeleton } from '../../components/ui';
import { PAYMENT_STATUS_LABEL } from '../../types/api';
import { formatDateTime, formatMoney, toDecimalString } from '../../utils/format';

export function SalesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const sales = useQuery({
    queryKey: ['sales', from, to],
    queryFn: () => salesApi.list({ limit: 50, from: from || undefined, to: to || undefined }),
  });
  const products = useQuery({ queryKey: ['sale-products'], queryFn: () => productsApi.list({ limit: 100 }), enabled: open });
  const customers = useQuery({ queryKey: ['sale-customers'], queryFn: () => customersApi.list({ limit: 100 }), enabled: open });
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [customerId, setCustomerId] = useState('');

  const selected = useMemo(
    () => products.data?.data.find((product) => product.id === productId),
    [productId, products.data],
  );

  const create = useMutation({
    mutationFn: () => salesApi.create({
      customerId: customerId || undefined,
      items: [{
        productId,
        quantity: toDecimalString(Number(qty)),
        kg: selected?.saleUnit === 'KILOGRAM' ? toDecimalString(Number(qty)) : undefined,
      }],
    }),
    onSuccess: () => { toast.success('Venta registrada'); queryClient.invalidateQueries({ queryKey: ['sales'] }); setOpen(false); },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader title="Ventas" description="Mostrador independiente o asociado a un pedido ya entregado." actions={<Button onClick={() => setOpen(true)}>Nueva venta</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Field label="Desde"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {sales.isLoading ? <Skeleton className="h-72" /> : (
        <div className="space-y-3">
          {sales.data?.data.map((sale) => (
            <article key={sale.id} className="rounded-3xl bg-cream p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Mostrador'}</p>
                  <p className="text-sm text-ink-soft">{formatDateTime(sale.soldAt)} · {PAYMENT_STATUS_LABEL[sale.paymentStatus]}</p>
                </div>
                <p className="font-display text-2xl">{formatMoney(sale.total)}</p>
              </div>
            </article>
          ))}
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
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Elegir</option>
              {products.data?.data.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={selected?.saleUnit === 'KILOGRAM' ? 'Kilos' : 'Cantidad'}>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Button className="w-full" disabled={!productId || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Guardando...' : 'Guardar venta'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
