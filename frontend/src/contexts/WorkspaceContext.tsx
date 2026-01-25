import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Workspace, WorkspaceMember } from '../lib/database.types'

interface WorkspaceContextType {
  workspace: Workspace | null
  members: WorkspaceMember[]
  loading: boolean
  createWorkspace: (name: string) => Promise<Workspace>
  joinWorkspace: (inviteCode: string, displayName: string) => Promise<void>
  leaveWorkspace: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setWorkspace(null)
      setMembers([])
      setLoading(false)
      return
    }

    const fetchWorkspace = async () => {
      setLoading(true)

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (membership) {
        const { data: ws } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', membership.workspace_id)
          .single()

        if (ws) {
          setWorkspace(ws)

          const { data: mems } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', ws.id)

          setMembers(mems || [])
        }
      }

      setLoading(false)
    }

    fetchWorkspace()
  }, [user])

  useEffect(() => {
    if (!workspace) return

    const channel = supabase
      .channel('workspace_members')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        async () => {
          const { data } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', workspace.id)
          setMembers(data || [])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace])

  const createWorkspace = async (name: string): Promise<Workspace> => {
    if (!user) throw new Error('Must be logged in')

    // Generate invite code locally
    const code = `SYNAPSE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .insert({ name, invite_code: code })
      .select()
      .single()

    if (wsError) throw wsError

    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: ws.id,
        user_id: user.id,
        display_name: 'Me',
      })

    if (memberError) throw memberError

    setWorkspace(ws)
    return ws
  }

  const joinWorkspace = async (inviteCode: string, displayName: string) => {
    if (!user) throw new Error('Must be logged in')

    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (wsError || !ws) throw new Error('Invalid invite code')

    const { error: joinError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: ws.id,
        user_id: user.id,
        display_name: displayName,
      })

    if (joinError) throw joinError

    setWorkspace(ws)
  }

  const leaveWorkspace = async () => {
    if (!user || !workspace) return

    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)

    setWorkspace(null)
    setMembers([])
  }

  return (
    <WorkspaceContext.Provider
      value={{ workspace, members, loading, createWorkspace, joinWorkspace, leaveWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
