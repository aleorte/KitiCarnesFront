import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../utils/format';

const tabs = [
  { to: '/admin/proveedores', label: 'Proveedores', end: true },
  { to: '/admin/proveedores/pedidos', label: 'Pedidos', end: false },
];

export function SuppliersSectionLayout() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold',
                isActive ? 'bg-ink text-cream' : 'bg-cream text-ink hover:bg-paper-2',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
