import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { productsApi, purchasesApi, suppliersApi } from '../../api/services';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import {
  PAYMENT_METHOD_LABEL,
  PURCHASE_PAY_STATUS_LABEL,
  type PaymentMethod,
  type Purchase,
  type PurchaseDocument,
  type PurchasePayStatus,
} from '../../types/api';
import { dateOnly, formatDate, formatMoney, formatQty } from '../../utils/format';

type DraftItem = {
  key: string;
  mode: 'catalog' | 'custom';
  productId: string;
  productName: string;
  unitLabel: string;
  quantity: string;
  unitCost: string;
  applyToStock: boolean;
  notes: string;
};

function emptyItem(): DraftItem {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mode: 'catalog',
    productId: '',
    productName: '',
    unitLabel: 'kg',
    quantity: '',
    unitCost: '',
    applyToStock: false,
    notes: '',
  };
}

function payTone(status: PurchasePayStatus) {
  if (status === 'PAGADO') return 'ok' as const;
  if (status === 'PARCIAL') return 'gold' as const;
  return 'warn' as const;
}

function formatPurchaseQty(quantity: string, unitLabel: string, saleUnit?: string | null) {
  if (saleUnit === 'KILOGRAM' || unitLabel === 'kg') return formatQty(quantity, 'KILOGRAM');
  if (saleUnit === 'UNIT' || unitLabel === 'u.') return formatQty(quantity, 'UNIT');
  return `${quantity} ${unitLabel}`;
}

function lineTotal(quantity: string, unitCost: string) {
  const qty = Number(quantity.replace(',', '.'));
  const cost = Number(unitCost.replace(',', '.'));
  if (!Number.isFinite(qty) || !Number.isFinite(cost)) return 0;
  return qty * cost;
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function businessWeekRange(today = dateOnly()) {
  const [year, month, day] = today.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const from = addDays(today, -((utc.getUTCDay() + 3) % 7));
  return { from, to: addDays(from, 6) };
}

function monthRange(today = new Date()) {
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from, to: dateOnly(last) };
}

export function PurchasesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('purchases:manage');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [hasPending, setHasPending] = useState(false);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [paying, setPaying] = useState<Purchase | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Purchase | null>(null);
  const [preview, setPreview] = useState<{ purchaseId: string; doc: PurchaseDocument } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [payFile, setPayFile] = useState<File | null>(null);

  const [supplierMode, setSupplierMode] = useState<'existing' | 'occasional' | 'new'>('existing');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(dateOnly());
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('EFECTIVO');
  const [payDate, setPayDate] = useState(dateOnly());
  const [payNotes, setPayNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const filters = {
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    supplierId: supplierFilter || undefined,
    productId: productFilter || undefined,
    paymentStatus: paymentStatus || undefined,
    hasPending: hasPending || undefined,
    hasDocuments: hasDocuments || undefined,
    limit: 50,
  };

  const purchases = useQuery({
    queryKey: ['purchases', filters],
    queryFn: () => purchasesApi.list(filters),
  });
  const summary = useQuery({
    queryKey: ['purchases-summary', filters],
    queryFn: () => purchasesApi.summary(filters),
  });
  const suppliers = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => suppliersApi.list({ limit: 100, isActive: true }),
  });
  const products = useQuery({
    queryKey: ['admin-products-all'],
    queryFn: () => productsApi.list({ limit: 100, status: 'active' }),
  });

  const selectedSupplier = useMemo(
    () => suppliers.data?.data.find((supplier) => supplier.id === supplierId),
    [supplierId, suppliers.data],
  );
  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();
    const list = suppliers.data?.data ?? [];
    if (!query) return list;
    return list.filter((supplier) => supplier.name.toLowerCase().includes(query));
  }, [supplierSearch, suppliers.data]);
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const list = products.data?.data ?? [];
    if (!query) return list;
    return list.filter((product) => product.name.toLowerCase().includes(query));
  }, [productSearch, products.data]);
  const draftTotal = items.reduce((acc, item) => acc + lineTotal(item.quantity, item.unitCost), 0);

  function resetForm() {
    setSupplierMode('existing');
    setSupplierId('');
    setSupplierName('');
    setPurchasedAt(dateOnly());
    setInvoiceRef('');
    setNotes('');
    setItems([emptyItem()]);
    setPayAmount('');
    setPayMethod('EFECTIVO');
    setPayDate(dateOnly());
    setPayNotes('');
    setPendingFiles([]);
    setSupplierSearch('');
    setProductSearch('');
    setEditing(null);
  }

  function fillForm(purchase: Purchase) {
    setEditing(purchase);
    setSupplierMode(purchase.supplierId ? 'existing' : 'occasional');
    setSupplierId(purchase.supplierId ?? '');
    setSupplierName(purchase.supplierName);
    setPurchasedAt(purchase.purchasedAt.slice(0, 10));
    setInvoiceRef(purchase.invoiceRef ?? '');
    setNotes(purchase.notes ?? '');
    setItems(
      purchase.items.map((item) => ({
        key: item.id,
        mode: item.productId ? 'catalog' : 'custom',
        productId: item.productId ?? '',
        productName: item.productName,
        unitLabel: item.unitLabel,
        quantity: item.quantity,
        unitCost: item.unitCost,
        applyToStock: false,
        notes: item.notes ?? '',
      })),
    );
    setPayAmount('');
    setPendingFiles([]);
    setDetail(null);
    setFormOpen(true);
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['purchases'] });
    void queryClient.invalidateQueries({ queryKey: ['purchases-summary'] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const payloadItems = items.map((item) => {
        if (item.mode === 'catalog') {
          if (!item.productId) throw new Error('Elegí un producto del catálogo o pasalo a personalizado');
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            applyToStock: !editing && item.applyToStock,
            notes: item.notes.trim() || undefined,
          };
        }
        if (item.productName.trim().length < 2) throw new Error('Ingresá el nombre del producto');
        return {
          productName: item.productName.trim(),
          unitLabel: item.unitLabel.trim() || 'u.',
          quantity: item.quantity,
          unitCost: item.unitCost,
          notes: item.notes.trim() || undefined,
        };
      });
      const body: Record<string, unknown> = {
        purchasedAt,
        invoiceRef: invoiceRef.trim() || undefined,
        notes: notes.trim() || undefined,
        items: payloadItems,
      };
      if (supplierMode === 'existing') {
        if (!supplierId) throw new Error('Elegí un proveedor');
        body.supplierId = supplierId;
      } else {
        if (supplierName.trim().length < 2) throw new Error('Ingresá el nombre del proveedor o productor');
        body.supplierName = supplierName.trim();
        body.createSupplier = supplierMode === 'new';
      }
      if (!editing && payAmount.trim()) {
        body.initialPayment = {
          amount: payAmount.trim(),
          method: payMethod,
          paidAt: payDate,
          notes: payNotes.trim() || undefined,
        };
      }
      const purchase = editing
        ? await purchasesApi.update(editing.id, body)
        : await purchasesApi.create(body);
      for (const file of pendingFiles) {
        await purchasesApi.uploadDocument(purchase.id, file);
      }
      return purchase;
    },
    onSuccess: () => {
      toast.success(editing ? 'Compra actualizada' : 'Compra registrada');
      resetForm();
      setFormOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addPayment = useMutation({
    mutationFn: async () => {
      if (!paying) throw new Error('Compra inválida');
      const purchase = await purchasesApi.addPayment(paying.id, {
        amount: payAmount,
        method: payMethod,
        paidAt: payDate,
        notes: payNotes.trim() || undefined,
      });
      if (payFile) {
        const lastPayment = purchase.payments[purchase.payments.length - 1];
        if (lastPayment) {
          await purchasesApi.uploadDocument(purchase.id, payFile, lastPayment.id);
          return purchasesApi.one(purchase.id);
        }
      }
      return purchase;
    },
    onSuccess: (purchase) => {
      toast.success('Pago registrado');
      setPaying(null);
      setPayAmount('');
      setPayFile(null);
      setDetail(purchase);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => purchasesApi.remove(id),
    onSuccess: () => {
      toast.success('Compra eliminada');
      setPendingDelete(null);
      setDetail(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const registerSupplier = useMutation({
    mutationFn: (id: string) => purchasesApi.registerSupplier(id),
    onSuccess: (purchase) => {
      toast.success('Proveedor dado de alta');
      setDetail(purchase);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function openPreview(purchaseId: string, doc: PurchaseDocument) {
    const blob = await purchasesApi.documentBlob(purchaseId, doc.id);
    const url = URL.createObjectURL(blob);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
    setPreview({ purchaseId, doc });
  }

  return (
    <div>
      <PageHeader
        title="Pedidos a proveedores"
        description="Compras de mercadería: habituales o extraordinarias. No se mezclan con los gastos operativos ni entran solas al stock."
        actions={
          canManage ? (
            <Button
              className="min-h-12"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            >
              Registrar compra
            </Button>
          ) : null
        }
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <article className="rounded-3xl bg-cream p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Total comprado</p>
          <p className="mt-1 font-display text-3xl">{formatMoney(summary.data?.totalCost)}</p>
        </article>
        <article className="rounded-3xl bg-cream p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Pagado</p>
          <p className="mt-1 font-display text-3xl">{formatMoney(summary.data?.paidAmount)}</p>
        </article>
        <article className="rounded-3xl bg-cream p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Pendiente</p>
          <p className="mt-1 font-display text-3xl">{formatMoney(summary.data?.pendingAmount)}</p>
        </article>
      </section>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Proveedor, producto o factura" />
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PARCIAL">Pago parcial</option>
          <option value="PAGADO">Pagado</option>
        </Select>
        <Select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
          <option value="">Todos los proveedores</option>
          {(suppliers.data?.data ?? []).map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </Select>
        <Select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
          <option value="">Todos los productos</option>
          {(products.data?.data ?? []).map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            const week = businessWeekRange();
            setFrom(week.from);
            setTo(week.to);
          }}
        >
          Esta semana
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            const month = monthRange();
            setFrom(month.from);
            setTo(month.to);
          }}
        >
          Este mes
        </Button>
        <Button type="button" variant={hasPending ? 'secondary' : 'ghost'} className="min-h-11" onClick={() => setHasPending((value) => !value)}>
          Con saldo
        </Button>
        <Button type="button" variant={hasDocuments ? 'secondary' : 'ghost'} className="min-h-11" onClick={() => setHasDocuments((value) => !value)}>
          Con comprobantes
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            setSearch('');
            setFrom('');
            setTo('');
            setSupplierFilter('');
            setProductFilter('');
            setPaymentStatus('');
            setHasPending(false);
            setHasDocuments(false);
          }}
        >
          Limpiar filtros
        </Button>
      </div>

      {purchases.isLoading ? (
        <Skeleton className="h-80" />
      ) : purchases.data?.data.length ? (
        <div className="space-y-3">
          {purchases.data.data.map((purchase) => (
            <article key={purchase.id} className="rounded-3xl bg-cream p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl leading-tight">{purchase.supplierName}</h2>
                  <p className="text-sm text-ink-soft">
                    {formatDate(purchase.purchasedAt)}
                    {purchase.invoiceRef ? ` · ${purchase.invoiceRef}` : ''}
                    {` · ${purchase.items.length} artículo(s)`}
                  </p>
                </div>
                <div className="text-right">
                  <strong className="font-display text-3xl">{formatMoney(purchase.totalCost)}</strong>
                  <div className="mt-1 flex flex-wrap justify-end gap-2">
                    <Badge tone={payTone(purchase.paymentStatus)}>
                      {PURCHASE_PAY_STATUS_LABEL[purchase.paymentStatus]}
                    </Badge>
                    {purchase.hasDocuments ? <Badge>Comprobantes</Badge> : null}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                Pagado {formatMoney(purchase.paidAmount)} · Pendiente {formatMoney(purchase.pendingAmount)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="min-h-11" variant="secondary" onClick={() => setDetail(purchase)}>
                  Ver detalle
                </Button>
                {canManage && !purchase.wholesaleOrderId ? (
                  <Button className="min-h-11" variant="ghost" onClick={() => fillForm(purchase)}>
                    Editar
                  </Button>
                ) : null}
                {canManage && Number(purchase.pendingAmount) > 0 ? (
                  <Button
                    className="min-h-11"
                    onClick={() => {
                      setPaying(purchase);
                      setPayAmount('');
                      setPayDate(dateOnly());
                      setPayNotes('');
                    }}
                  >
                    Registrar pago
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin compras"
          description="Registrá una compra manual o generála desde el pedido semanal."
        />
      )}

      <Modal
        open={formOpen}
        size="xl"
        title={editing ? 'Editar compra' : 'Registrar compra'}
        description="Podés cargar un proveedor habitual o uno ocasional, y mezclar cortes del catálogo con mercadería extraordinaria."
        onClose={() => setFormOpen(false)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="min-h-12" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="min-h-12" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar compra'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(['existing', 'occasional', 'new'] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={supplierMode === mode ? 'secondary' : 'ghost'}
                className="min-h-11"
                onClick={() => setSupplierMode(mode)}
              >
                {mode === 'existing' ? 'Proveedor registrado' : mode === 'occasional' ? 'Ocasional' : 'Dar de alta'}
              </Button>
            ))}
          </div>
          {supplierMode === 'existing' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Buscar proveedor">
                <Input
                  value={supplierSearch}
                  onChange={(event) => setSupplierSearch(event.target.value)}
                  placeholder="Nombre"
                />
              </Field>
              <Field label="Proveedor">
                <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                  <option value="">Elegí un proveedor</option>
                  {filteredSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <Field label="Nombre del proveedor o productor">
              <Input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha">
              <Input type="date" value={purchasedAt} onChange={(event) => setPurchasedAt(event.target.value)} />
            </Field>
            <Field label="Factura o ticket">
              <Input value={invoiceRef} onChange={(event) => setInvoiceRef(event.target.value)} />
            </Field>
          </div>
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={item.key} className="space-y-3 rounded-2xl bg-paper p-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={item.mode === 'catalog' ? 'secondary' : 'ghost'}
                    className="min-h-10"
                    onClick={() =>
                      setItems((current) =>
                        current.map((row) => (row.key === item.key ? { ...row, mode: 'catalog' } : row)),
                      )
                    }
                  >
                    Del catálogo
                  </Button>
                  <Button
                    type="button"
                    variant={item.mode === 'custom' ? 'secondary' : 'ghost'}
                    className="min-h-10"
                    onClick={() =>
                      setItems((current) =>
                        current.map((row) => (row.key === item.key ? { ...row, mode: 'custom' } : row)),
                      )
                    }
                  >
                    Personalizado
                  </Button>
                </div>
                {item.mode === 'catalog' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Buscar producto">
                      <Input
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Nombre del corte"
                      />
                    </Field>
                    <Field label="Producto">
                    <Select
                      value={item.productId}
                      onChange={(event) => {
                        const productId = event.target.value;
                        const link = selectedSupplier?.products?.find((row) => row.productId === productId);
                        const product = products.data?.data.find((row) => row.id === productId);
                        setItems((current) =>
                          current.map((row) =>
                            row.key === item.key
                              ? {
                                  ...row,
                                  productId,
                                  unitLabel: product?.saleUnit === 'UNIT' ? 'u.' : 'kg',
                                  unitCost: link?.purchasePrice ?? row.unitCost,
                                }
                              : row,
                          ),
                        );
                      }}
                    >
                      <option value="">Elegí</option>
                      {filteredProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </Select>
                    </Field>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <Field label="Nombre">
                      <Input
                        value={item.productName}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((row) =>
                              row.key === item.key ? { ...row, productName: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Unidad">
                      <Input
                        value={item.unitLabel}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((row) =>
                              row.key === item.key ? { ...row, unitLabel: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Cantidad">
                    <Input
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((row) =>
                            row.key === item.key ? { ...row, quantity: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Precio unitario">
                    <Input
                      inputMode="decimal"
                      value={item.unitCost}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((row) =>
                            row.key === item.key ? { ...row, unitCost: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <p className="self-end text-sm font-semibold">
                    Subtotal {formatMoney(lineTotal(item.quantity, item.unitCost))}
                  </p>
                </div>
                <Field label="Observaciones del artículo">
                  <Input
                    value={item.notes}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) =>
                          row.key === item.key ? { ...row, notes: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                {item.mode === 'catalog' && !editing ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.applyToStock}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((row) =>
                            row.key === item.key ? { ...row, applyToStock: event.target.checked } : row,
                          ),
                        )
                      }
                    />
                    Ingresar esta cantidad al stock
                  </label>
                ) : null}
                <Button
                  type="button"
                  variant="danger"
                  className="min-h-11"
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                >
                  Quitar artículo {index + 1}
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" className="min-h-11" onClick={() => setItems((current) => [...current, emptyItem()])}>
            Agregar artículo
          </Button>
          <p className="font-display text-3xl">Total {formatMoney(draftTotal)}</p>
          {!editing ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Pago inicial (opcional)">
                <Input inputMode="decimal" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} />
              </Field>
              <Field label="Medio">
                <Select value={payMethod} onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha de pago">
                <Input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} />
              </Field>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              Los pagos ya registrados no se modifican. El saldo se recalcula con el nuevo total.
            </p>
          )}
          <Field label="Comprobantes">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              multiple
              onChange={(event) => setPendingFiles(Array.from(event.target.files ?? []))}
            />
          </Field>
          {pendingFiles.length ? (
            <ul className="space-y-1 text-sm text-ink-soft">
              {pendingFiles.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          ) : null}
          <Field label="Notas">
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        size="xl"
        title={detail?.supplierName ?? 'Compra'}
        description={detail ? formatDate(detail.purchasedAt) : undefined}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={payTone(detail.paymentStatus)}>
                {PURCHASE_PAY_STATUS_LABEL[detail.paymentStatus]}
              </Badge>
              {detail.wholesaleOrderId ? <Badge>Pedido semanal</Badge> : null}
            </div>
            <p className="text-sm text-ink-soft">
              Total {formatMoney(detail.totalCost)} · Pagado {formatMoney(detail.paidAmount)} · Pendiente{' '}
              {formatMoney(detail.pendingAmount)}
            </p>
            <ul className="space-y-2 text-sm">
              {detail.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {item.productName}
                    <span className="block text-ink-soft">
                      {formatPurchaseQty(item.quantity, item.unitLabel, item.saleUnit)} · {formatMoney(item.unitCost)}
                    </span>
                  </span>
                  <span className="font-semibold">{formatMoney(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div>
              <h3 className="font-semibold">Pagos</h3>
              {detail.payments.length ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {detail.payments.map((payment) => (
                    <li key={payment.id} className="rounded-2xl bg-paper p-3">
                      <p>
                        {formatDate(payment.paidAt)} · {formatMoney(payment.amount)} · {PAYMENT_METHOD_LABEL[payment.method]}
                      </p>
                      {payment.notes ? <p className="text-ink-soft">{payment.notes}</p> : null}
                      {payment.documents.map((doc) => (
                        <Button
                          key={doc.id}
                          type="button"
                          variant="ghost"
                          className="mt-2 min-h-10"
                          onClick={() => void openPreview(detail.id, doc)}
                        >
                          Ver comprobante del pago
                        </Button>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">Todavía no hay pagos.</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold">Comprobantes</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.documents.map((doc) => (
                  <Button
                    key={doc.id}
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => void openPreview(detail.id, doc)}
                  >
                    Ver {doc.originalName ?? 'imagen'}
                  </Button>
                ))}
                {canManage ? (
                  <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-ink px-4 text-sm font-semibold text-cream">
                    Adjuntar
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void purchasesApi
                          .uploadDocument(detail.id, file)
                          .then(() => purchasesApi.one(detail.id))
                          .then((next) => {
                            setDetail(next);
                            refresh();
                            toast.success('Comprobante adjunto');
                          })
                          .catch((error: Error) => toast.error(error.message));
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
            {canManage ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!detail.wholesaleOrderId ? (
                  <Button className="min-h-12" variant="secondary" onClick={() => fillForm(detail)}>
                    Editar
                  </Button>
                ) : null}
                {Number(detail.pendingAmount) > 0 ? (
                  <Button
                    className="min-h-12"
                    onClick={() => {
                      setPaying(detail);
                      setPayAmount('');
                      setPayDate(dateOnly());
                    }}
                  >
                    Registrar pago
                  </Button>
                ) : null}
                {!detail.supplierId ? (
                  <Button
                    className="min-h-12"
                    variant="secondary"
                    disabled={registerSupplier.isPending}
                    onClick={() => registerSupplier.mutate(detail.id)}
                  >
                    Guardar como proveedor
                  </Button>
                ) : null}
                {!detail.wholesaleOrderId ? (
                  <Button className="min-h-12" variant="danger" onClick={() => setPendingDelete(detail)}>
                    Eliminar
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paying)}
        title="Registrar pago"
        onClose={() => setPaying(null)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="min-h-12" onClick={() => setPaying(null)}>
              Cancelar
            </Button>
            <Button type="button" className="min-h-12" disabled={addPayment.isPending} onClick={() => addPayment.mutate()}>
              {addPayment.isPending ? 'Guardando...' : 'Guardar pago'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">Saldo {formatMoney(paying?.pendingAmount)}</p>
          <Field label="Importe">
            <Input inputMode="decimal" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} />
          </Field>
          <Field label="Medio">
            <Select value={payMethod} onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} />
          </Field>
          <Field label="Notas">
            <Textarea rows={2} value={payNotes} onChange={(event) => setPayNotes(event.target.value)} />
          </Field>
          <Field label="Comprobante del pago">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={(event) => setPayFile(event.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
      </Modal>

      <Modal open={Boolean(preview)} title="Comprobante" onClose={() => setPreview(null)} size="xl">
        {previewUrl ? (
          <img src={previewUrl} alt="Comprobante de compra" className="max-h-[70vh] w-full rounded-2xl object-contain" />
        ) : null}
        {preview && canManage ? (
          <Button
            className="mt-4 min-h-12"
            variant="danger"
            onClick={() => {
              void purchasesApi
                .removeDocument(preview.purchaseId, preview.doc.id)
                .then((purchase) => {
                  setDetail(purchase);
                  setPreview(null);
                  refresh();
                  toast.success('Comprobante eliminado');
                })
                .catch((error: Error) => toast.error(error.message));
            }}
          >
            Eliminar comprobante
          </Button>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="¿Eliminar esta compra?"
        description="Se borra el historial de esta operación y se revierte el stock si se había ingresado. Los gastos operativos no se tocan."
        confirmLabel="Eliminar compra"
        danger
        loading={remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
        }}
      />
    </div>
  );
}
