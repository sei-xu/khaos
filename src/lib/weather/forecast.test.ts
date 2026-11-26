import { describe, it, expect } from 'vitest';
import {
  buildForecastUrl,
  normalizeForecast,
  getDayForecast,
  getHoursForDate,
  type RawForecastPayload,
} from './forecast';

// Fixture shaped like a real Open-Meteo /v1/forecast response (verified by
// curl against api.open-meteo.com during investigation), trimmed to two
// days / a handful of hours — the normalizer doesn't care about volume.
function fixture(): RawForecastPayload {
  return {
    timezone: 'America/Sao_Paulo',
    hourly: {
      time: [
        '2026-11-26T00:00',
        '2026-11-26T01:00',
        '2026-11-26T12:00',
        '2026-11-26T13:00',
        '2026-11-27T00:00',
      ],
      temperature_2m: [18.2, 17.8, 26.4, 27.1, 19.0],
      apparent_temperature: [17.5, 17.0, 29.2, 30.0, 18.4],
      precipitation_probability: [10, 5, 60, 70, 0],
      precipitation: [0, 0, 1.2, 2.4, 0],
      weather_code: [1, 1, 61, 63, 0],
    },
    daily: {
      time: ['2026-11-26', '2026-11-27'],
      weather_code: [61, 0],
      temperature_2m_max: [27.1, 25.0],
      temperature_2m_min: [17.8, 16.0],
      precipitation_probability_max: [70, 0],
      precipitation_sum: [3.6, 0],
      sunrise: ['2026-11-26T05:48', '2026-11-27T05:48'],
      sunset: ['2026-11-26T19:10', '2026-11-27T19:10'],
    },
  };
}

describe('buildForecastUrl', () => {
  it('includes coordinates, timezone and the hourly/daily fields', () => {
    const url = buildForecastUrl(-23.55, -46.63, 'America/Sao_Paulo');
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('latitude=-23.55');
    expect(url).toContain('longitude=-46.63');
    expect(url).toContain('timezone=America%2FSao_Paulo');
    expect(url).toContain('temperature_2m');
    expect(url).toContain('precipitation_probability');
  });
});

describe('normalizeForecast', () => {
  it('converts the raw payload into HourPoint/DayForecast arrays', () => {
    const forecast = normalizeForecast(fixture());
    expect(forecast.hours).toHaveLength(5);
    expect(forecast.hours[2]).toEqual({
      time: '2026-11-26T12:00',
      temperature: 26.4,
      apparentTemperature: 29.2,
      precipitationProbability: 60,
      precipitationMm: 1.2,
      weatherCode: 61,
    });
    expect(forecast.days).toHaveLength(2);
    expect(forecast.days[0]).toEqual({
      date: '2026-11-26',
      weatherCode: 61,
      tempMin: 17.8,
      tempMax: 27.1,
      precipitationProbabilityMax: 70,
      precipitationSum: 3.6,
      sunrise: '2026-11-26T05:48',
      sunset: '2026-11-26T19:10',
    });
  });

  it('handles a short payload with missing arrays as empty, not a crash', () => {
    const forecast = normalizeForecast({ timezone: 'UTC' });
    expect(forecast.hours).toEqual([]);
    expect(forecast.days).toEqual([]);
  });

  it('passes through a null in the middle of a series instead of coercing it', () => {
    const raw = fixture();
    raw.hourly!.temperature_2m![2] = null;
    const forecast = normalizeForecast(raw);
    expect(forecast.hours[2].temperature).toBeNull();
  });
});

describe('getDayForecast / getHoursForDate', () => {
  it('returns the matching day and its hours', () => {
    const forecast = normalizeForecast(fixture());
    const day = getDayForecast(forecast, '2026-11-26');
    expect(day?.tempMax).toBe(27.1);
    const hours = getHoursForDate(forecast, '2026-11-26');
    expect(hours).toHaveLength(4);
    expect(hours.every((h) => h.time.startsWith('2026-11-26'))).toBe(true);
  });

  it('returns null/empty for a date outside the forecast horizon, never invented data', () => {
    const forecast = normalizeForecast(fixture());
    expect(getDayForecast(forecast, '2026-12-25')).toBeNull();
    expect(getHoursForDate(forecast, '2026-12-25')).toEqual([]);
  });
});
