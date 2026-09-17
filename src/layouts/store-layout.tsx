import { NavLink, Outlet } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';
import { BRAND_NAME } from '../brand';
import { useCart } from '../hooks/use-cart';

const links = [
  { to: '/', label: 'Mostrador' },
  { to: '/seguimiento', label: 'Seguimiento' },
  { to: '/admin/login', label: 'Equipo' },
];

export function StoreLayout() {
  const { items } = useCart();
  const count = items.length;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 md:gap-8">
          <NavLink to="/" className="shrink-0 font-display text-xl leading-none text-ink">
            {BRAND_NAME}
          </NavLink>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className="text-ink-soft hover:text-blood">
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NavLink to="/seguimiento" className="rounded-full p-2 hover:bg-paper-2 md:hidden">
              <Search className="h-5 w-5" />
            </NavLink>
            <NavLink to="/carrito" className="relative rounded-full bg-ink px-4 py-2 text-cream">
              <ShoppingBag className="h-4 w-4" />
              {count > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blood px-1 text-[11px] text-white">
                  {count}
                </span>
              ) : null}
            </NavLink>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-line px-4 py-10 text-center text-sm text-ink-soft/70">
        Cortes por kilo y pedidos del barrio. {BRAND_NAME}.
      </footer>
    </div>
  );
}
