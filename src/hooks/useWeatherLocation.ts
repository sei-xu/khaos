import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { weatherLocationApi } from '../lib/api/weather';
import type { WeatherLocation } from '../lib/weather/location';

export function useWeatherLocation() {
  return useQuery({
    queryKey: ['weather-location'],
    queryFn: () => weatherLocationApi.resolve(),
  });
}

export function useSetWeatherLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (location: WeatherLocation) => weatherLocationApi.set(location),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weather-location'] }),
  });
}

export function useWeatherForecast() {
  const { data: location } = useWeatherLocation();
  return useQuery({
    queryKey: ['weather-forecast', location?.latitude, location?.longitude],
    queryFn: () => weatherLocationApi.forecast(),
    enabled: Boolean(location),
    // The hourly/daily forecast doesn't change minute to minute — refresh
    // on the same cadence as the Google Calendar sync status check.
    refetchInterval: 15 * 60 * 1000,
  });
}
