import { describe, it, expect, vi } from 'vitest';
import {
  resolveWeatherLocation,
  cityNameFromTimezone,
  parseEnvCoord,
} from './location';

describe('parseEnvCoord', () => {
  it('reads a numeric coordinate, including 0 and negatives', () => {
    expect(parseEnvCoord('-23.55')).toBe(-23.55);
    expect(parseEnvCoord('0')).toBe(0);
  });

  it('rejects an unset, empty or non-numeric var', () => {
    // .env.example ships VITE_WEATHER_LAT= empty: Number('') would be 0, a
    // valid-looking lat/lon that the callers then persist.
    expect(parseEnvCoord(undefined)).toBeNull();
    expect(parseEnvCoord('')).toBeNull();
    expect(parseEnvCoord('   ')).toBeNull();
    expect(parseEnvCoord('abc')).toBeNull();
  });
});

describe('cityNameFromTimezone', () => {
  it('takes the city segment and replaces underscores with spaces', () => {
    expect(cityNameFromTimezone('America/Sao_Paulo')).toBe('Sao Paulo');
    expect(cityNameFromTimezone('Europe/London')).toBe('London');
  });
});

describe('resolveWeatherLocation', () => {
  it('prefers the stored row when present', async () => {
    const geocode = vi.fn();
    const result = await resolveWeatherLocation(
      { latitude: 1, longitude: 2, label: 'Stored' },
      { latitude: 9, longitude: 9 },
      'America/Sao_Paulo',
      geocode
    );
    expect(result).toEqual({ latitude: 1, longitude: 2, label: 'Stored' });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('falls back to env vars when nothing is stored', async () => {
    const geocode = vi.fn();
    const result = await resolveWeatherLocation(
      null,
      { latitude: 5, longitude: 6 },
      'America/Sao_Paulo',
      geocode
    );
    expect(result).toEqual({ latitude: 5, longitude: 6, label: 'Sao Paulo' });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('geocodes the timezone city as a last resort', async () => {
    const geocode = vi
      .fn()
      .mockResolvedValue({ latitude: 3, longitude: 4, label: 'Geo' });
    const result = await resolveWeatherLocation(
      null,
      { latitude: null, longitude: null },
      'America/Sao_Paulo',
      geocode
    );
    expect(geocode).toHaveBeenCalledWith('Sao Paulo');
    expect(result).toEqual({ latitude: 3, longitude: 4, label: 'Geo' });
  });
});
