import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BRAND_TAGLINE } from '../../brand';
import { BrandLogo } from '../../components/brand-logo';
import { PriceTag, ProductMedia } from '../../components/commerce';
import { Button, EmptyState, Input, Skeleton } from '../../components/ui';
import { useCart } from '../../hooks/use-cart';
import { useStoreCatalog } from '../../hooks/use-store-catalog';
import { cn, isVariableWeight } from '../../utils/format';
import type { Product } from '../../types/api';

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const { add } = useCart();
  const catalog = useStoreCatalog();
  const categories = catalog.data?.categories ?? [];
  const products = useMemo(() => {
    const all = catalog.data?.products ?? [];
    const needle = search.trim().toLowerCase();
    return all.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        (product.description ?? '').toLowerCase().includes(needle)
      );
    });
  }, [catalog.data?.products, categoryId, search]);

  return (
    <div>
      <section className="border-b border-gold/40 bg-ink text-cream">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 lg:flex-row lg:items-center lg:gap-12 lg:py-14">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-6 text-center md:flex-row md:items-center md:gap-8 md:text-left lg:gap-10">
            <BrandLogo className="h-40 shrink-0 drop-shadow-sm sm:h-44 lg:h-52" size="hero" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">{BRAND_TAGLINE}</p>
              <h1 className="mt-3 font-display text-4xl leading-[0.95] sm:text-5xl lg:text-6xl">
                Carne por kilo,
                <br />
                pedida sin vueltas.
              </h1>
              <p className="mt-4 max-w-md text-sm text-cream/70 sm:text-base">
                Elegí el corte y la cantidad. En los productos por peso, el importe final se calcula con el kilo real al preparar el pedido.
              </p>
            </div>
          </div>
          <form
            className="w-full shrink-0 rounded-3xl border border-gold/50 bg-cream p-4 text-ink shadow-card lg:max-w-sm"
            onSubmit={(e) => e.preventDefault()}
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft/70">Buscar corte</p>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/50" />
              <Input
                className="pl-11"
                placeholder="Buscar asado, vacío, milanesas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setCategoryId('')}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm',
              categoryId === '' ? 'bg-ink text-cream' : 'bg-cream text-ink hover:bg-paper-2',
            )}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm',
                categoryId === category.id ? 'bg-ink text-cream' : 'bg-cream text-ink hover:bg-paper-2',
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        <h2 className="mt-8 font-display text-3xl">Cortes disponibles</h2>
        {catalog.isLoading ? (
          <div className="mt-5 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[26rem]" />
            ))}
          </div>
        ) : products.length ? (
          <div className="mt-5 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, index) => (
              <CatalogCard
                key={product.id}
                product={product}
                priority={index < 3}
                onOrder={() => {
                  add(product, 1);
                  toast.success(`${product.name} agregado al pedido`);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="No hay cortes con esa búsqueda"
              description="Probá con otro nombre o mirá todas las categorías."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogCard({
  product,
  priority,
  onOrder,
}: {
  product: Product;
  priority: boolean;
  onOrder: () => void;
}) {
  const variable = isVariableWeight(product);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-gold/40 bg-cream shadow-card">
      <Link to={`/producto/${product.id}`} className="block shrink-0">
        <ProductMedia product={product} className="aspect-[4/3] w-full" priority={priority} />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/60">{product.category?.name}</p>
        <h3 className="mt-1 line-clamp-2 min-h-14 font-display text-2xl leading-tight">{product.name}</h3>
        <PriceTag product={product} className="mt-3 min-h-24" />
        {variable ? (
          <p className="mt-3 inline-flex min-h-7 w-fit items-center rounded-full bg-gold/30 px-3 text-xs font-semibold text-ink">
            Se pesa al entregar
          </p>
        ) : (
          <div className="mt-3 min-h-7" aria-hidden />
        )}
        <div className="mt-auto flex gap-2 pt-5">
          <Link to={`/producto/${product.id}`} className="flex-1">
            <Button variant="ghost" className="w-full bg-paper">
              Ver
            </Button>
          </Link>
          <Button className="flex-1" onClick={onOrder}>
            Pedir
          </Button>
        </div>
      </div>
    </article>
  );
}
