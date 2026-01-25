import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import type { Note } from '../lib/database.types'

export default function NotesList() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!workspace) return

    const fetchNotes = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('notes')
          .select('*')
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: false })

        if (data) setNotes(data)
      } catch (err) {
        console.error('Failed to fetch notes:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchNotes()

    // Real-time subscription
    const channel = supabase
      .channel('notes_list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => fetchNotes()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace])

  // Filter notes by search
  const filteredNotes = searchQuery
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.transcript?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.content?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen px-6 py-8">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <h1 className="text-2xl font-bold text-heading mb-2">Notes</h1>
        <p className="text-muted">Your captured thoughts</p>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto mb-6">
        <Input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredNotes.length === 0 && (
        <div className="max-w-2xl mx-auto">
          <Card className="text-center py-12">
            <svg
              className="w-12 h-12 mx-auto text-slate-500 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <h3 className="text-white font-medium mb-2">
              {searchQuery ? 'No matching notes' : 'No notes yet'}
            </h3>
            <p className="text-muted text-sm">
              {searchQuery
                ? 'Try a different search'
                : 'Tap the mic to capture your first thought'}
            </p>
          </Card>
        </div>
      )}

      {/* Notes Grid */}
      {!loading && filteredNotes.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-3">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              variant="interactive"
              onClick={() => navigate(`/notes/${note.id}`)}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{note.title}</h3>
                  <p className="text-sm text-muted line-clamp-2 mt-1">
                    {note.transcript || note.content || 'No content'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-muted">{formatDate(note.created_at)}</span>
                  {note.duration && (
                    <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                      {formatDuration(note.duration)}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
