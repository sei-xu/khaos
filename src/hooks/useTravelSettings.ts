import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  travelSettingsApi,
  type TravelSettingsInput,
} from '../lib/api/travel';

export function useTravelSettings() {
  return useQuery({
    queryKey: ['travel-settings'],
    queryFn: travelSettingsApi.get,
  });
}

export function useTravelSettingsMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['travel-settings'] });
  return {
    update: useMutation({
      mutationFn: (patch: TravelSettingsInput) =>
        travelSettingsApi.update(patch),
      onSuccess: invalidate,
    }),
  };
}
