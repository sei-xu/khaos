// Pure fetch + normalization layer over Open-Meteo's /v1/forecast — no
// browser/Deno globals beyond the ambient `fetch`, so this module runs
// unchanged in the browser app and in the telegram-notify Edge Function
// (imported by relative path, same pattern as src/lib/chat/*Core.ts — see
// supabase/functions/_shared/khaos.ts).
//
// No API key: api.open-meteo.com/v1/forecast responds 200 with
// access-control-allow-origin: * (verified by curl), a 7-day hourly+daily
// horizon, and a 600 req/min limit — see docs/backlog.md for the item this
// was built under.

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'weather_code',
] as const;

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'precipitation_sum',
  'sunrise',
  'sunset',
] as const;

export interface RawForecastPayload {
  timezone?: string;
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    apparent_temperature?: (number | null)[];
    precipitation_probability?: (number | null)[];
    precipitation?: (number | null)[];
    weather_code?: (number | null)[];
  };
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
    sunrise?: (string | null)[];
    sunset?: (string | null)[];
  };
}

export interface HourPoint {
  time: string; // local "YYYY-MM-DDTHH:mm", in the forecast's own timezone
  temperature: number | null;
  apparentTemperature: number | null;
  precipitationProbability: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
}

export interface DayForecast {
  date: string; // "YYYY-MM-DD"
  weatherCode: number | null;
  tempMin: number | null;
  tempMax: number | null;
  precipitationProbabilityMax: number | null;
  precipitationSum: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface Forecast {
  hours: HourPoint[];
  days: DayForecast[];
}

export function buildForecastUrl(
  latitude: number,
  longitude: number,
  timezone: string
): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    hourly: HOURLY_FIELDS.join(','),
    daily: DAILY_FIELDS.join(','),
  });
  return `${BASE_URL}?${params.toString()}`;
}

function at<T>(arr: (T | null)[] | undefined, i: number): T | null {
  const v = arr?.[i];
  return v === undefined ? null : v;
}

export function normalizeForecast(raw: RawForecastPayload): Forecast {
  const times = raw.hourly?.time ?? [];
  const hours: HourPoint[] = times.map((time, i) => ({
    time,
    temperature: at(raw.hourly?.temperature_2m, i),
    apparentTemperature: at(raw.hourly?.apparent_temperature, i),
    precipitationProbability: at(raw.hourly?.precipitation_probability, i),
    precipitationMm: at(raw.hourly?.precipitation, i),
    weatherCode: at(raw.hourly?.weather_code, i),
  }));

  const dayTimes = raw.daily?.time ?? [];
  const days: DayForecast[] = dayTimes.map((date, i) => ({
    date,
    weatherCode: at(raw.daily?.weather_code, i),
    tempMin: at(raw.daily?.temperature_2m_min, i),
    tempMax: at(raw.daily?.temperature_2m_max, i),
    precipitationProbabilityMax: at(
      raw.daily?.precipitation_probability_max,
      i
    ),
    precipitationSum: at(raw.daily?.precipitation_sum, i),
    sunrise: at(raw.daily?.sunrise, i),
    sunset: at(raw.daily?.sunset, i),
  }));

  return { hours, days };
}

export function getDayForecast(
  forecast: Forecast,
  date: string
): DayForecast | null {
  return forecast.days.find((d) => d.date === date) ?? null;
}

export function getHoursForDate(forecast: Forecast, date: string): HourPoint[] {
  return forecast.hours.filter((h) => h.time.startsWith(date));
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
  timezone: string
): Promise<Forecast> {
  const res = await fetch(buildForecastUrl(latitude, longitude, timezone));
  if (!res.ok) {
    throw new Error(`open-meteo forecast failed: ${res.status}`);
  }
  const raw = (await res.json()) as RawForecastPayload;
  return normalizeForecast(raw);
}
