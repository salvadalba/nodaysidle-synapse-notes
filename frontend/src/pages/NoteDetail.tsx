import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Button, Input } from '../components/ui'
import type { Note } from '../lib/database.types'

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchNote = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError
      if (data) {
        setNote(data)
        setEditTitle(data.title)
        setEditContent(data.content || '')
      }
    } catch (err) {
      console.error('Failed to fetch note:', err)
      setError('Failed to load note')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchNote()

    // Real-time subscription
    const channel = supabase
      .channel(`note_${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notes',
        filter: `id=eq.${id}`,
      }, () => fetchNote())
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [id, fetchNote])

  const handleSave = async () => {
    if (!id || !note) return
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('notes')
        .update({ title: editTitle, content: editContent })
        .eq('id', id)

      if (updateError) throw updateError
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
      setError('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || deleting || !confirm('Delete this note?')) return
    setDeleting(true)
    try {
      await supabase.from('notes').delete().eq('id', id)
      navigate('/notes')
    } catch (err) {
      console.error('Failed to delete:', err)
      setError('Failed to delete note')
    } finally {
      setDeleting(false)
    }
  }

  const handleCancel = () => {
    if (note) {
      setEditTitle(note.title)
      setEditContent(note.content || '')
    }
    setIsEditing(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !note) {
    return (
      <div className="min-h-screen px-6 py-8">
        <Card className="max-w-md mx-auto text-center py-12">
          <p className="text-rose-400 mb-4">{error || 'Note not found'}</p>
          <Button onClick={() => navigate('/notes')}>Back to Notes</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate('/notes')}
          className="flex items-center text-muted hover:text-white mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>

        {/* Main Card */}
        <Card className="mb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 text-xl font-bold"
                placeholder="Note title"
              />
            ) : (
              <h1 className="text-xl font-bold text-white">{note.title}</h1>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted mb-6">
            <span>{formatDate(note.created_at)}</span>
            {note.duration && (
              <span className="bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                {formatDuration(note.duration)}
              </span>
            )}
            {/* Processing Status */}
            {note.embedding_status === 'pending' && (
              <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                Queued
              </span>
            )}
            {note.embedding_status === 'processing' && (
              <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                Processing
              </span>
            )}
            {note.embedding_status === 'failed' && (
              <span className="bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full">
                Failed
              </span>
            )}
          </div>

          {/* Content/Transcript */}
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-48 glass-input resize-none"
              placeholder="Note content..."
            />
          ) : note.embedding_status === 'processing' && !note.transcript ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 text-sm">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Transcribing audio...
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-white/5 rounded animate-pulse" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-5/6" />
              </div>
            </div>
          ) : (
            <div className="text-slate-300 whitespace-pre-wrap">
              {note.transcript || note.content || <span className="text-muted italic">No content</span>}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
            {isEditing ? (
              <>
                <Button onClick={handleSave} loading={saving}>Save</Button>
                <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
                <Button variant="ghost" onClick={handleDelete} loading={deleting} className="text-rose-400 hover:text-rose-300">
                  Delete
                </Button>
              </>
            )}
          </div>
        </Card>

        {/* Audio Player */}
        {note.audio_url && (
          <Card className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-3">Audio Recording</h2>
            <audio controls className="w-full" src={note.audio_url}>
              Your browser does not support audio playback.
            </audio>
          </Card>
        )}

        {/* AI Visualization */}
        {note.image_url ? (
          <Card>
            <h2 className="text-sm font-medium text-muted mb-3">AI Visualization</h2>
            <img
              src={note.image_url}
              alt="AI visualization"
              className="w-full rounded-xl"
            />
          </Card>
        ) : note.transcript && note.embedding_status !== 'failed' && (
          <Card>
            <h2 className="text-sm font-medium text-muted mb-3">AI Visualization</h2>
            <div className="aspect-square bg-white/5 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-muted text-sm">Generating visualization...</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
