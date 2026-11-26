// Location resolution cascade, shared by the browser app and the
// telegram-notify Edge Function: a stored row wins, then env vars, then
// geocoding the configured timezone's city (and the caller persists that
// result so later calls skip straight to the stored row). Pure aside from
// the injected `geocode` call, so it needs no DB/env import of its own.
import { geocodeCity, type GeocodeResult } from './geocode';

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export interface StoredLocationRow extends WeatherLocation {
  id?: boolean;
  updated_at?: string;
}

export interface EnvLocation {
  latitude: number | null;
  longitude: number | null;
}

// "America/Sao_Paulo" -> "Sao Paulo" (same rule as TimezonePicker's city
// label), used as the geocoding query of last resort.
export function cityNameFromTimezone(timezone: string): string {
  return (timezone.split('/').pop() ?? timezone).replace(/_/g, ' ');
}

export async function resolveWeatherLocation(
  stored: StoredLocationRow | null,
  env: EnvLocation,
  timezone: string,
  geocode: (query: string) => Promise<GeocodeResult | null> = geocodeCity
): Promise<WeatherLocation | null> {
  if (stored) {
    return {
      latitude: stored.latitude,
      longitude: stored.longitude,
      label: stored.label,
    };
  }
  if (env.latitude != null && env.longitude != null) {
    return {
      latitude: env.latitude,
      longitude: env.longitude,
      label: cityNameFromTimezone(timezone),
    };
  }
  return geocode(cityNameFromTimezone(timezone));
}
