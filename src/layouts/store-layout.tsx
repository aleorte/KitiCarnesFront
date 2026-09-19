import { NavLink, Outlet } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../api/services';
import { BRAND_NAME } from '../brand';
import { WhatsAppIcon } from '../components/whatsapp-button';
import { useCart } from '../hooks/use-cart';
import { openWhatsApp } from '../utils/whatsapp';

const links = [
  { to: '/', label: 'Mostrador' },
  { to: '/seguimiento', label: 'Seguimiento' },
  { to: '/admin/login', label: 'Equipo' },
];

export function StoreLayout() {
  const { items } = useCart();
  const count = items.length;
  const contact = useQuery({
    queryKey: ['store-contact'],
    queryFn: storeApi.contact,
    staleTime: 5 * 60 * 1000,
  });
  const shopWhatsApp = contact.data?.whatsappPhone;

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
      {shopWhatsApp ? (
        <button
          type="button"
          aria-label="Contactar por WhatsApp"
          title="Contactar por WhatsApp"
          onClick={() =>
            openWhatsApp(
              shopWhatsApp,
              `Hola, quiero hacer una consulta a ${BRAND_NAME}.`,
            )
          }
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-ink/20 transition hover:scale-105"
        >
          <WhatsAppIcon className="h-8 w-8" />
        </button>
      ) : null}
    </div>
  );
}
