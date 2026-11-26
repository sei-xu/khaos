import { supabase } from '../supabaseClient';
import type { Id, TransportMode, TravelSettings, TravelSettingsPatch } from '../types';

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export interface TravelSettingsInput {
  homePlaceId?: Id | null;
  defaultTransportMode?: TransportMode;
  defaultArriveEarlyMinutes?: number;
  rainProbabilityThreshold?: number;
  geolocationCheckinOptIn?: boolean;
}

const DEFAULTS: TravelSettings = {
  id: true,
  home_place_id: null,
  default_transport_mode: 'drive',
  default_arrive_early_minutes: 10,
  rain_probability_threshold: 50,
  geolocation_checkin_opt_in: false,
};

export const travelSettingsApi = {
  // Singleton row (id = true), same pattern as google_calendar_status(): if
  // nobody has ever saved settings, there's no row yet, so get() returns the
  // in-app defaults rather than null — the UI always has something to show.
  async get(): Promise<TravelSettings> {
    const { data, error } = await supabase
      .from('travel_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    return data ?? DEFAULTS;
  },

  async update(patch: TravelSettingsInput): Promise<TravelSettings> {
    const dbPatch: TravelSettingsPatch = {};
    if (patch.homePlaceId !== undefined)
      dbPatch.home_place_id = patch.homePlaceId;
    if (patch.defaultTransportMode !== undefined)
      dbPatch.default_transport_mode = patch.defaultTransportMode;
    if (patch.defaultArriveEarlyMinutes !== undefined)
      dbPatch.default_arrive_early_minutes = patch.defaultArriveEarlyMinutes;
    if (patch.rainProbabilityThreshold !== undefined)
      dbPatch.rain_probability_threshold = patch.rainProbabilityThreshold;
    if (patch.geolocationCheckinOptIn !== undefined)
      dbPatch.geolocation_checkin_opt_in = patch.geolocationCheckinOptIn;
    return unwrap(
      await supabase
        .from('travel_settings')
        .upsert({ id: true, ...dbPatch })
        .select()
        .single()
    );
  },
};
