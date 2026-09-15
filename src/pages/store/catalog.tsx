import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { storeApi } from '../../api/services';
import { PriceTag, ProductMedia } from '../../components/commerce';
import { Button, EmptyState, Input, Skeleton } from '../../components/ui';
import { useCart } from '../../hooks/use-cart';

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const { add } = useCart();
  const categories = useQuery({ queryKey: ['store-categories'], queryFn: storeApi.categories });
  const products = useQuery({
    queryKey: ['store-products', search, categoryId],
    queryFn: () => storeApi.products({ search: search || undefined, categoryId: categoryId || undefined }),
  });

  const featured = useMemo(() => products.data?.slice(0, 3) ?? [], [products.data]);

  return (
    <div>
      <section className="border-b border-line bg-ink text-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Mostrador del barrio</p>
            <h1 className="mt-4 font-display text-5xl leading-[0.95] sm:text-6xl">
              Carne por kilo,
              <br />
              pedida sin vueltas.
            </h1>
            <p className="mt-5 max-w-md text-cream/70">
              Elegí el corte, indicá los kilos y reservá entrega. El precio final se ajusta al peso real preparado.
            </p>
          </div>
          <form className="rounded-3xl bg-cream p-4 text-ink" onSubmit={(e) => e.preventDefault()}>
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
            className={`rounded-full px-4 py-2 text-sm ${categoryId === '' ? 'bg-ink text-cream' : 'bg-cream'}`}
          >
            Todos
          </button>
          {categories.data?.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              className={`rounded-full px-4 py-2 text-sm ${categoryId === category.id ? 'bg-ink text-cream' : 'bg-cream'}`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {featured.length > 0 && !search && !categoryId ? (
          <div className="mt-10">
            <h2 className="font-display text-3xl">Destacados del día</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {featured.map((product) => (
                <Link key={product.id} to={`/producto/${product.id}`} className="group overflow-hidden rounded-3xl bg-cream">
                  <ProductMedia product={product} className="h-48 w-full transition group-hover:scale-[1.03]" />
                  <div className="p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-blood">{product.category?.name}</p>
                    <h3 className="mt-1 font-display text-2xl">{product.name}</h3>
                    <PriceTag product={product} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <h2 className="mt-12 font-display text-3xl">Cortes disponibles</h2>
        {products.isLoading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : products.data?.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.data.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-3xl bg-cream">
                <Link to={`/producto/${product.id}`}>
                  <ProductMedia product={product} className="h-44 w-full" />
                </Link>
                <div className="space-y-4 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/60">{product.category?.name}</p>
                    <h3 className="font-display text-2xl">{product.name}</h3>
                    <PriceTag product={product} />
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/producto/${product.id}`} className="flex-1">
                      <Button variant="ghost" className="w-full bg-paper">
                        Ver
                      </Button>
                    </Link>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        add(product, product.saleUnit === 'KILOGRAM' ? 1 : 1);
                        toast.success(`${product.name} agregado al pedido`);
                      }}
                    >
                      Pedir
                    </Button>
                  </div>
                </div>
              </article>
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
