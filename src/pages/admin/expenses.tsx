import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { expensesApi, usersApi } from '../../api/services';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../hooks/use-auth';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_STATUS_LABEL,
  type Expense,
  type ExpenseCategory,
  type ExpenseReimbursementStatus,
} from '../../types/api';
import { dateOnly, formatDate, formatMoney } from '../../utils/format';

const expenseSchema = z.object({
  memberId: z.string().min(1, 'Elegí el integrante'),
  description: z.string().min(2, 'Indicá qué se pagó'),
  category: z.enum([
    'PROVEEDORES',
    'PUBLICIDAD',
    'LOGISTICA',
    'ADMINISTRACION',
    'BIENES_DE_TRABAJO',
  ]),
  amount: z.string().min(1, 'Ingresá el monto'),
  incurredAt: z.string().min(1, 'Ingresá la fecha'),
});

const reimbursementSchema = z.object({
  amount: z.string().min(1, 'Ingresá el monto'),
  reimbursedAt: z.string().min(1, 'Ingresá la fecha'),
  notes: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;
type ReimbursementForm = z.infer<typeof reimbursementSchema>;

function memberName(member: { firstName: string; lastName: string }) {
  return `${member.firstName} ${member.lastName}`.trim();
}

function statusTone(status: ExpenseReimbursementStatus) {
  if (status === 'REINTEGRADO') return 'ok' as const;
  if (status === 'PARCIAL') return 'gold' as const;
  return 'warn' as const;
}

function toDateInput(value: string) {
  return value.slice(0, 10);
}

export function ExpensesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('expenses:manage');
  const [memberId, setMemberId] = useState('');
  const [status, setStatus] = useState('');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [reimbursing, setReimbursing] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

  const filterParams = {
    memberId: memberId || undefined,
    status: status || undefined,
    category: categories.length ? categories : undefined,
  };
  const summary = useQuery({
    queryKey: ['expenses-summary', memberId, status, categories],
    queryFn: () => expensesApi.summary(filterParams),
  });
  const expenses = useQuery({
    queryKey: ['expenses', memberId, status, categories],
    queryFn: () =>
      expensesApi.list({
        limit: 100,
        ...filterParams,
      }),
  });
  const users = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: canManage,
  });

  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      memberId: '',
      description: '',
      category: 'ADMINISTRACION',
      amount: '',
      incurredAt: dateOnly(),
    },
  });
  const reimbursementForm = useForm<ReimbursementForm>({
    resolver: zodResolver(reimbursementSchema),
    defaultValues: { amount: '', reimbursedAt: dateOnly(), notes: '' },
  });

  const activeMembers = useMemo(() => {
    const list = (users.data?.data ?? []).filter((user) => user.isActive);
    if (editing && !list.some((user) => user.id === editing.memberId)) {
      list.push(editing.member);
    }
    return list;
  }, [editing, users.data]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    void queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
  };

  const saveExpense = useMutation({
    mutationFn: (values: ExpenseForm) =>
      editing
        ? expensesApi.update(editing.id, values)
        : expensesApi.create(values),
    onSuccess: () => {
      toast.success(editing ? 'Gasto actualizado' : 'Gasto registrado');
      refresh();
      setFormOpen(false);
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveReimbursement = useMutation({
    mutationFn: (values: ReimbursementForm) =>
      expensesApi.reimburse(reimbursing!.id, {
        amount: values.amount,
        reimbursedAt: values.reimbursedAt,
        notes: values.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Reintegro registrado');
      refresh();
      setReimbursing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeExpense = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      toast.success('Gasto eliminado');
      refresh();
      setPendingDelete(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditing(null);
    expenseForm.reset({
      memberId: memberId || activeMembers[0]?.id || '',
      description: '',
      category: 'ADMINISTRACION',
      amount: '',
      incurredAt: dateOnly(),
    });
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    expenseForm.reset({
      memberId: expense.memberId,
      description: expense.description,
      category: expense.category,
      amount: expense.amount,
      incurredAt: toDateInput(expense.incurredAt),
    });
    setFormOpen(true);
  };

  const openReimburse = (expense: Expense) => {
    setReimbursing(expense);
    reimbursementForm.reset({
      amount: expense.pendingBalance,
      reimbursedAt: dateOnly(),
      notes: '',
    });
  };

  if (!hasPermission('expenses:read')) {
    return <p>No tenés acceso a los gastos de la administración.</p>;
  }

  return (
    <div>
      <PageHeader
        title="Gastos"
        description="Plata que cada integrante pone de su bolsillo para el negocio, y cuánto ya se le devolvió."
        actions={canManage ? <Button onClick={openCreate}>Registrar gasto</Button> : null}
      />

      {summary.isLoading ? (
        <Skeleton className="mb-6 h-28" />
      ) : summary.data ? (
        <div className="mb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft/70">
            {summary.data.filtered ? 'Totales de la selección' : 'Totales generales'}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-3xl bg-cream p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Total gastado</p>
              <p className="font-display text-3xl">{formatMoney(summary.data.spentTotal)}</p>
            </article>
            <article className="rounded-3xl bg-cream p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Total reintegrado</p>
              <p className="font-display text-3xl">{formatMoney(summary.data.reimbursedTotal)}</p>
            </article>
            <article className="rounded-3xl bg-gold/20 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/70">Pendiente de devolver</p>
              <p className="font-display text-3xl">{formatMoney(summary.data.pendingBalance)}</p>
            </article>
          </div>
          {summary.data.filtered ? (
            <p className="mt-3 text-sm text-ink-soft">
              Todos los gastos: gastado {formatMoney(summary.data.overall.spentTotal)} · reintegrado{' '}
              {formatMoney(summary.data.overall.reimbursedTotal)} · pendiente{' '}
              {formatMoney(summary.data.overall.pendingBalance)}
            </p>
          ) : null}
        </div>
      ) : null}

      {summary.data?.members.length ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summary.data.members.map((item) => {
            const selected = memberId === item.member.id;
            return (
              <button
                key={item.member.id}
                type="button"
                onClick={() => setMemberId(selected ? '' : item.member.id)}
                className={`rounded-3xl p-5 text-left transition ${
                  selected ? 'bg-ink text-cream' : 'bg-cream hover:bg-paper-2'
                }`}
              >
                <p className="font-display text-2xl">{memberName(item.member)}</p>
                <dl className={`mt-3 space-y-1 text-sm ${selected ? 'text-cream/80' : 'text-ink-soft'}`}>
                  <div className="flex justify-between gap-3">
                    <dt>Gastó</dt>
                    <dd className="font-semibold">{formatMoney(item.spentTotal)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Reintegrado</dt>
                    <dd className="font-semibold">{formatMoney(item.reimbursedTotal)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Pendiente</dt>
                    <dd className="font-semibold">{formatMoney(item.pendingBalance)}</dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft/70">Filtrar por categoría</p>
          {memberId || status || categories.length ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-3"
              onClick={() => {
                setMemberId('');
                setStatus('');
                setCategories([]);
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((category) => {
            const selected = categories.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setCategories((current) =>
                    selected ? current.filter((item) => item !== category) : [...current, category],
                  )
                }
                className={`min-h-11 rounded-full px-3 text-sm font-semibold transition ${
                  selected ? 'bg-ink text-cream' : 'bg-cream text-ink-soft hover:bg-paper-2'
                }`}
              >
                {EXPENSE_CATEGORY_LABEL[category]}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select className="min-h-12" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="">Todos los integrantes</option>
            {(summary.data?.members ?? []).map((item) => (
              <option key={item.member.id} value={item.member.id}>
                {memberName(item.member)}
              </option>
            ))}
          </Select>
          <Select className="min-h-12" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(EXPENSE_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {expenses.isLoading ? (
        <Skeleton className="h-72" />
      ) : expenses.data?.data.length ? (
        <div className="space-y-3">
          {expenses.data.data.map((expense) => (
            <article key={expense.id} className="rounded-3xl bg-cream p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-soft/60">
                    {memberName(expense.member)} · {formatDate(expense.incurredAt)}
                  </p>
                  <h2 className="font-display text-2xl">{expense.description}</h2>
                  <p className="mt-1 text-sm font-medium text-ink-soft">
                    {EXPENSE_CATEGORY_LABEL[expense.category]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl">{formatMoney(expense.amount)}</p>
                  <Badge tone={statusTone(expense.status)}>{EXPENSE_STATUS_LABEL[expense.status]}</Badge>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                Reintegrado {formatMoney(expense.reimbursedTotal)} · Pendiente{' '}
                <strong>{formatMoney(expense.pendingBalance)}</strong>
              </p>
              {expense.reimbursements.length ? (
                <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                  {expense.reimbursements.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>Reintegro {formatDate(item.reimbursedAt)}</span>
                      <span>{formatMoney(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {Number(expense.pendingBalance) > 0 ? (
                    <Button variant="secondary" onClick={() => openReimburse(expense)}>
                      Registrar reintegro
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => openEdit(expense)}>
                    Editar
                  </Button>
                  <Button variant="danger" onClick={() => setPendingDelete(expense)}>
                    Eliminar
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={categories.length || memberId || status ? 'No hay gastos con esos filtros' : 'Todavía no hay gastos'}
          description={
            categories.length || memberId || status
              ? 'Probá limpiar los filtros o elegir otras categorías.'
              : 'Cuando un integrante ponga plata de su bolsillo, registralo acá para saber cuánto hay que devolverle.'
          }
          action={canManage ? <Button onClick={openCreate}>Registrar gasto</Button> : null}
        />
      )}

      <Modal
        open={formOpen}
        title={editing ? 'Editar gasto' : 'Nuevo gasto'}
        description="El integrante es quien puso el dinero. No se escribe el nombre a mano: se elige de los usuarios de la administración."
        onClose={() => setFormOpen(false)}
      >
        <form className="space-y-3" onSubmit={expenseForm.handleSubmit((values) => saveExpense.mutate(values))}>
          <Field label="Integrante" error={expenseForm.formState.errors.memberId?.message}>
            <Select {...expenseForm.register('memberId')}>
              <option value="">Elegí un integrante</option>
              {activeMembers.map((user) => (
                <option key={user.id} value={user.id}>
                  {memberName(user)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descripción" error={expenseForm.formState.errors.description?.message}>
            <Textarea rows={3} {...expenseForm.register('description')} />
          </Field>
          <Field label="Categoría" error={expenseForm.formState.errors.category?.message}>
            <Select className="min-h-12" {...expenseForm.register('category')}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EXPENSE_CATEGORY_LABEL[category]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Monto" error={expenseForm.formState.errors.amount?.message}>
            <Input inputMode="decimal" {...expenseForm.register('amount')} />
          </Field>
          <Field label="Fecha" error={expenseForm.formState.errors.incurredAt?.message}>
            <Input type="date" {...expenseForm.register('incurredAt')} />
          </Field>
          <Button type="submit" className="w-full" disabled={saveExpense.isPending}>
            {saveExpense.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(reimbursing)}
        title="Registrar reintegro"
        description={
          reimbursing
            ? `Se le debe ${formatMoney(reimbursing.pendingBalance)} a ${memberName(reimbursing.member)} por este gasto.`
            : undefined
        }
        onClose={() => setReimbursing(null)}
      >
        <form
          className="space-y-3"
          onSubmit={reimbursementForm.handleSubmit((values) => saveReimbursement.mutate(values))}
        >
          <Field label="Monto a devolver" error={reimbursementForm.formState.errors.amount?.message}>
            <Input inputMode="decimal" {...reimbursementForm.register('amount')} />
          </Field>
          <Field label="Fecha" error={reimbursementForm.formState.errors.reimbursedAt?.message}>
            <Input type="date" {...reimbursementForm.register('reimbursedAt')} />
          </Field>
          <Field label="Nota (opcional)">
            <Input {...reimbursementForm.register('notes')} />
          </Field>
          <Button type="submit" className="w-full" disabled={saveReimbursement.isPending}>
            {saveReimbursement.isPending ? 'Guardando...' : 'Guardar reintegro'}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar gasto"
        description={
          pendingDelete?.reimbursements.length
            ? 'Este gasto tiene reintegros. Se van a borrar el gasto y su historial de devoluciones.'
            : 'Se va a eliminar este gasto. Esta acción no se puede deshacer.'
        }
        confirmLabel="Eliminar"
        danger
        loading={removeExpense.isPending}
        onConfirm={() => pendingDelete && removeExpense.mutate(pendingDelete.id)}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
