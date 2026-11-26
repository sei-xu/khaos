// WMO weather-code -> icon bucket + short pt-BR label. Open-Meteo's
// `weather_code` fields use the WMO code table; this buckets the ~28 codes
// it actually emits into the handful of icons the calendar/digest show.
export type WmoBucket =
  'clear' | 'partly_cloudy' | 'cloud' | 'fog' | 'rain' | 'storm' | 'snow';

const BUCKET_BY_CODE: Record<number, WmoBucket> = {
  0: 'clear',
  1: 'partly_cloudy',
  2: 'partly_cloudy',
  3: 'cloud',
  45: 'fog',
  48: 'fog',
  51: 'rain',
  53: 'rain',
  55: 'rain',
  56: 'rain',
  57: 'rain',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'rain',
  67: 'rain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'storm',
  96: 'storm',
  99: 'storm',
};

const LABEL_BY_BUCKET: Record<WmoBucket, string> = {
  clear: 'Céu limpo',
  partly_cloudy: 'Parcialmente nublado',
  cloud: 'Nublado',
  fog: 'Neblina',
  rain: 'Chuva',
  storm: 'Tempestade',
  snow: 'Neve',
};

export function wmoBucket(code: number | null | undefined): WmoBucket {
  if (code == null) return 'cloud';
  return BUCKET_BY_CODE[code] ?? 'cloud';
}

export function wmoLabel(code: number | null | undefined): string {
  return LABEL_BY_BUCKET[wmoBucket(code)];
}
