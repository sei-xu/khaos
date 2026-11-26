import { supabase } from '../supabaseClient';
import { formatRange } from '../range';
import type { Event, EventPatch, EventType, Id, TransportMode } from '../types';

function unwrap<T>({
  data,
  error,
}: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (error) throw error;
  return data as T;
}

export interface EventInput {
  name: string;
  eventType: EventType;
  recurrent?: boolean;
  start: Date | string;
  end?: Date | string | null;
  taskId?: Id | null;
  projectId?: Id | null;
  fieldId?: Id | null;
  placeId?: Id | null;
  locationText?: string | null;
  transportMode?: TransportMode | null;
  arriveEarlyMinutes?: number | null;
}

export type EventPatchInput = Partial<EventInput>;

export const eventsApi = {
  async list(): Promise<Event[]> {
    return unwrap(
      await supabase.from('events').select('*').is('deleted_at', null)
    );
  },

  async create({
    name,
    eventType,
    recurrent,
    start,
    end,
    taskId,
    projectId,
    fieldId,
    placeId,
    locationText,
    transportMode,
    arriveEarlyMinutes,
  }: EventInput): Promise<Event> {
    return unwrap(
      await supabase
        .from('events')
        .insert({
          name,
          event_type: eventType,
          recurrent: Boolean(recurrent),
          duration: formatRange(start, end ?? null),
          task_id: taskId || null,
          project_id: projectId || null,
          field_id: fieldId || null,
          place_id: placeId || null,
          location_text: locationText || null,
          transport_mode: transportMode || null,
          arrive_early_minutes: arriveEarlyMinutes ?? null,
        })
        .select()
        .single()
    );
  },

  async update(id: Id, patch: EventPatchInput): Promise<Event> {
    const {
      name,
      eventType,
      recurrent,
      start,
      end,
      taskId,
      projectId,
      fieldId,
      placeId,
      locationText,
      transportMode,
      arriveEarlyMinutes,
    } = patch;
    const dbPatch: EventPatch = {};
    if (name !== undefined) dbPatch.name = name;
    if (eventType !== undefined) dbPatch.event_type = eventType;
    if (recurrent !== undefined) dbPatch.recurrent = recurrent;
    if (start !== undefined || end !== undefined)
      dbPatch.duration = formatRange(start ?? null, end ?? null);
    if (taskId !== undefined) dbPatch.task_id = taskId;
    if (projectId !== undefined) dbPatch.project_id = projectId;
    if (fieldId !== undefined) dbPatch.field_id = fieldId;
    if (placeId !== undefined) dbPatch.place_id = placeId;
    if (locationText !== undefined) dbPatch.location_text = locationText;
    if (transportMode !== undefined) dbPatch.transport_mode = transportMode;
    if (arriveEarlyMinutes !== undefined)
      dbPatch.arrive_early_minutes = arriveEarlyMinutes;
    return unwrap(
      await supabase
        .from('events')
        .update(dbPatch)
        .eq('id', id)
        .select()
        .single()
    );
  },

  async remove(id: Id): Promise<Event> {
    return unwrap(
      await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    );
  },
};
