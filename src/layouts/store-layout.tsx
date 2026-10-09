import { NavLink, Outlet } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../api/services';
import { BRAND_NAME, BRAND_TAGLINE } from '../brand';
import { BrandLogo } from '../components/brand-logo';
import { WhatsAppIcon } from '../components/whatsapp-button';
import { useCart } from '../hooks/use-cart';
import { useStoreCatalog } from '../hooks/use-store-catalog';
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
  useStoreCatalog();
  const shopWhatsApp = contact.data?.whatsappPhone;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-gold/50 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:gap-8">
          <NavLink to="/" className="flex shrink-0 items-center gap-3 text-ink">
            <BrandLogo size="sm" />
            <span className="hidden font-display text-xl leading-none sm:inline">{BRAND_NAME}</span>
          </NavLink>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive ? 'text-blood' : 'text-ink-soft hover:text-blood'
                }
              >
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
      <footer className="mt-16 border-t border-gold/40 bg-ink px-4 py-12 text-center text-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4">
          <div className="rounded-2xl bg-cream px-4 py-3">
            <BrandLogo size="md" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">{BRAND_TAGLINE}</p>
          <p className="text-sm text-cream/70">Cortes por kilo y pedidos del barrio. {BRAND_NAME}.</p>
        </div>
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
