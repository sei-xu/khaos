export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      events: {
        Row: {
          deleted_at: string | null
          duration: unknown
          event_type: Database["public"]["Enums"]["event_types"]
          field_id: string | null
          id: string
          name: string
          project_id: string | null
          recurrent: boolean
          routine_id: string | null
          task_id: string | null
        }
        Insert: {
          deleted_at?: string | null
          duration?: unknown
          event_type: Database["public"]["Enums"]["event_types"]
          field_id?: string | null
          id?: string
          name: string
          project_id?: string | null
          recurrent?: boolean
          routine_id?: string | null
          task_id?: string | null
        }
        Update: {
          deleted_at?: string | null
          duration?: unknown
          event_type?: Database["public"]["Enums"]["event_types"]
          field_id?: string | null
          id?: string
          name?: string
          project_id?: string | null
          recurrent?: boolean
          routine_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          doc_reference: string | null
          id: string
          name: string
          order: number
        }
        Insert: {
          doc_reference?: string | null
          id?: string
          name: string
          order: number
        }
        Update: {
          doc_reference?: string | null
          id?: string
          name?: string
          order?: number
        }
        Relationships: []
      }
      moment_tag_entities: {
        Row: {
          event_id: string | null
          id: string
          moment_tag_id: string | null
          project_id: string | null
          section_id: string | null
          task_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          moment_tag_id?: string | null
          project_id?: string | null
          section_id?: string | null
          task_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          moment_tag_id?: string | null
          project_id?: string | null
          section_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moment_tag_entities_new_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moment_tag_entities_new_moment_tag_id_fkey"
            columns: ["moment_tag_id"]
            isOneToOne: false
            referencedRelation: "moment_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moment_tag_entities_new_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moment_tag_entities_new_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moment_tag_entities_new_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      moment_tags: {
        Row: {
          id: string
          name: string
          synonyms: string[]
        }
        Insert: {
          id?: string
          name: string
          synonyms?: string[]
        }
        Update: {
          id?: string
          name?: string
          synonyms?: string[]
        }
        Relationships: []
      }
      moments: {
        Row: {
          authored_by: string
          created_at: string
          id: string
          moment_note: string | null
          moment_type: Database["public"]["Enums"]["moment_types"]
          previous_value: string | null
          project_id: string | null
          routine_id: string | null
          section_id: string | null
          task_id: string | null
          value: string | null
        }
        Insert: {
          authored_by?: string
          created_at?: string
          id?: string
          moment_note?: string | null
          moment_type?: Database["public"]["Enums"]["moment_types"]
          previous_value?: string | null
          project_id?: string | null
          routine_id?: string | null
          section_id?: string | null
          task_id?: string | null
          value?: string | null
        }
        Update: {
          authored_by?: string
          created_at?: string
          id?: string
          moment_note?: string | null
          moment_type?: Database["public"]["Enums"]["moment_types"]
          previous_value?: string | null
          project_id?: string | null
          routine_id?: string | null
          section_id?: string | null
          task_id?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moments_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          deleted_at: string | null
          doc_reference: string | null
          due: string | null
          field_id: string | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["priority"] | null
          status: Database["public"]["Enums"]["status"]
          target: unknown
        }
        Insert: {
          deleted_at?: string | null
          doc_reference?: string | null
          due?: string | null
          field_id?: string | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["priority"] | null
          status?: Database["public"]["Enums"]["status"]
          target?: unknown
        }
        Update: {
          deleted_at?: string | null
          doc_reference?: string | null
          due?: string | null
          field_id?: string | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority"] | null
          status?: Database["public"]["Enums"]["status"]
          target?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "projects_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          active: boolean
          constraints: string | null
          estimate: number | null
          field_id: string | null
          frequency: string
          id: string
          name: string
          preferred_time: string | null
          task_id: string | null
        }
        Insert: {
          active?: boolean
          constraints?: string | null
          estimate?: number | null
          field_id?: string | null
          frequency: string
          id?: string
          name: string
          preferred_time?: string | null
          task_id?: string | null
        }
        Update: {
          active?: boolean
          constraints?: string | null
          estimate?: number | null
          field_id?: string | null
          frequency?: string
          id?: string
          name?: string
          preferred_time?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routines_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routines_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          deleted_at: string | null
          doc_reference: string | null
          due: string | null
          id: string
          is_infinite: boolean
          name: string
          priority: Database["public"]["Enums"]["priority"] | null
          project_id: string | null
          status: Database["public"]["Enums"]["status"]
          target: unknown
        }
        Insert: {
          deleted_at?: string | null
          doc_reference?: string | null
          due?: string | null
          id?: string
          is_infinite?: boolean
          name: string
          priority?: Database["public"]["Enums"]["priority"] | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["status"]
          target?: unknown
        }
        Update: {
          deleted_at?: string | null
          doc_reference?: string | null
          due?: string | null
          id?: string
          is_infinite?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["priority"] | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["status"]
          target?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sections_sequence: {
        Row: {
          section_next: string
          section_previous: string
        }
        Insert: {
          section_next: string
          section_previous: string
        }
        Update: {
          section_next?: string
          section_previous?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_sequence_section_next_fkey"
            columns: ["section_next"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_sequence_section_previous_fkey"
            columns: ["section_previous"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      task_items: {
        Row: {
          description: string
          done: boolean
          id: string
          order: number
          task_id: string | null
        }
        Insert: {
          description: string
          done?: boolean
          id?: string
          order?: number
          task_id?: string | null
        }
        Update: {
          description?: string
          done?: boolean
          id?: string
          order?: number
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_logs: {
        Row: {
          background: boolean
          duration: unknown
          id: string
          note: string | null
          project_id: string | null
          task_id: string | null
        }
        Insert: {
          background?: boolean
          duration?: unknown
          id?: string
          note?: string | null
          project_id?: string | null
          task_id?: string | null
        }
        Update: {
          background?: boolean
          duration?: unknown
          id?: string
          note?: string | null
          project_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          deleted_at: string | null
          due: string | null
          estimate: number | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["priority"] | null
          section_id: string | null
          status: Database["public"]["Enums"]["status"]
          target: unknown
        }
        Insert: {
          deleted_at?: string | null
          due?: string | null
          estimate?: number | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["priority"] | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["status"]
          target?: unknown
        }
        Update: {
          deleted_at?: string | null
          due?: string | null
          estimate?: number | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["priority"] | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["status"]
          target?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks_sequence: {
        Row: {
          task_next: string
          task_previous: string
        }
        Insert: {
          task_next: string
          task_previous: string
        }
        Update: {
          task_next?: string
          task_previous?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_sequence_task_next_fkey"
            columns: ["task_next"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sequence_task_previous_fkey"
            columns: ["task_previous"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tag_entities: {
        Row: {
          event_id: string | null
          id: string
          project_id: string | null
          section_id: string | null
          task_id: string | null
          work_tag_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          project_id?: string | null
          section_id?: string | null
          task_id?: string | null
          work_tag_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          project_id?: string | null
          section_id?: string | null
          task_id?: string | null
          work_tag_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_tag_entities_new_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tag_entities_new_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tag_entities_new_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tag_entities_new_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tag_entities_new_work_tag_id_fkey"
            columns: ["work_tag_id"]
            isOneToOne: false
            referencedRelation: "work_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      work_tags: {
        Row: {
          id: string
          name: string
          synonyms: string[]
        }
        Insert: {
          id?: string
          name: string
          synonyms?: string[]
        }
        Update: {
          id?: string
          name?: string
          synonyms?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      active_task_log: {
        Row: {
          background: boolean | null
          duration: unknown
          id: string | null
          note: string | null
          project_id: string | null
          task_id: string | null
        }
        Insert: {
          background?: boolean | null
          duration?: unknown
          id?: string | null
          note?: string | null
          project_id?: string | null
          task_id?: string | null
        }
        Update: {
          background?: boolean | null
          duration?: unknown
          id?: string | null
          note?: string | null
          project_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_and_unlock_next_sections: {
        Args: { p_previous_section_id: string }
        Returns: undefined
      }
      check_and_unlock_next_tasks: {
        Args: { p_previous_task_id: string }
        Returns: undefined
      }
      insert_moment:
        | {
            Args: {
              p_entity_column: string
              p_entity_id: string
              p_moment_type: Database["public"]["Enums"]["moment_types"]
              p_note?: string
              p_value?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_entity_column: string
              p_entity_id: string
              p_moment_type: Database["public"]["Enums"]["moment_types"]
              p_note?: string
              p_previous_value?: string
              p_value?: string
            }
            Returns: undefined
          }
      moment_entity_column: { Args: { p_table: string }; Returns: string }
      get_active_task_log: {
        Args: never
        Returns: {
          background: boolean
          duration: unknown
          id: string
          note: string | null
          project_id: string | null
          task_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "task_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      stop_active_task: {
        Args: never
        Returns: {
          background: boolean
          duration: unknown
          id: string
          note: string | null
          project_id: string | null
          task_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "task_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      stop_task_log: {
        Args: { p_id: string }
        Returns: {
          background: boolean
          duration: unknown
          id: string
          note: string | null
          project_id: string | null
          task_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "task_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      event_types: "scheduled" | "fixed" | "routine"
      moment_types:
        | "created"
        | "due"
        | "estimate"
        | "status"
        | "started"
        | "stopped"
        | "scheduled"
        | "target"
        | "note"
        | "priority"
        | "definition"
        | "today"
        | "notToday"
      priority: "urgent" | "high" | "medium" | "low"
      status:
        | "planning"
        | "todo"
        | "in_progress"
        | "in_review"
        | "done"
        | "paused"
        | "cancelled"
        | "waiting"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_types: ["scheduled", "fixed", "routine"],
      moment_types: [
        "created",
        "due",
        "estimate",
        "status",
        "started",
        "stopped",
        "scheduled",
        "target",
        "note",
        "priority",
        "definition",
        "today",
        "notToday",
      ],
      priority: ["urgent", "high", "medium", "low"],
      status: [
        "planning",
        "todo",
        "in_progress",
        "in_review",
        "done",
        "paused",
        "cancelled",
        "waiting",
      ],
    },
  },
} as const
