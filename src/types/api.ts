export type Role = 'ADMIN' | 'EMPLEADO';
export type SaleUnit = 'UNIT' | 'KILOGRAM';
export type OrderStatus =
  | 'PENDIENTE'
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

export type Product = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  purchasePrice?: string;
  salePrice: string;
  saleUnit: SaleUnit;
  weightKg?: string | null;
  stock: string;
  minStock?: string;
  isActive: boolean;
  categoryId: string;
  category?: Category;
  createdAt?: string;
  updatedAt?: string;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  notes?: string | null;
  createdAt?: string;
};

export type OrderItem = {
  id: string;
  productId?: string;
  productName: string;
  saleUnit: SaleUnit;
  quantity: string;
  requestedKg?: string | null;
  actualKg?: string | null;
  unitPrice: string;
  estimatedLineTotal: string;
  finalLineTotal?: string | null;
};

export type Order = {
  id: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  estimatedTotal: string;
  finalTotal?: string | null;
  estimatedDeliveryDate: string;
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
  notes?: string | null;
  orderedAt: string;
  customer?: Customer;
  items: OrderItem[];
  payments?: Payment[];
};

export type SaleItem = {
  id: string;
  productName: string;
  saleUnit: SaleUnit;
  quantity: string;
  kg?: string | null;
  unitPrice: string;
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

export type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
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
  };
};

export type WeeklyDay = {
  date: string;
  orders: Order[];
  totals: { orders: number; estimatedTotal: string; finalTotal: string; kg: string };
};

export type WeeklyPlanning = {
  weekStart: string;
  weekEnd: string;
  days: WeeklyDay[];
  totals: WeeklyDay['totals'];
};

export type WholesaleOrderStatus = 'BORRADOR' | 'PREPARADO' | 'CONFIRMADO' | 'RECIBIDO';

export type WeeklyProductSummary = {
  productId: string;
  productName: string;
  saleUnit: SaleUnit;
  confirmedQuantity: string;
  pendingQuantity: string;
  totalQuantity: string;
};

export type WeeklyOrderRow = {
  id: string;
  status: OrderStatus;
  orderedAt: string;
  orderedOn: string;
  weekday: string;
  estimatedTotal: string;
  finalTotal?: string | null;
  estimatedDeliveryDate: string;
  customer?: Customer;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    saleUnit: SaleUnit;
    quantity: string;
  }>;
};

export type WholesaleOrderItem = {
  id: string;
  productId: string;
  productName: string;
  saleUnit: SaleUnit;
  requestedByCustomers: string;
  pendingByCustomers: string;
  totalRequested: string;
  quantityToOrder: string;
};

export type WholesaleOrder = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: WholesaleOrderStatus;
  notes?: string | null;
  confirmedAt?: string | null;
  receivedAt?: string | null;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
  confirmedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  items: WholesaleOrderItem[];
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
  'LISTO',
  'ENTREGADO',
];

export const ORDER_STATUS_ACTIONS: Record<
  OrderStatus,
  Array<{ to: OrderStatus; label: string; variant: 'primary' | 'secondary' | 'danger' }>
> = {
  PENDIENTE: [
    { to: 'CONFIRMADO', label: 'Confirmar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  CONFIRMADO: [
    { to: 'EN_PREPARACION', label: 'Preparar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  EN_PREPARACION: [
    { to: 'LISTO', label: 'Marcar listo', variant: 'secondary' },
    { to: 'ENTREGADO', label: 'Entregar', variant: 'primary' },
    { to: 'CANCELADO', label: 'Cancelar', variant: 'danger' },
  ],
  LISTO: [
    { to: 'ENTREGADO', label: 'Entregar', variant: 'primary' },
    { to: 'EN_ENTREGA', label: 'En camino', variant: 'secondary' },
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

export const WHOLESALE_STATUS_LABEL: Record<WholesaleOrderStatus, string> = {
  BORRADOR: 'Borrador',
  PREPARADO: 'Preparado',
  CONFIRMADO: 'Confirmado',
  RECIBIDO: 'Recibido',
};

export const DELIVERY_WINDOWS = [
  { label: 'Mañana', start: '09:00', end: '12:00' },
  { label: 'Mediodía', start: '12:00', end: '15:00' },
  { label: 'Tarde', start: '15:00', end: '18:00' },
  { label: 'Noche', start: '18:00', end: '21:00' },
] as const;
