import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import AudioPlayer from '../components/AudioPlayer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import type { NoteWithDetails, Tag, RelatedNote } from '../../../shared/types';

export default function NoteDetail() {
    const { id } = useParams<{ id: string }>();
    const isNew = id === 'new';
    const navigate = useNavigate();

    const [note, setNote] = useState<NoteWithDetails | null>(null);
    const [loading, setLoading] = useState(!isNew);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(isNew);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [newTag, setNewTag] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const {
        isRecording,
        isPaused,
        duration,
        audioBlob,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
    } = useAudioRecorder();

    useEffect(() => {
        if (id && !isNew) {
            fetchNote();
        } else if (isNew) {
            setNote(null);
            setIsEditing(true);
            setLoading(false);
        }
    }, [id, isNew]);

    const fetchNote = async () => {
        if (!id || isNew) return;

        try {
            setLoading(true);
            setError(null);
            const response = await api.notes.get(id);
            setNote(response);
            setEditTitle(response.title || '');
            setEditContent(response.content || '');
        } catch (err) {
            setError('Failed to load note. Please try again.');
            console.error('Error fetching note:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAudioUpload = async () => {
        if (!audioBlob) return;

        try {
            setSaving(true);
            setError(null);
            const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
                type: audioBlob.type,
            });
            const response = await api.audio.upload(file);
            navigate(`/notes/${response.note_id}`);
        } catch (err) {
            setError('Failed to upload audio. Please try again.');
            console.error('Error uploading audio:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!isEditing) return;

        try {
            setSaving(true);
            setError(null);

            if (isNew) {
                const created = await api.notes.create({
                    title: editTitle,
                    content: editContent,
                });
                navigate(`/notes/${created.id}`);
            } else if (id && note) {
                const updated = await api.notes.update(id, {
                    title: editTitle,
                    content: editContent,
                });
                setNote(updated);
                setIsEditing(false);
            }
        } catch (err) {
            setError('Failed to save note. Please try again.');
            console.error('Error saving note:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (note) {
            setEditTitle(note.title || '');
            setEditContent(note.content || '');
        }
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (!id || !confirm('Are you sure you want to delete this note?')) {
            return;
        }

        try {
            setDeleting(true);
            setError(null);
            await api.notes.delete(id);
            navigate('/notes');
        } catch (err) {
            setError('Failed to delete note. Please try again.');
            console.error('Error deleting note:', err);
            setDeleting(false);
        }
    };

    const handleAddTag = async () => {
        if (!id || !newTag.trim() || !note) return;

        try {
            const currentTags = note.tags?.map(t => t.name) || [];
            const updated = await api.notes.update(id, {
                tags: [...currentTags, newTag.trim()],
            });
            setNote(updated);
            setNewTag('');
        } catch (err) {
            setError('Failed to add tag. Please try again.');
            console.error('Error adding tag:', err);
        }
    };

    const handleRemoveTag = async (tagName: string) => {
        if (!id || !note) return;

        try {
            const currentTags = note.tags?.map(t => t.name) || [];
            const updated = await api.notes.update(id, {
                tags: currentTags.filter(t => t !== tagName),
            });
            setNote(updated);
        } catch (err) {
            setError('Failed to remove tag. Please try again.');
            console.error('Error removing tag:', err);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (error && !note) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg
                                className="h-5 w-5 text-red-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!note && !isNew) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900">Note not found</h3>
                    <button
                        onClick={() => navigate('/notes')}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Back to Notes
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Error Message */}
            {error && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg
                                className="h-5 w-5 text-red-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Back Button */}
            <button
                onClick={() => navigate('/notes')}
                className="mb-6 flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
                <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                </svg>
                Back to Notes
            </button>

            {/* Note Header */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex justify-between items-start mb-4">
                    {isEditing ? (
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Note title"
                        />
                    ) : (
                        <h1 className="text-2xl font-bold text-gray-900">
                            {note?.title || 'Untitled Note'}
                        </h1>
                    )}
                    <div className="flex space-x-2 ml-4">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={saving}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Metadata */}
                {!isNew && note && (
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                        <span>Created: {formatDate(note.created_at.toString())}</span>
                        {note.updated_at !== note.created_at && note.updated_at && (
                            <span>• Updated: {formatDate(note.updated_at.toString())}</span>
                        )}
                        {note.duration && (
                            <>
                                <span>•</span>
                                <span>Duration: {formatDuration(note.duration)}</span>
                            </>
                        )}
                    </div>
                )}

                {/* Content */}
                {isEditing ? (
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        placeholder="Note content..."
                    />
                ) : (
                    <div className="prose max-w-none">
                        {note?.content ? (
                            <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                        ) : (
                            <p className="text-gray-400 italic">No content</p>
                        )}
                    </div>
                )}
            </div>

            {/* Audio Recorder for New Notes */}
            {isNew && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Voice Note</h2>
                    <div className="flex flex-col items-center space-y-4">
                        <div className="text-3xl font-mono font-bold text-gray-800">
                            {Math.floor(duration / 60000).toString().padStart(2, '0')}:
                            {Math.floor((duration % 60000) / 1000).toString().padStart(2, '0')}
                        </div>
                        <div className="flex space-x-4">
                            {!isRecording ? (
                                <button
                                    onClick={startRecording}
                                    className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                                    title="Start Recording"
                                >
                                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                    </svg>
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={isPaused ? resumeRecording : pauseRecording}
                                        className="p-4 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors shadow-lg"
                                        title={isPaused ? "Resume" : "Pause"}
                                    >
                                        {isPaused ? (
                                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                    <button
                                        onClick={stopRecording}
                                        className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                                        title="Stop and Save"
                                    >
                                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>
                        {audioBlob && !isRecording && (
                            <button
                                onClick={handleAudioUpload}
                                disabled={saving}
                                className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Processing...' : 'Upload & Transcribe'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Audio Player for Existing Notes */}
            {note?.audio_url && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Audio Recording</h2>
                    <AudioPlayer audioUrl={note.audio_url} duration={note.duration} />
                </div>
            )}

            {/* Transcript */}
            {note?.transcript && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Transcript</h2>
                    <p className="text-gray-700 whitespace-pre-wrap">{note.transcript}</p>
                </div>
            )}

            {/* Tags */}
            {(isNew || (note && note.tags)) && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Tags</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {note?.tags && note.tags.length > 0 ? (
                            note.tags.map((tag: Tag) => (
                                <span
                                    key={tag.id}
                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                                >
                                    {tag.name}
                                    <button
                                        onClick={() => handleRemoveTag(tag.name)}
                                        className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                                        aria-label={`Remove ${tag.name} tag`}
                                    >
                                        <svg
                                            className="w-4 h-4"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                </span>
                            ))
                        ) : (
                            <p className="text-gray-500 italic">No tags</p>
                        )}
                    </div>
                    {!isNew && (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                                placeholder="Add a tag..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleAddTag}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                Add Tag
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Related Notes */}
            {!isNew && note?.related_notes && note.related_notes.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Notes</h2>
                    <div className="space-y-4">
                        {note.related_notes.map((related: RelatedNote) => (
                            <div
                                key={related.id}
                                onClick={() => navigate(`/notes/${related.id}`)}
                                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <h3 className="font-medium text-gray-900 mb-1">
                                    {related.title || 'Untitled Note'}
                                </h3>
                                <p className="text-sm text-gray-600 mb-2">
                                    {related.connection_reason}
                                </p>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>Similarity: {(related.similarity_score * 100).toFixed(1)}%</span>
                                    <span>{formatDate(related.created_at.toString())}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
