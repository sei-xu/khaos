import { supabase } from '../supabaseClient';
import type { Id, NewPlace, Place, PlaceKind, PlacePatch } from '../types';

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export interface PlaceInput {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  kind?: PlaceKind;
  radiusM?: number;
  googlePlaceId?: string | null;
  fieldId?: Id | null;
  projectId?: Id | null;
}

export type PlacePatchInput = Partial<PlaceInput>;

function toInsert(input: PlaceInput): NewPlace {
  return {
    name: input.name,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    kind: input.kind,
    radius_m: input.radiusM,
    google_place_id: input.googlePlaceId ?? null,
    field_id: input.fieldId || null,
    project_id: input.projectId || null,
  };
}

export const placesApi = {
  async list(): Promise<Place[]> {
    return unwrap(
      await supabase
        .from('places')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true })
    );
  },

  async create(input: PlaceInput): Promise<Place> {
    return unwrap(
      await supabase.from('places').insert(toInsert(input)).select().single()
    );
  },

  async update(id: Id, patch: PlacePatchInput): Promise<Place> {
    const dbPatch: PlacePatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.address !== undefined) dbPatch.address = patch.address;
    if (patch.lat !== undefined) dbPatch.lat = patch.lat;
    if (patch.lng !== undefined) dbPatch.lng = patch.lng;
    if (patch.kind !== undefined) dbPatch.kind = patch.kind;
    if (patch.radiusM !== undefined) dbPatch.radius_m = patch.radiusM;
    if (patch.googlePlaceId !== undefined)
      dbPatch.google_place_id = patch.googlePlaceId;
    if (patch.fieldId !== undefined) dbPatch.field_id = patch.fieldId;
    if (patch.projectId !== undefined) dbPatch.project_id = patch.projectId;
    return unwrap(
      await supabase
        .from('places')
        .update(dbPatch)
        .eq('id', id)
        .select()
        .single()
    );
  },

  async remove(id: Id): Promise<Place> {
    return unwrap(
      await supabase
        .from('places')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    );
  },
};
