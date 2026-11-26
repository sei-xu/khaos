import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { weatherLocationApi } from '../../lib/api/weather';
import {
  useWeatherLocation,
  useSetWeatherLocation,
} from '../../hooks/useWeatherLocation';
import type { GeocodeResult } from '../../lib/weather/geocode';
import { Modal, Button } from './ui';

export default function WeatherLocationPicker() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const { data: location } = useWeatherLocation();
  const setLocation = useSetWeatherLocation();

  async function handleSearch(query: string) {
    setSearch(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await weatherLocationApi.searchCity(query));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handlePick(result: GeocodeResult) {
    setLocation.mutate(result, {
      onSuccess: () => {
        setOpen(false);
        setSearch('');
        setResults([]);
      },
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-nyx-700 text-nyx-400 hover:border-nyx-500 hover:text-nyx-200 text-caption flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors"
        title="Change weather location"
      >
        <MapPin size={12} />
        <span className="hidden sm:inline">
          {location?.label ?? 'Set location'}
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setSearch('');
          setResults([]);
        }}
        title="Weather location"
        footer={
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setSearch('');
              setResults([]);
            }}
          >
            Close
          </Button>
        }
      >
        <p className="text-nyx-400 text-body mb-3">
          Used for temperature and rain in the morning digest and calendar.{' '}
          {location && <span className="text-nyx-200">{location.label}</span>}
        </p>
        <input
          autoFocus
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search a city…"
          className="border-nyx-600 bg-nyx-900 text-nyx-100 placeholder:text-nyx-500 focus:border-eros-400 text-body mb-2 w-full rounded border px-3 py-2 focus:outline-hidden"
        />
        <div className="border-nyx-700 max-h-72 overflow-y-auto rounded border">
          {results.map((r, i) => (
            <button
              key={`${r.label}-${i}`}
              onClick={() => handlePick(r)}
              className="hover:bg-nyx-700 text-nyx-200 text-body flex w-full items-center px-3 py-2 text-left transition-colors"
            >
              {r.label}
            </button>
          ))}
          {!searching && search.trim() && !results.length && (
            <p className="text-nyx-600 text-body px-3 py-4">No results</p>
          )}
        </div>
      </Modal>
    </>
  );
}
