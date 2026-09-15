import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { categoriesApi } from '../../api/services';
import { Button, ConfirmDialog, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import type { Category } from '../../types/api';

const schema = z.object({
  name: z.string().min(2, 'Ingresá un nombre'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CategoryManager() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('categories:manage');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [reassignTo, setReassignTo] = useState('');

  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => categoriesApi.list({ limit: 100 }),
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const items = categories.data?.data ?? [];
  const activeItems = items.filter((category) => category.isActive !== false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    void queryClient.invalidateQueries({ queryKey: ['store-categories'] });
  };

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      editing ? categoriesApi.update(editing.id, values) : categoriesApi.create(values),
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
      const productCount = pendingDelete._count?.products ?? 0;
      return categoriesApi.remove(pendingDelete.id, productCount > 0 ? reassignTo || undefined : undefined);
    },
    onSuccess: () => {
      toast.success('Categoría eliminada');
      refresh();
      setPendingDelete(null);
      setReassignTo('');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openForm = (category?: Category) => {
    setEditing(category ?? null);
    form.reset({ name: category?.name ?? '', description: category?.description ?? '' });
    setOpen(true);
  };

  const productCount = pendingDelete?._count?.products ?? 0;

  return (
    <section className="mb-8 rounded-3xl border border-line bg-cream p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blood">Categorías</p>
          <h2 className="font-display text-2xl">Cortes y elaborados</h2>
          <p className="mt-1 text-sm text-ink-soft/80">Se usan en el mostrador y al cargar productos. No están fijas en el sistema.</p>
        </div>
        {canManage ? <Button onClick={() => openForm()}>Nueva categoría</Button> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.isLoading ? <p className="text-sm text-ink-soft">Cargando categorías...</p> : null}
        {items.map((category) => (
          <article
            key={category.id}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              category.isActive ? 'border-line bg-paper' : 'border-dashed border-line text-ink-soft'
            }`}
          >
            <span>{category.name}</span>
            <span className="text-xs text-ink-soft/70">{category._count?.products ?? 0}</span>
            {canManage ? (
              <>
                <button type="button" className="text-xs text-blood" onClick={() => openForm(category)}>
                  Editar
                </button>
                <button type="button" className="text-xs text-ink-soft" onClick={() => { setPendingDelete(category); setReassignTo(''); }}>
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
        description="El nombre aparece en el mostrador y en el selector de productos."
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
          productCount
            ? `Hay ${productCount} producto(s) en “${pendingDelete?.name}”. Reasignalos para no dejarlos sin categoría.`
            : `¿Eliminar “${pendingDelete?.name}”? Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
        danger
        loading={remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (productCount > 0 && !reassignTo) {
            toast.error('Elegí a qué categoría mover los productos');
            return;
          }
          remove.mutate();
        }}
      >
        {productCount > 0 ? (
          <Field label="Mover productos a">
            <Select value={reassignTo} onChange={(event) => setReassignTo(event.target.value)}>
              <option value="">Elegir categoría</option>
              {activeItems
                .filter((category) => category.id !== pendingDelete?.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </Select>
          </Field>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
