import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ProtectedRoute } from './components/protected-route';
import { AuthProvider } from './hooks/use-auth';
import { CartProvider } from './hooks/use-cart';
import { AdminLayout } from './layouts/admin-layout';
import { StoreLayout } from './layouts/store-layout';
import { CustomerDetailPage, CustomersPage } from './pages/admin/customers';
import { DashboardPage } from './pages/admin/dashboard';
import { LoginPage } from './pages/admin/login';
import { OrderDetailPage, OrdersPage } from './pages/admin/orders';
import { PaymentsPage } from './pages/admin/payments';
import { ProductsPage } from './pages/admin/products';
import { SalesPage } from './pages/admin/sales';
import { SettingsPage } from './pages/admin/settings';
import { StatsPage } from './pages/admin/stats';
import { SuppliersPage } from './pages/admin/suppliers';
import { UsersPage } from './pages/admin/users';
import { WeeklyOrdersPage } from './pages/admin/weekly-orders';
import { CartPage } from './pages/store/cart';
import { CatalogPage } from './pages/store/catalog';
import { CheckoutPage } from './pages/store/checkout';
import { ProductDetailPage } from './pages/store/product-detail';
import { OrderTrackingPage, TrackSearchPage } from './pages/store/tracking';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<StoreLayout />}>
                <Route path="/" element={<CatalogPage />} />
                <Route path="/producto/:id" element={<ProductDetailPage />} />
                <Route path="/carrito" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/pedido/:id" element={<OrderTrackingPage confirmation />} />
                <Route path="/seguimiento" element={<TrackSearchPage />} />
                <Route path="/seguimiento/:id" element={<OrderTrackingPage />} />
              </Route>
              <Route path="/admin/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="pedidos" element={<OrdersPage />} />
                  <Route path="pedidos/:id" element={<OrderDetailPage />} />
                  <Route path="pedidos-semanales" element={<WeeklyOrdersPage />} />
                  <Route path="planificacion" element={<Navigate to="/admin/pedidos-semanales" replace />} />
                  <Route path="productos" element={<ProductsPage />} />
                  <Route path="clientes" element={<CustomersPage />} />
                  <Route path="clientes/:id" element={<CustomerDetailPage />} />
                  <Route path="proveedores" element={<SuppliersPage />} />
                  <Route path="ventas" element={<SalesPage />} />
                  <Route path="pagos" element={<PaymentsPage />} />
                  <Route path="estadisticas" element={<StatsPage />} />
                  <Route path="usuarios" element={<UsersPage />} />
                  <Route path="configuracion" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" richColors />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
