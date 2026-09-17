import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';

export function SettingsPage() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Configuración" description="Sesión, permisos y acceso al mostrador de Rinde Más Carnes." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl bg-cream p-5">
          <h2 className="font-display text-2xl">Sesión</h2>
          <p className="mt-3">{user?.firstName} {user?.lastName}</p>
          <p className="text-sm text-ink-soft">{user?.email}</p>
          <p className="mt-2 text-sm">Rol {user?.role}</p>
        </section>
        <section className="rounded-3xl bg-cream p-5">
          <h2 className="font-display text-2xl">Tienda pública</h2>
          <p className="mt-3 text-sm text-ink-soft">El mostrador vive en la misma app, sin login, y carga pedidos reales contra `/store`.</p>
          <Link to="/" className="mt-4 inline-block text-blood">Abrir mostrador</Link>
        </section>
        <section className="rounded-3xl bg-cream p-5 md:col-span-2">
          <h2 className="font-display text-2xl">Permisos</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {user?.permissions.map((permission) => (
              <span key={permission} className="rounded-full bg-paper px-3 py-1 text-xs">{permission}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
