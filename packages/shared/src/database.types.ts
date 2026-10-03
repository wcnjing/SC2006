export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activities: {
        Row: {
          accessibility_features: string[];
          address: string | null;
          cancelled_reason: string | null;
          capacity: number | null;
          category: string;
          cost_cents: number;
          created_at: string;
          description: string;
          ends_at: string;
          external_id: string | null;
          id: string;
          is_outdoor: boolean;
          lat: number | null;
          lng: number | null;
          location_name: string;
          neighbourhood_id: number | null;
          organiser_id: string | null;
          source: Database['public']['Enums']['activity_source'];
          starts_at: string;
          status: Database['public']['Enums']['activity_status'];
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          accessibility_features?: string[];
          address?: string | null;
          cancelled_reason?: string | null;
          capacity?: number | null;
          category: string;
          cost_cents?: number;
          created_at?: string;
          description?: string;
          ends_at: string;
          external_id?: string | null;
          id?: string;
          is_outdoor?: boolean;
          lat?: number | null;
          lng?: number | null;
          location_name: string;
          neighbourhood_id?: number | null;
          organiser_id?: string | null;
          source?: Database['public']['Enums']['activity_source'];
          starts_at: string;
          status?: Database['public']['Enums']['activity_status'];
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          accessibility_features?: string[];
          address?: string | null;
          cancelled_reason?: string | null;
          capacity?: number | null;
          category?: string;
          cost_cents?: number;
          created_at?: string;
          description?: string;
          ends_at?: string;
          external_id?: string | null;
          id?: string;
          is_outdoor?: boolean;
          lat?: number | null;
          lng?: number | null;
          location_name?: string;
          neighbourhood_id?: number | null;
          organiser_id?: string | null;
          source?: Database['public']['Enums']['activity_source'];
          starts_at?: string;
          status?: Database['public']['Enums']['activity_status'];
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activities_neighbourhood_id_fkey';
            columns: ['neighbourhood_id'];
            isOneToOne: false;
            referencedRelation: 'neighbourhoods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_organiser_id_fkey';
            columns: ['organiser_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      activity_participants: {
        Row: {
          activity_id: string;
          created_at: string;
          status: Database['public']['Enums']['participation_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          activity_id: string;
          created_at?: string;
          status: Database['public']['Enums']['participation_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          activity_id?: string;
          created_at?: string;
          status?: Database['public']['Enums']['participation_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_participants_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      activity_ratings: {
        Row: {
          activity_id: string;
          comment: string | null;
          created_at: string;
          rating: number;
          user_id: string;
        };
        Insert: {
          activity_id: string;
          comment?: string | null;
          created_at?: string;
          rating: number;
          user_id: string;
        };
        Update: {
          activity_id?: string;
          comment?: string | null;
          created_at?: string;
          rating?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_ratings_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_ratings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          id: number;
          target_id: string;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          is_removed: boolean;
          post_id: string;
          removed_reason: string | null;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          is_removed?: boolean;
          post_id: string;
          removed_reason?: string | null;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_removed?: boolean;
          post_id?: string;
          removed_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      connections: {
        Row: {
          addressee_id: string;
          created_at: string;
          requester_id: string;
          responded_at: string | null;
          status: Database['public']['Enums']['connection_status'];
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          requester_id: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['connection_status'];
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          requester_id?: string;
          responded_at?: string | null;
          status?: Database['public']['Enums']['connection_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'connections_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'connections_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          read_at: string | null;
          recipient_id: string;
          sender_id: string;
          shared_post_id: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          recipient_id: string;
          sender_id: string;
          shared_post_id?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          recipient_id?: string;
          sender_id?: string;
          shared_post_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_shared_post_id_fkey';
            columns: ['shared_post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      neighbourhoods: {
        Row: {
          id: number;
          lat: number;
          lng: number;
          name: string;
        };
        Insert: {
          id?: never;
          lat: number;
          lng: number;
          name: string;
        };
        Update: {
          id?: never;
          lat?: number;
          lng?: number;
          name?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          payload: Json;
          read_at: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          payload?: Json;
          read_at?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          payload?: Json;
          read_at?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'post_likes_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'post_likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      posts: {
        Row: {
          activity_id: string | null;
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          image_url: string | null;
          is_removed: boolean;
          neighbourhood_id: number | null;
          removed_reason: string | null;
          updated_at: string;
        };
        Insert: {
          activity_id?: string | null;
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_removed?: boolean;
          neighbourhood_id?: number | null;
          removed_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          activity_id?: string | null;
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_removed?: boolean;
          neighbourhood_id?: number | null;
          removed_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_neighbourhood_id_fkey';
            columns: ['neighbourhood_id'];
            isOneToOne: false;
            referencedRelation: 'neighbourhoods';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          accessibility_needs: string[];
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          interests: string[];
          neighbourhood_id: number | null;
          onboarded: boolean;
          preferred_language: string;
          role: Database['public']['Enums']['user_role'];
          singpass_verified: boolean;
          status: Database['public']['Enums']['account_status'];
          suspended_reason: string | null;
          updated_at: string;
        };
        Insert: {
          accessibility_needs?: string[];
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          interests?: string[];
          neighbourhood_id?: number | null;
          onboarded?: boolean;
          preferred_language?: string;
          role?: Database['public']['Enums']['user_role'];
          singpass_verified?: boolean;
          status?: Database['public']['Enums']['account_status'];
          suspended_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          accessibility_needs?: string[];
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          interests?: string[];
          neighbourhood_id?: number | null;
          onboarded?: boolean;
          preferred_language?: string;
          role?: Database['public']['Enums']['user_role'];
          singpass_verified?: boolean;
          status?: Database['public']['Enums']['account_status'];
          suspended_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_neighbourhood_id_fkey';
            columns: ['neighbourhood_id'];
            isOneToOne: false;
            referencedRelation: 'neighbourhoods';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: string;
          reporter_id: string;
          resolution_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database['public']['Enums']['report_status'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target'];
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: string;
          reporter_id: string;
          resolution_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['report_status'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target'];
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: string;
          reporter_id?: string;
          resolution_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['report_status'];
          target_id?: string;
          target_type?: Database['public']['Enums']['report_target'];
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      are_connected: {
        Args: { user_a: string; user_b: string };
        Returns: boolean;
      };
      current_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      is_active_user: { Args: never; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      is_blocked_between: {
        Args: { user_a: string; user_b: string };
        Returns: boolean;
      };
      is_organiser: { Args: never; Returns: boolean };
      set_user_role: {
        Args: {
          new_role: Database['public']['Enums']['user_role'];
          target_user: string;
        };
        Returns: undefined;
      };
      set_user_status: {
        Args: {
          new_status: Database['public']['Enums']['account_status'];
          reason?: string;
          target_user: string;
        };
        Returns: undefined;
      };
      write_audit_log: {
        Args: {
          p_action: string;
          p_details?: Json;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      account_status: 'active' | 'suspended';
      activity_source: 'organiser' | 'dataset';
      activity_status: 'scheduled' | 'cancelled' | 'completed';
      connection_status: 'pending' | 'accepted';
      participation_status: 'joined' | 'saved' | 'skipped';
      report_status: 'open' | 'actioned' | 'dismissed';
      report_target: 'post' | 'comment' | 'message' | 'user' | 'activity';
      user_role: 'resident' | 'organiser' | 'admin';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ['active', 'suspended'],
      activity_source: ['organiser', 'dataset'],
      activity_status: ['scheduled', 'cancelled', 'completed'],
      connection_status: ['pending', 'accepted'],
      participation_status: ['joined', 'saved', 'skipped'],
      report_status: ['open', 'actioned', 'dismissed'],
      report_target: ['post', 'comment', 'message', 'user', 'activity'],
      user_role: ['resident', 'organiser', 'admin'],
    },
  },
} as const;
