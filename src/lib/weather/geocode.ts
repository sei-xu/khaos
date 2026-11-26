// Open-Meteo's geocoding API — same no-key, CORS-open provider as
// forecast.ts, used both by the city picker (search-by-name) and by the
// location resolution cascade's last resort (geocode the configured
// timezone's city).
const BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

interface RawGeocodeResponse {
  results?: {
    latitude: number;
    longitude: number;
    name: string;
    admin1?: string;
    country?: string;
  }[];
}

function toLabel(r: {
  name: string;
  admin1?: string;
  country?: string;
}): string {
  return [r.name, r.country].filter(Boolean).join(', ');
}

export function buildGeocodeUrl(query: string, count = 5): string {
  const params = new URLSearchParams({
    name: query,
    count: String(count),
    language: 'pt',
    format: 'json',
  });
  return `${BASE_URL}?${params.toString()}`;
}

export function normalizeGeocodeResults(
  raw: RawGeocodeResponse
): GeocodeResult[] {
  return (raw.results ?? []).map((r) => ({
    latitude: r.latitude,
    longitude: r.longitude,
    label: toLabel(r),
  }));
}

export async function searchCity(
  query: string,
  count = 5
): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(buildGeocodeUrl(query, count));
  if (!res.ok) throw new Error(`open-meteo geocoding failed: ${res.status}`);
  const raw = (await res.json()) as RawGeocodeResponse;
  return normalizeGeocodeResults(raw);
}

// First match only, for the resolution cascade's unattended fallback.
export async function geocodeCity(
  query: string
): Promise<GeocodeResult | null> {
  const results = await searchCity(query, 1);
  return results[0] ?? null;
}
