import { describe, it, expect } from 'vitest';
import { wmoBucket, wmoLabel } from './wmo';

describe('wmoBucket', () => {
  it('maps each bucket from a representative code', () => {
    expect(wmoBucket(0)).toBe('clear');
    expect(wmoBucket(1)).toBe('partly_cloudy');
    expect(wmoBucket(3)).toBe('cloud');
    expect(wmoBucket(45)).toBe('fog');
    expect(wmoBucket(61)).toBe('rain');
    expect(wmoBucket(82)).toBe('rain');
    expect(wmoBucket(95)).toBe('storm');
    expect(wmoBucket(73)).toBe('snow');
  });

  it('falls back to cloud for an unknown or missing code', () => {
    expect(wmoBucket(12345)).toBe('cloud');
    expect(wmoBucket(null)).toBe('cloud');
    expect(wmoBucket(undefined)).toBe('cloud');
  });
});

describe('wmoLabel', () => {
  it('returns a pt-BR label per bucket', () => {
    expect(wmoLabel(0)).toBe('Céu limpo');
    expect(wmoLabel(61)).toBe('Chuva');
    expect(wmoLabel(95)).toBe('Tempestade');
  });
});
