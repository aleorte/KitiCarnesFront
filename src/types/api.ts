export type Role = 'ADMIN' | 'EMPLEADO';
export type SaleUnit = 'UNIT' | 'KILOGRAM';
export type OrderStatus =
  | 'PENDIENTE'
  | 'PENDIENTE_WHATSAPP'
  | 'CONFIRMADO'
  | 'EN_PREPARACION'
  | 'LISTO'
  | 'EN_ENTREGA'
  | 'ENTREGADO'
  | 'CANCELADO';
export type PaymentStatus = 'SIN_PAGAR' | 'PAGO_PARCIAL' | 'PAGADO';
export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'OTRO';

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId: string;
  permissions: string[];
};

export type AuthResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
};

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { products: number };
};

export type SupplierCategory = {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { suppliers: number };
};

export type Product = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  salePrice: string;
  saleUnit: SaleUnit;
  /** Rango estimado por pieza. Si está, el cliente pide unidades y se cobra por kg. */
  estimatedMinKg?: string | null;
  estimatedMaxKg?: string | null;
  stock: string;
  isActive: boolean;
  /** Baja lógica: deja el catálogo y conserva pedidos, ventas y stock. */
  deletedAt?: string | null;
  /** La categoría es opcional: queda en null si se elimina la categoría. */
  categoryId?: string | null;
  category?: Category | null;
  /** Último coste conocido, surge de la compra al proveedor más reciente. */
  lastKnownCost?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OrganizationSettings = {
  organizationId: string;
  name: string;
  slug: string;
  whatsappPhone: string | null;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  preferredPaymentMethod?: PaymentMethod | null;
  notes?: string | null;
  /** Baja lógica: el cliente se archiva cuando tiene historial. */
  deletedAt?: string | null;
  createdAt?: string;
};

export type OrderItem = {
  id: string;
  productId?: string;
  productName: string;
  saleUnit: SaleUnit;
  /** Cantidad solicitada por el cliente (unidades o kg pedidos). */
  quantity: string;
  requestedKg?: string | null;
  estimatedMinKg?: string | null;
  estimatedMaxKg?: string | null;
  estimatedLineTotalMax?: string | null;
  /** Kilos realmente pesados al entregar, solo en cortes de peso variable. */
  actualKg?: string | null;
  unitPrice: string;
  unitCost?: string | null;
  estimatedLineTotal: string;
  finalLineTotal?: string | null;
  weeklyCoveredAt?: string | null;
  cancelledAt?: string | null;
};

export type Order = {
  id: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  estimatedTotal: string;
  estimatedTotalMax?: string | null;
  finalTotal?: string | null;
  notes?: string | null;
  orderedAt: string;
  customer?: Customer;
  items: OrderItem[];
  payments?: Payment[];
  sale?: { id: string; total?: string; paymentStatus?: PaymentStatus } | null;
  stockDeducted?: boolean;
};

export type StoreCheckoutConfirmation = {
  shopWhatsApp: string | null;
  message: string;
  whatsappUrl: string | null;
};

export type StoreCheckoutResponse = Order & {
  confirmation: StoreCheckoutConfirmation;
};

export type SaleItem = {
  id: string;
  productName: string;
  saleUnit: SaleUnit;
  quantity: string;
  /** Kilos realmente entregados, base del cálculo de ganancia. */
  kg?: string | null;
  unitPrice: string;
  /** Coste real de adquisición. Nulo si todavía no hubo compra al proveedor. */
  unitCost?: string | null;
  lineTotal: string;
};

export type Sale = {
  id: string;
  total: string;
  paymentStatus: PaymentStatus;
  soldAt: string;
  notes?: string | null;
  customer?: Customer | null;
  user?: { firstName: string; lastName: string };
  items: SaleItem[];
  payments?: Payment[];
};

export type Payment = {
  id: string;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  notes?: string | null;
  orderId?: string | null;
  saleId?: string | null;
};

export type SupplierProduct = {
  id: string;
  productId: string;
  supplierId: string;
  purchasePrice?: string | null;
  minPurchaseQty?: string | null;
  notes?: string | null;
  product: Pick<Product, 'id' | 'name' | 'saleUnit' | 'salePrice'>;
};

export type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  /** La categoría es opcional: queda en null si se elimina la categoría. */
  categoryId?: string | null;
  category?: SupplierCategory | null;
  products?: SupplierProduct[];
};

export type PurchaseItem = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
  lineTotal: string;
  product?: Pick<Product, 'id' | 'name' | 'saleUnit'>;
};

export type Purchase = {
  id: string;
  status: string;
  purchasedAt: string;
  totalCost: string;
  notes?: string | null;
  wholesaleOrderId?: string | null;
  supplier: Pick<Supplier, 'id' | 'name'>;
  items: PurchaseItem[];
};

export type UserAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
};

export type DashboardOverview = {
  timezone: string;
  sales: {
    today: string;
    week: string;
    month: string;
    todayCount: number;
    weekCount: number;
    monthCount: number;
  };
  orders: { total: number; pending: number; delivered: number };
  pendingPayments: {
    orders: number;
    independentSales: number;
    outstandingAmount: string;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: string;
    kg: string;
    total: string;
  }>;
  financial?: {
    monthCosts: string;
    monthEstimatedProfit: string;
    monthCogs: string;
    /** Renglones vendidos sin coste de compra conocido todavía. */
    monthItemsWithoutCost: number;
  };
  stock?: {
    products: number;
    estimatedValue: string;
  };
  businessWeek?: {
    weekStart: string;
    weekEnd: string;
    label: string;
    orders: number;
    pending: number;
    confirmed: number;
    customers: number;
  };
};

export type WholesaleOrderStatus = 'BORRADOR' | 'PREPARADO' | 'CONFIRMADO' | 'RECIBIDO';

export type WeeklyProductSupplier = {
  supplierId: string;
  supplierName: string;
  purchasePrice?: string | null;
  minPurchaseQty?: string | null;
};

export type WeeklyProductSummary = {
  productId: string;
  productName: string;
  saleUnit: SaleUnit;
  estimatedMinKg?: string | null;
  estimatedMaxKg?: string | null;
  confirmedQuantity: string;
  pendingQuantity: string;
  totalQuantity: string;
  stock: string;
  catalogDeleted?: boolean;
  planningUnit: SaleUnit;
  planningDemand: string;
  estimatedDemandKgMin?: string | null;
  estimatedDemandKgMax?: string | null;
  purchaseNeed: string;
  suggestedQty: string;
  surplusQty: string;
  shortageQty?: string;
  belowMinimum?: boolean;
  cancelledQuantity?: string;
  excluded?: boolean;
  suppliers: WeeklyProductSupplier[];
};

export type WeeklyOrderRow = {
  id: string;
  status: OrderStatus;
  orderedAt: string;
  orderedOn: string;
  weekday: string;
  estimatedTotal: string;
  finalTotal?: string | null;
  customer?: Customer;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    saleUnit: SaleUnit;
    requestedQuantity: string;
    cancelled?: boolean;
  }>;
};

export type WholesaleOrderItem = {
  id: string;
  productId: string;
  productName: string;
  saleUnit: SaleUnit;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  requestedByCustomers: string;
  pendingByCustomers: string;
  totalRequested: string;
  stockAvailable?: string;
  purchaseNeed?: string;
  minPurchaseQty?: string | null;
  quantityToOrder: string;
  receivedQty?: string | null;
  surplusQty?: string;
  shortageQty?: string;
  excludedAt?: string | null;
  /** Precio de coste de esta compra concreta. */
  unitCost?: string | null;
  lineTotal?: string | null;
};

export type WholesaleOrder = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: WholesaleOrderStatus;
  notes?: string | null;
  totalCost?: string | null;
  supplier?: { id: string; name: string } | null;
  confirmedAt?: string | null;
  receivedAt?: string | null;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
  confirmedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  items: WholesaleOrderItem[];
  purchases?: Array<{ id: string; supplierId: string; totalCost: string; status: string }>;
};

export type WeeklyOrders = {
  timezone: string;
  weekStart: string;
  weekEnd: string;
  previousWeekStart: string;
  nextWeekStart: string;
  isCurrent: boolean;
  label: string;
  shortLabel: string;
  summary: {
    orders: number;
    totalOrders: number;
    customers: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    kg: string;
    units: string;
    estimatedTotal: string;
  };
  products: WeeklyProductSummary[];
  orders: Paginated<WeeklyOrderRow>;
  wholesaleOrder: WholesaleOrder | null;
};

export type WeeklyProductSources = {
  weekStart: string;
  weekEnd: string;
  productId: string;
  productName: string;
  saleUnit: SaleUnit;
  confirmedQuantity: string;
  pendingQuantity: string;
  totalQuantity: string;
  sources: Array<{
    orderId: string;
    status: OrderStatus;
    orderedAt: string;
    weekday: string;
    customerName: string;
    quantity: string;
    isPending: boolean;
  }>;
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  PENDIENTE_WHATSAPP: 'Pendiente de WhatsApp',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo',
  EN_ENTREGA: 'En entrega',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const ORDER_FLOW: OrderStatus[] = [
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'ENTREGADO',
];

export const ORDER_STATUS_FILTER: OrderStatus[] = [
  'PENDIENTE_WHATSAPP',
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'ENTREGADO',
  'CANCELADO',
  'LISTO',
  'EN_ENTREGA',
];

export function isOrderEditable(status: OrderStatus) {
  return (
    status === 'PENDIENTE_WHATSAPP' ||
    status === 'PENDIENTE' ||
    status === 'CONFIRMADO' ||
    status === 'EN_PREPARACION'
  );
}

export function isOrderDeletable(order: Pick<Order, 'status' | 'paymentStatus' | 'sale' | 'payments' | 'items'>) {
  if (order.status === 'ENTREGADO') return false;
  if (order.paymentStatus === 'PAGADO' || order.paymentStatus === 'PAGO_PARCIAL') return false;
  if (order.sale) return false;
  if ((order.payments?.length ?? 0) > 0) return false;
  if (order.items.some((item) => item.weeklyCoveredAt)) return false;
  return true;
}

export function orderFlowIndex(status: OrderStatus) {
  if (status === 'CANCELADO') return -1;
  if (status === 'PENDIENTE_WHATSAPP') return ORDER_FLOW.indexOf('PENDIENTE');
  if (status === 'LISTO' || status === 'EN_ENTREGA') return ORDER_FLOW.indexOf('EN_PREPARACION');
  return Math.max(0, ORDER_FLOW.indexOf(status));
}

export const ORDER_STATUS_ACTIONS: Record<
  OrderStatus,
  Array<{ to: OrderStatus; label: string; variant: 'primary' | 'secondary' | 'danger' }>
> = {
  PENDIENTE_WHATSAPP: [
    { to: 'CONFIRMADO', label: 'Confirmar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  PENDIENTE: [
    { to: 'CONFIRMADO', label: 'Confirmar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  CONFIRMADO: [
    { to: 'EN_PREPARACION', label: 'Preparar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  EN_PREPARACION: [
    { to: 'ENTREGADO', label: 'Entregar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  LISTO: [
    { to: 'ENTREGADO', label: 'Entregar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  EN_ENTREGA: [
    { to: 'ENTREGADO', label: 'Entregar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  ENTREGADO: [],
  CANCELADO: [],
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  SIN_PAGAR: 'Sin pagar',
  PAGO_PARCIAL: 'Pago parcial',
  PAGADO: 'Pagado',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  OTRO: 'Otro',
};

export type ProductListStatus = 'catalog' | 'active' | 'inactive' | 'archived' | 'all';

export type ProductUsage = {
  orders: number;
  sales: number;
  purchases: number;
  stockMovements: number;
  wholesaleItems?: number;
};

export const PRODUCT_STATUS_LABEL: Record<Exclude<ProductListStatus, 'all' | 'catalog'>, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  archived: 'Fuera de catálogo',
};

export const WHOLESALE_STATUS_LABEL: Record<WholesaleOrderStatus, string> = {
  BORRADOR: 'Borrador',
  PREPARADO: 'Preparado',
  CONFIRMADO: 'Confirmado',
  RECIBIDO: 'Recibido',
};

export type StockMovementType = 'PURCHASE' | 'SALE' | 'ORDER_FULFILLMENT' | 'ADJUSTMENT' | 'CANCELLATION';

export type StockMovement = {
  id: string;
  type: StockMovementType;
  quantityDelta: string;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
  product?: { id: string; name: string; saleUnit: SaleUnit };
  user?: { firstName: string; lastName: string } | null;
};

export type StockOverview = {
  products: number;
  estimatedValue: string;
};

export const STOCK_MOVEMENT_LABEL: Record<StockMovementType, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venta',
  ORDER_FULFILLMENT: 'Pedido',
  ADJUSTMENT: 'Ajuste',
  CANCELLATION: 'Cancelación',
};
