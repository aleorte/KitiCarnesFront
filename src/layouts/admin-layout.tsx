import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Beef,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { cn } from '../utils/format';

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingCart, permission: 'orders:read' },
  { to: '/admin/pedidos-semanales', label: 'Pedidos semanales', icon: ClipboardList, permission: 'weekly-planning:manage' },
  { to: '/admin/productos', label: 'Productos', icon: Package, permission: 'products:read' },
  { to: '/admin/clientes', label: 'Clientes', icon: Users, permission: 'customers:read' },
  { to: '/admin/proveedores', label: 'Proveedores', icon: Truck, permission: 'suppliers:read' },
  { to: '/admin/ventas', label: 'Ventas', icon: Wallet, permission: 'sales:read' },
  { to: '/admin/pagos', label: 'Pagos', icon: CreditCard, permission: 'payments:read' },
  { to: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3, permission: 'dashboard:read' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users, permission: 'users:manage' },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings, permission: 'dashboard:read' },
];

export function AdminLayout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = nav.filter((item) => hasPermission(item.permission));

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 bg-ink p-5 text-cream transition lg:static lg:w-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blood">
              <Beef className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg leading-none">KitiKitiKiti</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-gold">Gestión</p>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm',
                  isActive ? 'bg-cream/10 text-white' : 'text-cream/70 hover:bg-cream/5',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="mt-8 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-cream/70 hover:bg-cream/5"
          onClick={() => {
            logout();
            navigate('/admin/login');
          }}
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-line bg-cream/80 px-4 py-3 backdrop-blur lg:px-8">
          <button className="rounded-full p-2 hover:bg-paper-2 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm text-ink-soft">
            {user?.firstName} {user?.lastName} · {user?.role === 'ADMIN' ? 'Administración' : 'Equipo'}
          </p>
        </header>
        <div className="px-4 py-6 lg:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
