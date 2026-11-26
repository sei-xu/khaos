import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];
type Enums = Database['public']['Enums'];

export type Id = string; // all primary/foreign keys are uuid

// ---------- Row types (what queries return) ----------
export type Field = Tables['fields']['Row'];
export type Project = Tables['projects']['Row'];
export type Section = Tables['sections']['Row'];
export type Task = Tables['tasks']['Row'];
export type TaskItem = Tables['task_items']['Row'];
export type TaskLog = Tables['task_logs']['Row'];
export type Event = Tables['events']['Row'];
export type Routine = Tables['routines']['Row'];
export type Moment = Tables['moments']['Row'];
export type WorkTag = Tables['work_tags']['Row'];
export type WorkTagEntity = Tables['work_tag_entities']['Row'];
export type MomentTag = Tables['moment_tags']['Row'];
export type MomentTagEntity = Tables['moment_tag_entities']['Row'];
export type SectionsSequence = Tables['sections_sequence']['Row'];
export type TasksSequence = Tables['tasks_sequence']['Row'];
export type Place = Tables['places']['Row'];
export type TravelSettings = Tables['travel_settings']['Row'];

export type ActiveTaskLog = Views['active_task_log']['Row'];

// ---------- Insert / Update variants ----------
export type NewField = Tables['fields']['Insert'];
export type NewProject = Tables['projects']['Insert'];
export type NewSection = Tables['sections']['Insert'];
export type NewTask = Tables['tasks']['Insert'];
export type NewTaskItem = Tables['task_items']['Insert'];
export type NewEvent = Tables['events']['Insert'];
export type NewRoutine = Tables['routines']['Insert'];
export type NewMoment = Tables['moments']['Insert'];
export type NewWorkTag = Tables['work_tags']['Insert'];
export type NewWorkTagEntity = Tables['work_tag_entities']['Insert'];
export type NewMomentTag = Tables['moment_tags']['Insert'];
export type NewMomentTagEntity = Tables['moment_tag_entities']['Insert'];
export type NewPlace = Tables['places']['Insert'];

export type FieldPatch = Tables['fields']['Update'];
export type ProjectPatch = Tables['projects']['Update'];
export type SectionPatch = Tables['sections']['Update'];
export type TaskPatch = Tables['tasks']['Update'];
export type TaskItemPatch = Tables['task_items']['Update'];
export type TaskLogPatch = Tables['task_logs']['Update'];
export type EventPatch = Tables['events']['Update'];
export type RoutinePatch = Tables['routines']['Update'];
export type PlacePatch = Tables['places']['Update'];
export type TravelSettingsPatch = Tables['travel_settings']['Update'];

// ---------- Enums ----------
export type Status = Enums['status'];
export type Priority = Enums['priority'];
export type EventType = Enums['event_types'];
export type MomentType = Enums['moment_types'];
export type TransportMode = Enums['transport_modes'];
export type PlaceKind = 'home' | 'work' | 'client' | 'other';
export type MomentAuthor = 'user' | 'system' | 'assistant';

// entity_types no longer exists as a DB enum — moments/work_tag_entities use
// direct FK columns now (see EntityRef below) instead of a generic
// (entity_type, entity_id) pair.

// ---------- Composite / joined shapes ----------
// routinesApi.list() selects '*, fields(name)'
export type RoutineWithField = Routine & {
  fields: Pick<Field, 'name'> | null;
};

// Replaces the old { entityType, entityId } shape used throughout
// moments.js / tags.js / useMoments.js / useTags.js / MomentPrompt.jsx /
// TaskDetailModal.jsx. Exactly one of these keys should be set per row.
export type EntityRef =
  | { project_id: Id; section_id?: null; task_id?: null; event_id?: null }
  | { section_id: Id; project_id?: null; task_id?: null; event_id?: null }
  | { task_id: Id; project_id?: null; section_id?: null; event_id?: null }
  | { event_id: Id; project_id?: null; section_id?: null; task_id?: null };
