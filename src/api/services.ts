import { api, fetchText, toQuery } from './client';
import type {
  AuthResponse,
  AuthUser,
  Category,
  Customer,
  DashboardOverview,
  Order,
  OrderStatus,
  Paginated,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Product,
  Sale,
  SaleUnit,
  Supplier,
  UserAccount,
  WeeklyOrders,
  WeeklyPlanning,
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
    api.post<Order>('/store/checkout', body, { auth: false }),
  track: (id: string, phone: string) =>
    api.get<Order>(`/store/orders/${id}${toQuery({ phone })}`, { auth: false }),
};

export const productsApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    api.get<Paginated<Product>>(`/products${toQuery(params)}`),
  one: (id: string) => api.get<Product>(`/products/${id}`),
  create: (body: Record<string, unknown>) => api.post<Product>('/products', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Product>(`/products/${id}`, body),
  remove: (id: string) => api.delete<Product>(`/products/${id}`),
  adjustStock: (id: string, quantityDelta: string, reason?: string) =>
    api.post<Product>(`/products/${id}/stock`, { quantityDelta, reason }),
};

export const categoriesApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) =>
    api.get<Paginated<Category>>(`/categories${toQuery({ limit: 100, ...params })}`),
  one: (id: string) => api.get<Category>(`/categories/${id}`),
  create: (body: Record<string, unknown>) => api.post<Category>('/categories', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Category>(`/categories/${id}`, body),
  remove: (id: string, reassignTo?: string) =>
    api.delete<Category>(`/categories/${id}${toQuery({ reassignTo })}`),
};

export const customersApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Customer>>(`/customers${toQuery(params)}`),
  one: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (body: Record<string, unknown>) => api.post<Customer>('/customers', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Customer>(`/customers/${id}`, body),
  history: (id: string) => api.get<{ orders: Order[]; sales: Sale[] }>(`/customers/${id}/history`),
};

export const ordersApi = {
  list: (params: Record<string, string | number | undefined> = {}) =>
    api.get<Paginated<Order>>(`/orders${toQuery(params)}`),
  one: (id: string) => api.get<Order>(`/orders/${id}`),
  create: (body: Record<string, unknown>) => api.post<Order>('/orders', body),
  updateStatus: (id: string, status: OrderStatus) => api.patch<Order>(`/orders/${id}/status`, { status }),
  updateWeight: (id: string, itemId: string, actualKg: string) =>
    api.patch<Order>(`/orders/${id}/items/${itemId}/actual-weight`, { actualKg }),
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
  update: (id: string, body: Record<string, unknown>) => api.patch<Supplier>(`/suppliers/${id}`, body),
  remove: (id: string) => api.delete<Supplier>(`/suppliers/${id}`),
};

export const usersApi = {
  list: () => api.get<Paginated<UserAccount>>('/users?limit=100'),
  create: (body: Record<string, unknown>) => api.post<UserAccount>('/users', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<UserAccount>(`/users/${id}`, body),
  remove: (id: string) => api.delete<UserAccount>(`/users/${id}`),
};

export const dashboardApi = {
  overview: () => api.get<DashboardOverview>('/dashboard/overview'),
  evolution: (granularity: 'day' | 'week' | 'month' = 'day') =>
    api.get<{ series: Array<{ period: string; total: string }> }>(
      `/dashboard/sales-evolution${toQuery({ granularity })}`,
    ),
  topProducts: () =>
    api.get<DashboardOverview['topProducts']>('/dashboard/top-products'),
};

export const planningApi = {
  week: (weekStart: string, status?: OrderStatus) =>
    api.get<WeeklyPlanning>(`/weekly-planning${toQuery({ weekStart, status })}`),
  markPrepared: (id: string) => api.patch<Order>(`/weekly-planning/orders/${id}/prepared`),
  markDelivered: (id: string) => api.patch<Order>(`/weekly-planning/orders/${id}/delivered`),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/weekly-planning/orders/${id}/status`, { status }),
};

export const weeklyOrdersApi = {
  week: (params: {
    weekStart?: string;
    status?: OrderStatus | '';
    search?: string;
    page?: number;
    limit?: number;
  } = {}) =>
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
  upsertWholesale: (body: {
    weekStart?: string;
    notes?: string;
    items: Array<{ productId: string; quantityToOrder: string }>;
  }) => api.post<WholesaleOrder>('/weekly-orders/wholesale', body),
  updateWholesale: (
    id: string,
    body: { notes?: string; items?: Array<{ productId: string; quantityToOrder: string }> },
  ) => api.patch<WholesaleOrder>(`/weekly-orders/wholesale/${id}`, body),
  confirmWholesale: (id: string) => api.post<WholesaleOrder>(`/weekly-orders/wholesale/${id}/confirm`),
  receiveWholesale: (id: string) => api.post<WholesaleOrder>(`/weekly-orders/wholesale/${id}/receive`),
};

export type { SaleUnit, PaymentStatus };
