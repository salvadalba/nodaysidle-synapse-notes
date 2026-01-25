import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui'
import type { Note } from '../lib/database.types'

export default function Home() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    if (!workspace) return

    const fetchRecent = async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (data) setRecentNotes(data)
    }

    fetchRecent()

    // Subscribe to new notes
    const channel = supabase
      .channel('recent_notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => fetchRecent()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace])

  const handleMicClick = () => {
    setIsRecording(true)
    navigate('/record')
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-heading mb-2">Synapse</h1>
        <p className="text-muted">Capture your thoughts</p>
      </div>

      {/* Big mic button */}
      <button
        onClick={handleMicClick}
        className={isRecording ? 'btn-mic-recording' : 'btn-mic'}
        aria-label="Start recording"
      >
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>

      <p className="text-muted mt-6 mb-12">Tap to capture a thought</p>

      {/* Recent notes */}
      {recentNotes.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="text-sm font-medium text-muted mb-4">Recent</h2>
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <Card
                key={note.id}
                variant="interactive"
                onClick={() => navigate(`/notes/${note.id}`)}
                className="flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{note.title}</h3>
                  <p className="text-sm text-muted truncate">
                    {note.transcript?.slice(0, 60) || note.content?.slice(0, 60) || 'No content'}
                  </p>
                </div>
                <span className="text-xs text-muted whitespace-nowrap">
                  {formatDate(note.created_at)}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
