import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { usePlaces, usePlaceMutations } from '../hooks/usePlaces';
import {
  useTravelSettings,
  useTravelSettingsMutations,
} from '../hooks/useTravelSettings';
import { TextInput, Select, Button, EmptyState } from '../components/common/ui';
import {
  PLACE_KINDS,
  PLACE_KIND_LABELS,
  TRANSPORT_MODES,
  TRANSPORT_MODE_LABELS,
} from '../lib/constants';
import type { PlaceKind, TransportMode } from '../lib/types';

// Local draft for a numeric settings field: typing only updates state, the
// mutation fires on blur. Keeps the field in sync with the server value
// while untouched, but stops following it once the user starts editing, so
// a mid-edit refetch can't clobber what they're typing (TaskDetailModal's
// draft pattern, src/components/tasks/TaskDetailModal.tsx:433).
function useNumericSettingDraft(value: number) {
  const [draft, setDraft] = useState(String(value));
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setDraft(String(value));
  }, [value]);

  function onChange(next: string) {
    dirtyRef.current = true;
    setDraft(next);
  }

  function flush(commit: (n: number) => void) {
    dirtyRef.current = false;
    commit(Number(draft) || 0);
  }

  return { draft, onChange, flush };
}

export default function PlacesPage() {
  const { data: places = [] } = usePlaces();
  const { create, remove } = usePlaceMutations();
  const { data: settings } = useTravelSettings();
  const { update: updateSettings } = useTravelSettingsMutations();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [kind, setKind] = useState<PlaceKind>('other');

  const arriveEarlyDraft = useNumericSettingDraft(
    settings?.default_arrive_early_minutes ?? 0
  );
  const rainThresholdDraft = useNumericSettingDraft(
    settings?.rain_probability_threshold ?? 0
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), address: address.trim() || null, kind },
      {
        onSuccess: () => {
          setName('');
          setAddress('');
          setKind('other');
        },
      }
    );
  }

  return (
    <div className="px-6 py-5">
      <h1 className="font-display text-nyx-100 mb-1 text-display-lg">
        Places
      </h1>
      <p className="text-nyx-500 mb-5 text-body">
        Home, work, clients — anywhere events or tasks happen. Travel to/from
        a place is computed only once it&apos;s linked to a &lsquo;fixed&rsquo; event.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-5 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_1fr_auto]"
      >
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Home, Acme office)"
        />
        <TextInput
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address (optional)"
        />
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value as PlaceKind)}
        >
          {PLACE_KINDS.map((k) => (
            <option key={k} value={k}>
              {PLACE_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <Button type="submit">
          <Plus size={14} /> Add
        </Button>
      </form>

      {!places.length && (
        <EmptyState
          icon={MapPin}
          title="No places yet"
          hint="Add one above, then link it to an event or task."
        />
      )}

      <div className="divide-nyx-700 border-nyx-700 mb-8 max-w-xl divide-y rounded-lg border">
        {places.map((place) => (
          <div
            key={place.id}
            className="flex items-center justify-between px-4 py-2"
          >
            <div>
              <span className="text-nyx-100 text-body">{place.name}</span>
              <span className="text-nyx-500 ml-2 text-caption">
                {PLACE_KIND_LABELS[place.kind as PlaceKind] ?? place.kind}
              </span>
              {place.address && (
                <p className="text-nyx-500 text-caption">{place.address}</p>
              )}
            </div>
            <button
              onClick={() => {
                if (window.confirm(`Delete place "${place.name}"?`))
                  remove.mutate(place.id);
              }}
              className="text-nyx-500 hover:text-tartarus-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <h2 className="font-display text-nyx-100 mb-1 text-display">
        Travel defaults
      </h2>
      <p className="text-nyx-500 mb-3 text-body">
        Used when an event or its place doesn&apos;t override them.
      </p>
      {settings && (
        <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Home place
            </label>
            <Select
              value={settings.home_place_id ?? ''}
              onChange={(e) =>
                updateSettings.mutate({
                  homePlaceId: e.target.value || null,
                })
              }
              className="w-full"
            >
              <option value="">None</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Default transport
            </label>
            <Select
              value={settings.default_transport_mode}
              onChange={(e) =>
                updateSettings.mutate({
                  defaultTransportMode: e.target.value as TransportMode,
                })
              }
              className="w-full"
            >
              {TRANSPORT_MODES.map((m) => (
                <option key={m} value={m}>
                  {TRANSPORT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Arrive early (minutes)
            </label>
            <TextInput
              type="number"
              min={0}
              value={arriveEarlyDraft.draft}
              onChange={(e) => arriveEarlyDraft.onChange(e.target.value)}
              onBlur={() =>
                arriveEarlyDraft.flush((n) =>
                  updateSettings.mutate({
                    defaultArriveEarlyMinutes: Math.max(0, n),
                  })
                )
              }
            />
          </div>
          <div>
            <label className="text-nyx-400 mb-1 block text-caption font-medium">
              Rain probability threshold (%)
            </label>
            <TextInput
              type="number"
              min={0}
              max={100}
              value={rainThresholdDraft.draft}
              onChange={(e) => rainThresholdDraft.onChange(e.target.value)}
              onBlur={() =>
                rainThresholdDraft.flush((n) =>
                  updateSettings.mutate({
                    rainProbabilityThreshold: Math.min(100, Math.max(0, n)),
                  })
                )
              }
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="text-nyx-300 flex items-center gap-2 text-body">
              <input
                type="checkbox"
                checked={settings.geolocation_checkin_opt_in}
                onChange={(e) =>
                  updateSettings.mutate({
                    geolocationCheckinOptIn: e.target.checked,
                  })
                }
                className="border-nyx-600 bg-nyx-800 accent-eros-500 h-4 w-4 rounded"
              />
              Opportunistic geolocation check-in (app foreground only)
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
