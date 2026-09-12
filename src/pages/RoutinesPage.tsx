import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useRoutines, useRoutineMutations } from '../hooks/useRoutines';
import { useFields } from '../hooks/useHierarchy';
import {
  Modal,
  Button,
  TextInput,
  Select,
  EmptyState,
} from '../components/common/ui';
import RoutineCard from '../components/routines/RoutineCard';
import { FREQUENCY_OPTIONS, TIME_OPTIONS } from '../lib/constants';
import type { NewRoutine, RoutineWithField } from '../lib/types';

interface RoutineForm {
  name: string;
  frequency: string;
  preferred_time: string;
  estimate: string;
  constraints: string;
  field_id: string;
  active: boolean;
}

const EMPTY_FORM: RoutineForm = {
  name: '',
  frequency: '1x_week',
  preferred_time: 'anytime',
  estimate: '',
  constraints: '',
  field_id: '',
  active: true,
};

function formFromRoutine(routine: RoutineWithField): RoutineForm {
  return {
    name: routine.name,
    frequency: routine.frequency,
    preferred_time: routine.preferred_time ?? 'anytime',
    estimate: routine.estimate != null ? String(routine.estimate) : '',
    constraints: routine.constraints ?? '',
    field_id: routine.field_id ?? '',
    active: routine.active,
  };
}

interface RoutineModalProps {
  initial?: RoutineWithField | null;
  onClose: () => void;
  onSave: (payload: NewRoutine) => void;
  saving: boolean;
}

function RoutineModal({ initial, onClose, onSave, saving }: RoutineModalProps) {
  const { data: fields = [] } = useFields();
  const [form, setForm] = useState<RoutineForm>(() =>
    initial ? formFromRoutine(initial) : EMPTY_FORM
  );
  const set = <K extends keyof RoutineForm>(k: K, v: RoutineForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...form,
      name: form.name.trim(),
      constraints: form.constraints.trim() || null,
      estimate: form.estimate ? Number(form.estimate) : null,
      field_id: form.field_id || null,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      onSubmit={handleSubmit}
      title={initial ? 'Edit routine' : 'New routine'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-nyx-400 mb-1 block text-caption font-medium">
            Name
          </label>
          <TextInput
            autoFocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Gym, Change bed sheets"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Frequency
            </label>
            <Select
              value={form.frequency}
              onChange={(e) => set('frequency', e.target.value)}
              className="w-full"
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Preferred time
            </label>
            <Select
              value={form.preferred_time}
              onChange={(e) => set('preferred_time', e.target.value)}
              className="w-full"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Estimate (min)
            </label>
            <TextInput
              type="number"
              min="1"
              value={form.estimate}
              onChange={(e) => set('estimate', e.target.value)}
              placeholder="e.g. 60"
            />
          </div>
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Field (optional)
            </label>
            <Select
              value={form.field_id}
              onChange={(e) => set('field_id', e.target.value)}
              className="w-full"
            >
              <option value="">None</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="text-nyx-400 mb-1 block text-caption font-medium">
            Scheduling notes{' '}
            <span className="text-nyx-600">(the AI reads this)</span>
          </label>
          <textarea
            value={form.constraints}
            onChange={(e) => set('constraints', e.target.value)}
            placeholder="e.g. Can be done while at the gym — laundry room is in the same building area"
            rows={3}
            className="border-nyx-600 bg-nyx-900 text-nyx-100 placeholder:text-nyx-500 focus:border-eros-400 w-full resize-none rounded border px-3 py-2 text-body focus:outline-none"
          />
        </div>

        <label className="text-nyx-300 flex items-center gap-2 text-body">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
            className="border-nyx-600 bg-nyx-800 accent-eros-500 h-4 w-4 rounded"
          />
          Active (included in AI planning)
        </label>
      </form>
    </Modal>
  );
}

export default function RoutinesPage() {
  const { data: routines = [], isLoading } = useRoutines();
  const { create, update, remove } = useRoutineMutations();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoutineWithField | null>(null);

  function handleCreate(payload: NewRoutine) {
    create.mutate(payload, { onSuccess: () => setModalOpen(false) });
  }

  function handleUpdate(payload: NewRoutine) {
    if (!editing) return;
    update.mutate(
      { id: editing.id, patch: payload },
      { onSuccess: () => setEditing(null) }
    );
  }

  function handleDelete(routine: RoutineWithField) {
    if (window.confirm(`Delete routine "${routine.name}"?`)) {
      remove.mutate(routine.id);
    }
  }

  const active = routines.filter((r) => r.active);
  const inactive = routines.filter((r) => !r.active);

  return (
    <div className="mx-auto max-w-2xl px-6 py-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-nyx-100 text-display-lg">Routines</h1>
          <p className="text-nyx-500 mt-0.5 text-body">Ordo ab chao</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} /> New routine
        </Button>
      </div>

      {isLoading && <p className="text-nyx-600 text-body">Loading…</p>}

      {!isLoading && !routines.length && (
        <EmptyState
          icon={RefreshCw}
          title="No routines yet"
          hint='Add your recurring tasks and tell the assistant "plan my week" to schedule them automatically.'
        />
      )}

      {Boolean(active.length) && (
        <div className="space-y-2">
          {active.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onEdit={() => setEditing(routine)}
              onDelete={() => handleDelete(routine)}
              onToggle={() =>
                update.mutate({ id: routine.id, patch: { active: false } })
              }
            />
          ))}
        </div>
      )}

      {Boolean(inactive.length) && (
        <div className="mt-6">
          <p className="text-nyx-600 mb-2 text-caption font-semibold tracking-wide uppercase">
            Inactive
          </p>
          <div className="space-y-2 opacity-50">
            {inactive.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onEdit={() => setEditing(routine)}
                onDelete={() => handleDelete(routine)}
                onToggle={() =>
                  update.mutate({ id: routine.id, patch: { active: true } })
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="border-nyx-700 bg-nyx-800/40 mt-6 rounded-lg border px-4 py-4">
        <p className="text-nyx-300 text-body">
          Tell the assistant{' '}
          <span className="text-eros-400 font-mono">&quot;plan my week&quot;</span> and
          it will schedule all active routines around your fixed events.
        </p>
      </div>

      {modalOpen && (
        <RoutineModal
          onClose={() => setModalOpen(false)}
          onSave={handleCreate}
          saving={create.isPending}
        />
      )}
      {editing && (
        <RoutineModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleUpdate}
          saving={update.isPending}
        />
      )}
    </div>
  );
}
