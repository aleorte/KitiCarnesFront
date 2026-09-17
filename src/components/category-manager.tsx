import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Paginated } from '../types/api';
import { Button, ConfirmDialog, Field, Input, Modal, Textarea } from './ui';

const schema = z.object({
  name: z.string().min(2, 'Ingresá un nombre'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type CategoryRecord = {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
};

type CategoryApi<T extends CategoryRecord> = {
  list: (params?: Record<string, string | number | boolean | undefined>) => Promise<Paginated<T>>;
  create: (body: Record<string, unknown>) => Promise<T>;
  update: (id: string, body: Record<string, unknown>) => Promise<T>;
  remove: (id: string) => Promise<unknown>;
};

type Props<T extends CategoryRecord> = {
  eyebrow: string;
  title: string;
  description: string;
  canManage: boolean;
  queryKey: string;
  /** Claves de cache a refrescar: lo que cuelga de la categoría también cambia. */
  invalidateKeys: string[];
  api: CategoryApi<T>;
  /** Cuántos registros usan la categoría, para avisar antes de eliminarla. */
  countOf: (category: T) => number;
  /** Cómo llamar a esos registros en los mensajes. */
  linkedNoun: { singular: string; plural: string };
};

/**
 * Gestión de categorías compartida por productos y proveedores. La categoría es
 * opcional en ambos casos: al eliminarla los registros asociados sobreviven sin
 * categoría, nunca se borran ni se bloquea la eliminación.
 */
export function CategoryManager<T extends CategoryRecord>({
  eyebrow,
  title,
  description,
  canManage,
  queryKey,
  invalidateKeys,
  api,
  countOf,
  linkedNoun,
}: Props<T>) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);

  const categories = useQuery({ queryKey: [queryKey], queryFn: () => api.list({ limit: 100 }) });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const items = categories.data?.data ?? [];

  const refresh = () => {
    for (const key of [queryKey, ...invalidateKeys]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      editing ? api.update(editing.id, values) : api.create(values),
    onSuccess: () => {
      toast.success(editing ? 'Categoría actualizada' : 'Categoría creada');
      refresh();
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!pendingDelete) throw new Error('Categoría no seleccionada');
      return api.remove(pendingDelete.id);
    },
    onSuccess: () => {
      const linked = pendingDelete ? countOf(pendingDelete) : 0;
      toast.success(
        linked
          ? `Categoría eliminada. ${linked} ${linked === 1 ? linkedNoun.singular : linkedNoun.plural} quedaron sin categoría.`
          : 'Categoría eliminada',
      );
      refresh();
      setPendingDelete(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openForm = (category?: T) => {
    setEditing(category ?? null);
    form.reset({ name: category?.name ?? '', description: category?.description ?? '' });
    setOpen(true);
  };

  const linkedCount = pendingDelete ? countOf(pendingDelete) : 0;

  return (
    <section className="mb-8 rounded-3xl border border-line bg-cream p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blood">{eyebrow}</p>
          <h2 className="font-display text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-ink-soft/80">{description}</p>
        </div>
        {canManage ? <Button onClick={() => openForm()}>Nueva categoría</Button> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.isLoading ? <p className="text-sm text-ink-soft">Cargando categorías...</p> : null}
        {!categories.isLoading && items.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Todavía no hay categorías. Son opcionales: podés crearlas cuando las necesites.
          </p>
        ) : null}
        {items.map((category) => (
          <article
            key={category.id}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              category.isActive === false
                ? 'border-dashed border-line text-ink-soft'
                : 'border-line bg-paper'
            }`}
          >
            <span>{category.name}</span>
            <span className="text-xs text-ink-soft/70">{countOf(category)}</span>
            {canManage ? (
              <>
                <button type="button" className="text-xs text-blood" onClick={() => openForm(category)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="text-xs text-ink-soft"
                  onClick={() => setPendingDelete(category)}
                >
                  Eliminar
                </button>
              </>
            ) : null}
          </article>
        ))}
      </div>

      <Modal
        open={open}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        description="El nombre se usa en los selectores y filtros."
        onClose={() => setOpen(false)}
        size="sm"
      >
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Field label="Nombre" error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} />
          </Field>
          <Field label="Descripción">
            <Textarea rows={3} {...form.register('description')} />
          </Field>
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar categoría"
        description={
          linkedCount
            ? `“${pendingDelete?.name}” la usan ${linkedCount} ${linkedCount === 1 ? linkedNoun.singular : linkedNoun.plural}. Si la eliminás quedan sin categoría, no se borra ninguno.`
            : `¿Eliminar “${pendingDelete?.name}”? Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
        danger
        loading={remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => remove.mutate()}
      />
    </section>
  );
}
