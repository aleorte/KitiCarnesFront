import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button, Field, Input } from '../../components/ui';
import { BRAND_NAME } from '../../brand';
import { useAuth } from '../../hooks/use-auth';

const schema = z.object({
  email: z.string().email('Ingresá un email válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <form
        className="w-full max-w-md rounded-3xl bg-cream p-8"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await login(values.email, values.password);
            navigate('/admin');
          } catch (error) {
            form.setError('password', { message: error instanceof Error ? error.message : 'No se pudo ingresar' });
          }
        })}
      >
        <p className="text-xs uppercase tracking-[0.22em] text-blood">{BRAND_NAME}</p>
        <h1 className="mt-2 font-display text-4xl">Entrar al obrador</h1>
        <div className="mt-6 space-y-4">
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register('email')} />
          </Field>
          <Field label="Contraseña" error={form.formState.errors.password?.message}>
            <Input type="password" {...form.register('password')} />
          </Field>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Ingresar
          </Button>
        </div>
      </form>
    </div>
  );
}
