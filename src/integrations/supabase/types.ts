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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          campaign_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          creator_id: string
          id: string
          message: string | null
          status: Database["public"]["Enums"]["application_status"]
          submission_url: string | null
          submitted_at: string | null
          updated_at: string
          visit_code: string | null
          visited: boolean
          visited_at: string | null
        }
        Insert: {
          campaign_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          creator_id: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submission_url?: string | null
          submitted_at?: string | null
          updated_at?: string
          visit_code?: string | null
          visited?: boolean
          visited_at?: string | null
        }
        Update: {
          campaign_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submission_url?: string | null
          submitted_at?: string | null
          updated_at?: string
          visit_code?: string | null
          visited?: boolean
          visited_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          address: string | null
          collab_types: string[]
          copy_must_avoid: string | null
          copy_must_include: string | null
          cover_url: string | null
          created_at: string
          deadline: string | null
          description: string | null
          food_types: string[]
          hashtags: string[]
          id: string
          merchant_id: string
          min_followers: number
          notes: string | null
          photos: string[]
          primary_food_type: string | null
          reference_link: string | null
          region: string
          restaurant_name: string | null
          reward: string
          slots: number
          status: Database["public"]["Enums"]["campaign_status"]
          title: string
          updated_at: string
          video_direction: string | null
          video_must_avoid: string | null
          video_must_include: string | null
        }
        Insert: {
          address?: string | null
          collab_types: string[]
          copy_must_avoid?: string | null
          copy_must_include?: string | null
          cover_url?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          food_types?: string[]
          hashtags?: string[]
          id?: string
          merchant_id: string
          min_followers?: number
          notes?: string | null
          photos?: string[]
          primary_food_type?: string | null
          reference_link?: string | null
          region: string
          restaurant_name?: string | null
          reward: string
          slots?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          title: string
          updated_at?: string
          video_direction?: string | null
          video_must_avoid?: string | null
          video_must_include?: string | null
        }
        Update: {
          address?: string | null
          collab_types?: string[]
          copy_must_avoid?: string | null
          copy_must_include?: string | null
          cover_url?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          food_types?: string[]
          hashtags?: string[]
          id?: string
          merchant_id?: string
          min_followers?: number
          notes?: string | null
          photos?: string[]
          primary_food_type?: string | null
          reference_link?: string | null
          region?: string
          restaurant_name?: string | null
          reward?: string
          slots?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          title?: string
          updated_at?: string
          video_direction?: string | null
          video_must_avoid?: string | null
          video_must_include?: string | null
        }
        Relationships: []
      }
      foodie_profiles: {
        Row: {
          area: string | null
          areas: string[]
          categories: string[]
          collab_preferences: string[]
          created_at: string
          email: string | null
          engagement_rate: number
          id: string
          ig_followers: number
          ig_handle: string | null
          ig_url: string | null
          nickname: string
          phone: string | null
          portfolio_url: string | null
          real_name: string | null
          reels_avg_views: number
          region: string | null
          review_note: string | null
          reviewed_at: string | null
          threads_followers: number
          tiktok_handle: string | null
          tiktok_followers: number
          other_social_handle: string | null
          other_social_followers: number
          threads_handle: string | null
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          youtube_channel: string | null
          youtube_subscribers: number
        }
        Insert: {
          area?: string | null
          areas?: string[]
          categories?: string[]
          collab_preferences?: string[]
          created_at?: string
          email?: string | null
          engagement_rate?: number
          id?: string
          ig_followers?: number
          ig_handle?: string | null
          ig_url?: string | null
          nickname: string
          phone?: string | null
          portfolio_url?: string | null
          real_name?: string | null
          reels_avg_views?: number
          region?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          threads_followers?: number
          tiktok_handle?: string | null
          tiktok_followers?: number
          other_social_handle?: string | null
          other_social_followers?: number
          threads_handle?: string | null
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          youtube_channel?: string | null
          youtube_subscribers?: number
        }
        Update: {
          area?: string | null
          areas?: string[]
          categories?: string[]
          collab_preferences?: string[]
          created_at?: string
          email?: string | null
          engagement_rate?: number
          id?: string
          ig_followers?: number
          ig_handle?: string | null
          ig_url?: string | null
          nickname?: string
          phone?: string | null
          portfolio_url?: string | null
          real_name?: string | null
          reels_avg_views?: number
          region?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          threads_followers?: number
          tiktok_handle?: string | null
          tiktok_followers?: number
          other_social_handle?: string | null
          other_social_followers?: number
          threads_handle?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          youtube_channel?: string | null
          youtube_subscribers?: number
        }
        Relationships: []
      }
      merchant_profiles: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          foodie_plan: Database["public"]["Enums"]["foodie_plan"] | null
          foodie_subscription_status: Database["public"]["Enums"]["foodie_subscription_status"]
          id: string
          phone: string | null
          region: string | null
          review_note: string | null
          reviewed_at: string | null
          store_name: string
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          foodie_plan?: Database["public"]["Enums"]["foodie_plan"] | null
          foodie_subscription_status?: Database["public"]["Enums"]["foodie_subscription_status"]
          id?: string
          phone?: string | null
          region?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          store_name: string
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          foodie_plan?: Database["public"]["Enums"]["foodie_plan"] | null
          foodie_subscription_status?: Database["public"]["Enums"]["foodie_subscription_status"]
          id?: string
          phone?: string | null
          region?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          store_name?: string
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string | null
          follower_count: number
          id: string
          instagram_handle: string | null
          phone: string | null
          region: string | null
          restaurant_name: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number
          id: string
          instagram_handle?: string | null
          phone?: string | null
          region?: string | null
          restaurant_name?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number
          id?: string
          instagram_handle?: string | null
          phone?: string | null
          region?: string | null
          restaurant_name?: string | null
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "merchant" | "creator"
      application_status: "pending" | "approved" | "rejected"
      campaign_status: "draft" | "published" | "closed"
      foodie_plan: "basic" | "pro" | "enterprise"
      foodie_subscription_status: "inactive" | "active" | "expired"
      verification_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "merchant", "creator"],
      application_status: ["pending", "approved", "rejected"],
      campaign_status: ["draft", "published", "closed"],
      foodie_plan: ["basic", "pro", "enterprise"],
      foodie_subscription_status: ["inactive", "active", "expired"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
