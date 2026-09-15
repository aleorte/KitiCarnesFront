import { NavLink, Outlet } from 'react-router-dom';
import { Beef, Search, ShoppingBag } from 'lucide-react';
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-gold">
              <Beef className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-xl leading-none">KitiKitiKiti</span>
              <span className="text-[11px] uppercase tracking-[0.22em] text-ink-soft/70">Carnicería</span>
            </span>
          </NavLink>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className="text-ink-soft hover:text-blood">
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
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
        Cortes por kilo, pedidos con hora y un mostrador pensado para el barrio.
      </footer>
    </div>
  );
}
