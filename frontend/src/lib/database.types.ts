export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          display_name?: string
          created_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          workspace_id: string
          created_by: string
          title: string
          content: string | null
          transcript: string | null
          audio_url: string | null
          image_url: string | null
          duration: number | null
          embedding: number[] | null
          embedding_status: 'pending' | 'processing' | 'completed' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          created_by: string
          title: string
          content?: string | null
          transcript?: string | null
          audio_url?: string | null
          image_url?: string | null
          duration?: number | null
          embedding?: number[] | null
          embedding_status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          created_by?: string
          title?: string
          content?: string | null
          transcript?: string | null
          audio_url?: string | null
          image_url?: string | null
          duration?: number | null
          embedding?: number[] | null
          embedding_status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          workspace_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          workspace_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          workspace_id?: string
          created_at?: string
        }
      }
      note_tags: {
        Row: {
          note_id: string
          tag_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
        }
      }
    }
  }
}

// Convenience types
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row']
export type Note = Database['public']['Tables']['notes']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
