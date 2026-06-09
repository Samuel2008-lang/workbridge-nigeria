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
      applications: {
        Row: {
          created_at: string
          id: string
          job_id: string
          proposed_price: number | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          proposed_price?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          proposed_price?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_payment_requests: {
        Row: {
          created_at: string
          id: string
          job_id: string
          requested_by: string
          responded_at: string | null
          status: Database["public"]["Enums"]["cash_request_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          requested_by: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["cash_request_status"]
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          requested_by?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["cash_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_payment_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_evidence: {
        Row: {
          created_at: string
          dispute_id: string
          id: string
          media_type: string | null
          media_url: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          client_amount: number | null
          created_at: string
          description: string | null
          id: string
          job_id: string
          raised_by: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
          worker_amount: number | null
        }
        Insert: {
          client_amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          job_id: string
          raised_by: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
          worker_amount?: number | null
        }
        Update: {
          client_amount?: number | null
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string
          raised_by?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
          worker_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          agreed_amount: number | null
          budget_max: number | null
          budget_min: number | null
          client_id: string
          commission_amount: number | null
          completed_at: string | null
          confirm_deadline: string | null
          created_at: string
          description: string | null
          escrow_status: Database["public"]["Enums"]["escrow_status"]
          frozen_until: string | null
          hire_expires_at: string | null
          hired_at: string | null
          hired_worker_id: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          payment_mode: string
          released_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string
        }
        Insert: {
          agreed_amount?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_id: string
          commission_amount?: number | null
          completed_at?: string | null
          confirm_deadline?: string | null
          created_at?: string
          description?: string | null
          escrow_status?: Database["public"]["Enums"]["escrow_status"]
          frozen_until?: string | null
          hire_expires_at?: string | null
          hired_at?: string | null
          hired_worker_id?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          payment_mode?: string
          released_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at?: string
        }
        Update: {
          agreed_amount?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string
          commission_amount?: number | null
          completed_at?: string | null
          confirm_deadline?: string | null
          created_at?: string
          description?: string | null
          escrow_status?: Database["public"]["Enums"]["escrow_status"]
          frozen_until?: string | null
          hire_expires_at?: string | null
          hired_at?: string | null
          hired_worker_id?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          payment_mode?: string
          released_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          duration_seconds: number | null
          id: string
          is_read: boolean
          is_system: boolean
          job_id: string | null
          media_type: string | null
          media_url: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_read?: boolean
          is_system?: boolean
          job_id?: string | null
          media_type?: string | null
          media_url?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_read?: boolean
          is_system?: boolean
          job_id?: string | null
          media_type?: string | null
          media_url?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      onboarding_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          job_id: string | null
          type: Database["public"]["Enums"]["onboarding_type"]
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          job_id?: string | null
          type: Database["public"]["Enums"]["onboarding_type"]
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          job_id?: string | null
          type?: Database["public"]["Enums"]["onboarding_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_acknowledgements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cash_transaction_count: number
          client_rating: number
          created_at: string
          full_name: string | null
          id: string
          language: string | null
          location: string | null
          phone_number: string | null
          profile_photo: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
          worker_rating: number
        }
        Insert: {
          cash_transaction_count?: number
          client_rating?: number
          created_at?: string
          full_name?: string | null
          id: string
          language?: string | null
          location?: string | null
          phone_number?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          worker_rating?: number
        }
        Update: {
          cash_transaction_count?: number
          client_rating?: number
          created_at?: string
          full_name?: string | null
          id?: string
          language?: string | null
          location?: string | null
          phone_number?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
          worker_rating?: number
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          investigation_note: string | null
          job_id: string
          published_at: string | null
          rated_user_id: string
          rater_id: string
          response: string | null
          stars: number
          status: Database["public"]["Enums"]["review_status"]
          tags: string[]
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          investigation_note?: string | null
          job_id: string
          published_at?: string | null
          rated_user_id: string
          rater_id: string
          response?: string | null
          stars: number
          status?: Database["public"]["Enums"]["review_status"]
          tags?: string[]
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          investigation_note?: string | null
          job_id?: string
          published_at?: string | null
          rated_user_id?: string
          rater_id?: string
          response?: string | null
          stars?: number
          status?: Database["public"]["Enums"]["review_status"]
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          balance_bucket: string | null
          created_at: string
          description: string | null
          id: string
          job_id: string | null
          receiver_id: string | null
          sender_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          balance_bucket?: string | null
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          balance_bucket?: string | null
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          frozen_balance: number
          id: string
          pending_balance: number
          pin_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          frozen_balance?: number
          id?: string
          pending_balance?: number
          pin_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          frozen_balance?: number
          id?: string
          pending_balance?: number
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _release_escrow: {
        Args: { _job_id: string; _to_bucket: string }
        Returns: undefined
      }
      auto_confirm_jobs: { Args: never; Returns: number }
      confirm_job_complete: { Args: { _job_id: string }; Returns: Json }
      deposit_to_wallet: {
        Args: { _amount: number; _reference: string; _user_id: string }
        Returns: undefined
      }
      expire_hires: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hire_worker: {
        Args: { _amount: number; _job_id: string; _worker_id: string }
        Returns: Json
      }
      mark_job_complete: { Args: { _job_id: string }; Returns: Json }
      raise_dispute: {
        Args: { _description: string; _job_id: string; _reason: string }
        Returns: Json
      }
      set_wallet_pin: { Args: { _pin: string }; Returns: Json }
      submit_rating: {
        Args: {
          _comment: string
          _job_id: string
          _rated_user_id: string
          _stars: number
          _tags: string[]
        }
        Returns: Json
      }
      thaw_frozen_funds: { Args: never; Returns: number }
      withdraw_from_wallet: {
        Args: { _amount: number; _pin: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      application_status: "pending" | "accepted" | "rejected"
      cash_request_status: "pending" | "accepted" | "declined"
      dispute_status:
        | "open"
        | "under_review"
        | "resolved_worker"
        | "resolved_client"
        | "resolved_split"
        | "closed"
      escrow_status:
        | "none"
        | "locked"
        | "released"
        | "frozen"
        | "disputed"
        | "refunded"
      job_status: "open" | "assigned" | "completed" | "cancelled"
      job_type: "digital" | "physical"
      notification_type:
        | "hired"
        | "job_completed"
        | "payment_released"
        | "payment_available"
        | "new_message"
        | "dispute_raised"
        | "dispute_resolved"
        | "review_received"
        | "review_under_review"
        | "badge_unlocked"
        | "application_received"
        | "confirm_reminder"
        | "auto_confirmed"
        | "job_closed"
        | "hire_expired"
      onboarding_type: "worker_prejob" | "client_onboarding"
      review_status: "pending" | "published" | "held" | "removed" | "disputed"
      transaction_status: "pending" | "completed" | "failed"
      transaction_type: "escrow" | "release" | "withdrawal" | "deposit"
      user_role: "worker" | "client"
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
      app_role: ["admin", "moderator", "user"],
      application_status: ["pending", "accepted", "rejected"],
      cash_request_status: ["pending", "accepted", "declined"],
      dispute_status: [
        "open",
        "under_review",
        "resolved_worker",
        "resolved_client",
        "resolved_split",
        "closed",
      ],
      escrow_status: [
        "none",
        "locked",
        "released",
        "frozen",
        "disputed",
        "refunded",
      ],
      job_status: ["open", "assigned", "completed", "cancelled"],
      job_type: ["digital", "physical"],
      notification_type: [
        "hired",
        "job_completed",
        "payment_released",
        "payment_available",
        "new_message",
        "dispute_raised",
        "dispute_resolved",
        "review_received",
        "review_under_review",
        "badge_unlocked",
        "application_received",
        "confirm_reminder",
        "auto_confirmed",
        "job_closed",
        "hire_expired",
      ],
      onboarding_type: ["worker_prejob", "client_onboarding"],
      review_status: ["pending", "published", "held", "removed", "disputed"],
      transaction_status: ["pending", "completed", "failed"],
      transaction_type: ["escrow", "release", "withdrawal", "deposit"],
      user_role: ["worker", "client"],
    },
  },
} as const
