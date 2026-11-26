import { supabase } from '../supabaseClient';
import { getTimezone } from '../timezone';
import {
  parseEnvCoord,
  resolveWeatherLocation,
  type WeatherLocation,
} from '../weather/location';
import {
  geocodeCity,
  searchCity,
  type GeocodeResult,
} from '../weather/geocode';
import { fetchForecast, type Forecast } from '../weather/forecast';

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

const ENV_LAT = parseEnvCoord(import.meta.env.VITE_WEATHER_LAT);
const ENV_LON = parseEnvCoord(import.meta.env.VITE_WEATHER_LON);

export const weatherLocationApi = {
  async get(): Promise<WeatherLocation | null> {
    const response = await supabase
      .from('weather_location')
      .select('latitude,longitude,label')
      .eq('id', true)
      .maybeSingle();
    return unwrap<WeatherLocation | null>(response);
  },

  async set(location: WeatherLocation): Promise<WeatherLocation> {
    const response = await supabase
      .from('weather_location')
      .upsert(
        { id: true, ...location, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select('latitude,longitude,label')
      .single();
    return unwrap<WeatherLocation>(response);
  },

  // Resolves the stored row, or the cascade's env/geocode fallback — and,
  // when the cascade had to fall back, persists the result so next time
  // reads the stored row directly.
  async resolve(): Promise<WeatherLocation | null> {
    const stored = await this.get();
    if (stored) return stored;
    const resolved = await resolveWeatherLocation(
      null,
      { latitude: ENV_LAT, longitude: ENV_LON },
      getTimezone(),
      geocodeCity
    );
    if (resolved) await this.set(resolved);
    return resolved;
  },

  searchCity(query: string): Promise<GeocodeResult[]> {
    return searchCity(query);
  },

  async forecast(): Promise<Forecast | null> {
    const location = await this.resolve();
    if (!location) return null;
    return fetchForecast(location.latitude, location.longitude, getTimezone());
  },
};
