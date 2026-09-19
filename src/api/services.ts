import { api, fetchText, toQuery } from './client';
import type {
  AuthResponse,
  AuthUser,
  Category,
  Customer,
  DashboardOverview,
  Order,
  OrderStatus,
  OrganizationSettings,
  ProductUsage,
  Paginated,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Product,
  Purchase,
  Sale,
  SaleUnit,
  StockMovement,
  StockOverview,
  StoreCheckoutResponse,
  Supplier,
  SupplierCategory,
  SupplierProduct,
  UserAccount,
  WeeklyOrders,
  WeeklyProductSources,
  WholesaleOrder,
} from '../types/api';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }, { auth: false }),
  me: () => api.get<AuthUser>('/auth/me'),
};

export const storeApi = {
  categories: () => api.get<Category[]>('/store/categories', { auth: false }),
  products: (params: { search?: string; categoryId?: string } = {}) =>
    api.get<Product[]>(`/store/products${toQuery(params)}`, { auth: false }),
  product: (id: string) => api.get<Product>(`/store/products/${id}`, { auth: false }),
  checkout: (body: Record<string, unknown>) =>
    api.post<StoreCheckoutResponse>('/store/checkout', body, { auth: false }),
  track: (id: string, phone: string) =>
    api.get<Order>(`/store/orders/${id}${toQuery({ phone })}`, { auth: false }),
  contact: () => api.get<{ whatsappPhone: string | null }>('/store/contact', { auth: false }),
};

export const productsApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    api.get<Paginated<Product>>(`/products${toQuery(params)}`),
  one: (id: string) => api.get<Product>(`/products/${id}`),
  create: (body: Record<string, unknown>) => api.post<Product>('/products', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Product>(`/products/${id}`, body),
  remove: (id: string) => api.delete<Product>(`/products/${id}`),
  deactivate: (id: string) => api.post<Product>(`/products/${id}/deactivate`, {}),
  activate: (id: string) => api.post<Product>(`/products/${id}/activate`, {}),
  usage: (id: string) =>
    api.get<ProductUsage>(`/products/${id}/usage`),
  archive: (id: string) =>
    api.post<Product & { strategy: 'deleted' | 'archived'; usage: ProductUsage }>(
      `/products/${id}/archive`,
      {},
    ),
  adjustStock: (id: string, quantityDelta: string, reason?: string) =>
    api.post<Product>(`/products/${id}/stock`, { quantityDelta, reason }),
  stockMovements: (id: string) => api.get<StockMovement[]>(`/products/${id}/stock-movements`),
};

export const stockApi = {
  overview: () => api.get<StockOverview>('/stock/overview'),
  movements: (params: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<StockMovement>>(`/stock/movements${toQuery(params)}`),
  adjust: (productId: string, quantityDelta: string, reason?: string) =>
    api.post<Product>(`/stock/${productId}/adjust`, { quantityDelta, reason }),
  clear: (productId: string) => api.post<Product>(`/stock/${productId}/clear`, {}),
};

export const categoriesApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    api.get<Paginated<Category>>(`/categories${toQuery({ limit: 100, ...params })}`),
  one: (id: string) => api.get<Category>(`/categories/${id}`),
  create: (body: Record<string, unknown>) => api.post<Category>('/categories', body),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<Category>(`/categories/${id}`, body),
  /** Los productos asociados sobreviven sin categoría. */
  remove: (id: string) =>
    api.delete<Category & { detachedProducts: number }>(`/categories/${id}`),
};

export const supplierCategoriesApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    api.get<Paginated<SupplierCategory>>(`/supplier-categories${toQuery({ limit: 100, ...params })}`),
  one: (id: string) => api.get<SupplierCategory>(`/supplier-categories/${id}`),
  create: (body: Record<string, unknown>) =>
    api.post<SupplierCategory>('/supplier-categories', body),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<SupplierCategory>(`/supplier-categories/${id}`, body),
  /** Los proveedores asociados sobreviven sin categoría. */
  remove: (id: string) =>
    api.delete<SupplierCategory & { detachedSuppliers: number }>(`/supplier-categories/${id}`),
};

export const customersApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    api.get<Paginated<Customer>>(`/customers${toQuery(params)}`),
  one: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (body: Record<string, unknown>) => api.post<Customer>('/customers', body),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<Customer>(`/customers/${id}`, body),
  /**
   * El cliente se borra sólo si no tiene historial. Si tiene pedidos o ventas
   * se archiva para no romper los registros históricos.
   */
  remove: (id: string) =>
    api.delete<Customer & { strategy: 'deleted' | 'archived'; orders: number; sales: number }>(
      `/customers/${id}`,
    ),
  history: (id: string) => api.get<{ orders: Order[]; sales: Sale[] }>(`/customers/${id}/history`),
};

export const ordersApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Order>>(`/orders${toQuery(params)}`),
  one: (id: string) => api.get<Order>(`/orders/${id}`),
  create: (body: Record<string, unknown>) => api.post<Order>('/orders', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Order>(`/orders/${id}`, body),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/orders/${id}/status`, { status }),
  remove: (id: string) => api.delete<{ id: string; strategy: 'deleted' }>(`/orders/${id}`),
  /** Kilos realmente pesados al preparar el pedido. */
  updateWeights: (id: string, items: Array<{ itemId: string; actualKg: string }>) =>
    api.patch<Order>(`/orders/${id}/actual-weights`, { items }),
};

export const salesApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Sale>>(`/sales${toQuery(params)}`),
  one: (id: string) => api.get<Sale>(`/sales/${id}`),
  create: (body: Record<string, unknown>) => api.post<Sale>('/sales', body),
};

export const paymentsApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Payment>>(`/payments${toQuery(params)}`),
  create: (body: {
    amount: string;
    method: PaymentMethod;
    orderId?: string;
    saleId?: string;
    notes?: string;
  }) => api.post<Payment>('/payments', body),
};

export const suppliersApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    api.get<Paginated<Supplier>>(`/suppliers${toQuery(params)}`),
  one: (id: string) => api.get<Supplier>(`/suppliers/${id}`),
  create: (body: Record<string, unknown>) => api.post<Supplier>('/suppliers', body),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<Supplier>(`/suppliers/${id}`, body),
  remove: (id: string) => api.delete<Supplier>(`/suppliers/${id}`),
  linkProduct: (
    id: string,
    body: { productId: string; purchasePrice?: string; minPurchaseQty?: string; notes?: string },
  ) =>
    api.post<SupplierProduct>(`/suppliers/${id}/products`, body),
  unlinkProduct: (id: string, productId: string) =>
    api.delete<{ supplierId: string; productId: string }>(`/suppliers/${id}/products/${productId}`),
};

export const purchasesApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Purchase>>(`/purchases${toQuery(params)}`),
  one: (id: string) => api.get<Purchase>(`/purchases/${id}`),
  create: (body: Record<string, unknown>) => api.post<Purchase>('/purchases', body),
};

export const usersApi = {
  list: () => api.get<Paginated<UserAccount>>('/users?limit=100'),
  create: (body: Record<string, unknown>) => api.post<UserAccount>('/users', body),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<UserAccount>(`/users/${id}`, body),
  remove: (id: string) => api.delete<UserAccount>(`/users/${id}`),
};

export const settingsApi = {
  get: () => api.get<OrganizationSettings>('/settings'),
  update: (body: { whatsappPhone: string | null }) =>
    api.patch<OrganizationSettings>('/settings', body),
};

export const dashboardApi = {
  overview: () => api.get<DashboardOverview>('/dashboard/overview'),
  evolution: (granularity: 'day' | 'week' | 'month' = 'day') =>
    api.get<{ series: Array<{ period: string; total: string }> }>(
      `/dashboard/sales-evolution${toQuery({ granularity })}`,
    ),
  topProducts: () => api.get<DashboardOverview['topProducts']>('/dashboard/top-products'),
};

export type WholesaleItemInput = {
  productId: string;
  quantityToOrder: string;
  supplierId?: string;
  /** Precio de coste de esta compra concreta, no del producto. */
  unitCost?: string;
};

export const weeklyOrdersApi = {
  week: (
    params: {
      weekStart?: string;
      status?: OrderStatus | '';
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) =>
    api.get<WeeklyOrders>(
      `/weekly-orders${toQuery({
        weekStart: params.weekStart,
        status: params.status || undefined,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),
  productSources: (productId: string, weekStart?: string) =>
    api.get<WeeklyProductSources>(`/weekly-orders/products/${productId}${toQuery({ weekStart })}`),
  exportCsv: (weekStart?: string) => fetchText(`/weekly-orders/export${toQuery({ weekStart })}`),
  /** Confirma en una transacción todos los pedidos pendientes de la semana. */
  confirmWeekOrders: (weekStart?: string) =>
    api.post<{ weekStart: string; weekEnd: string; confirmed: number; orderIds: string[] }>(
      '/weekly-orders/confirm-orders',
      { weekStart },
    ),
  upsertWholesale: (body: {
    weekStart?: string;
    notes?: string;
    supplierId?: string;
    items: WholesaleItemInput[];
  }) => api.post<WholesaleOrder>('/weekly-orders/wholesale', body),
  updateWholesale: (
    id: string,
    body: { notes?: string; supplierId?: string; items?: WholesaleItemInput[] },
  ) => api.patch<WholesaleOrder>(`/weekly-orders/wholesale/${id}`, body),
  confirmWholesale: (id: string) =>
    api.post<WholesaleOrder>(`/weekly-orders/wholesale/${id}/confirm`),
  completeSupplierOrder: (body: {
    weekStart?: string;
    notes?: string;
    supplierId?: string;
    items: WholesaleItemInput[];
  }) => api.post<Purchase[]>('/weekly-orders/wholesale/complete', body),
  assignSuppliers: (
    id: string,
    items: Array<{ productId: string; supplierId: string; unitCost?: string }>,
  ) => api.patch<WholesaleOrder>(`/weekly-orders/wholesale/${id}/suppliers`, { items }),
  generatePurchases: (
    id: string,
    items: Array<{ productId: string; receivedQty: string }>,
  ) => api.post<Purchase[]>(`/weekly-orders/wholesale/${id}/purchases`, { items }),
  excludeProduct: (productId: string, weekStart?: string) =>
    api.post<{
      productId: string;
      productName: string;
      cancelledItems: number;
      ordersUpdated: number;
      catalogRemoval: { strategy: 'deleted' | 'archived' | 'already_removed' };
    }>(`/weekly-orders/products/${productId}/exclude`, { weekStart }),
  resetWeek: (weekStart?: string) =>
    api.post<{
      weekStart: string;
      weekEnd: string;
      wholesaleDeleted: boolean;
      purchasesDeleted: number;
      ordersReverted: number;
    }>('/weekly-orders/reset', { weekStart }),
};

export type { SaleUnit, PaymentStatus };
