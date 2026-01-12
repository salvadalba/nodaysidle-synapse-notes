import { Router, Response } from 'express';
import pg from 'pg';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';
import { CreateNoteDto, UpdateNoteDto, NoteWithDetails } from '../../../shared/types/index.js';

const router = Router();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Generate a default title for a note based on current date
 * @returns Default title string
 */
function generateDefaultTitle(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    };
    const dateStr = now.toLocaleDateString('en-US', options);
    return `Note - ${dateStr}`;
}

/**
 * POST /api/notes - Create a new note
 */
router.post('/', authenticateToken, async (req: AuthRequest<{}, {}, CreateNoteDto>, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { title, content, tags } = req.body;

        // Generate default title if not provided
        const noteTitle = title || generateDefaultTitle();

        // Create note
        const noteResult = await pool.query(
            `INSERT INTO notes (user_id, title, content, embedding_status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING id, user_id, title, content, transcript, audio_url, duration, embedding_status, created_at, updated_at`,
            [user_id, noteTitle, content || null]
        );

        const note = noteResult.rows[0];

        // Handle tags if provided
        if (tags && tags.length > 0) {
            for (const tagName of tags) {
                // Check if tag already exists for this user
                const existingTag = await pool.query(
                    'SELECT id FROM tags WHERE name = $1 AND user_id = $2',
                    [tagName, user_id]
                );

                let tagId: string;

                if (existingTag.rows.length > 0) {
                    tagId = existingTag.rows[0].id;
                } else {
                    // Create new tag
                    const newTag = await pool.query(
                        'INSERT INTO tags (name, user_id) VALUES ($1, $2) RETURNING id',
                        [tagName, user_id]
                    );
                    tagId = newTag.rows[0].id;
                }

                // Link note to tag
                await pool.query(
                    'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2)',
                    [note.id, tagId]
                );
            }
        }

        // Fetch complete note with tags
        const tagsResult = await pool.query(
            `SELECT t.id, t.name, t.user_id, t.created_at
             FROM tags t
             INNER JOIN note_tags nt ON t.id = nt.tag_id
             WHERE nt.note_id = $1`,
            [note.id]
        );

        const response: NoteWithDetails = {
            ...note,
            tags: tagsResult.rows,
            manual_links: [],
            related_notes: [],
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/notes/:id - Update a note
 */
router.patch('/:id', authenticateToken, async (req: AuthRequest<{ id: string }, {}, UpdateNoteDto>, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { id } = req.params;

        if (!isUuid(id)) {
            res.status(404).json({ error: 'Note not found (invalid ID)' });
            return;
        }

        const { title, content, tags } = req.body;

        // Check if note exists and belongs to user
        const existingNote = await pool.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (existingNote.rows.length === 0) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(title);
        }

        if (content !== undefined) {
            updates.push(`content = $${paramIndex++}`);
            values.push(content);
        }

        if (updates.length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        values.push(id, user_id);

        const updateQuery = `
            UPDATE notes
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
            RETURNING id, user_id, title, content, transcript, audio_url, duration, embedding_status, created_at, updated_at
        `;

        const result = await pool.query(updateQuery, values);
        const note = result.rows[0];

        // Handle tags update if provided
        if (tags !== undefined) {
            // Delete existing tag associations
            await pool.query('DELETE FROM note_tags WHERE note_id = $1', [id]);

            // Add new tag associations
            for (const tagName of tags) {
                const existingTag = await pool.query(
                    'SELECT id FROM tags WHERE name = $1 AND user_id = $2',
                    [tagName, user_id]
                );

                let tagId: string;

                if (existingTag.rows.length > 0) {
                    tagId = existingTag.rows[0].id;
                } else {
                    const newTag = await pool.query(
                        'INSERT INTO tags (name, user_id) VALUES ($1, $2) RETURNING id',
                        [tagName, user_id]
                    );
                    tagId = newTag.rows[0].id;
                }

                await pool.query(
                    'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2)',
                    [id, tagId]
                );
            }
        }

        // Fetch complete note with tags
        const tagsResult = await pool.query(
            `SELECT t.id, t.name, t.user_id, t.created_at
             FROM tags t
             INNER JOIN note_tags nt ON t.id = nt.tag_id
             WHERE nt.note_id = $1`,
            [id]
        );

        const response: NoteWithDetails = {
            ...note,
            tags: tagsResult.rows,
            manual_links: [],
            related_notes: [],
        };

        res.json(response);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/notes/:id - Delete a note and associated audio
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest<{ id: string }>, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { id } = req.params;

        if (!isUuid(id)) {
            res.status(404).json({ error: 'Note not found (invalid ID)' });
            return;
        }

        // Check if note exists and belongs to user, get audio_url if present
        const existingNote = await pool.query(
            'SELECT id, audio_url FROM notes WHERE id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (existingNote.rows.length === 0) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        const note = existingNote.rows[0];

        // Delete associated audio file if exists
        if (note.audio_url) {
            const { audioStorageService } = await import('../services/AudioStorageService.js');
            // Extract relative path from audio_url
            // audio_url format: /api/audio/stream/{userId}/{filename}
            const pathParts = note.audio_url.split('/api/audio/stream/');
            if (pathParts.length > 1) {
                await audioStorageService.deleteFile(pathParts[1]);
            }
        }

        // Delete note (cascades to note_tags, manual_links)
        await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [id, user_id]);

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/notes - List notes with pagination
 */
router.get('/', authenticateToken, async (req: AuthRequest<{}, {}, {}, { page?: string; limit?: string }>, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Parse pagination parameters
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;

        // Validate pagination parameters
        if (page < 1 || limit < 1 || limit > 100) {
            res.status(400).json({ error: 'Invalid pagination parameters' });
            return;
        }

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM notes WHERE user_id = $1',
            [user_id]
        );
        const total = parseInt(countResult.rows[0].total, 10);

        // Get notes with pagination
        const notesResult = await pool.query(
            `SELECT id, user_id, title, content, transcript, audio_url, duration, embedding_status, created_at, updated_at
             FROM notes
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [user_id, limit, offset]
        );

        const notes = notesResult.rows;

        // Fetch tags for each note
        const notesWithTags: NoteWithDetails[] = await Promise.all(
            notes.map(async (note) => {
                const tagsResult = await pool.query(
                    `SELECT t.id, t.name, t.user_id, t.created_at
                     FROM tags t
                     INNER JOIN note_tags nt ON t.id = nt.tag_id
                     WHERE nt.note_id = $1`,
                    [note.id]
                );

                return {
                    ...note,
                    tags: tagsResult.rows,
                    manual_links: [],
                    related_notes: [],
                };
            })
        );

        res.json({
            notes: notesWithTags,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error listing notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/notes/:id - Get a single note by ID
 */
router.get('/:id', authenticateToken, async (req: AuthRequest<{ id: string }>, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { id } = req.params;

        if (!isUuid(id)) {
            res.status(404).json({ error: 'Note not found (invalid ID)' });
            return;
        }

        // Get note
        const noteResult = await pool.query(
            `SELECT id, user_id, title, content, transcript, audio_url, duration, embedding_status, created_at, updated_at
             FROM notes
             WHERE id = $1 AND user_id = $2`,
            [id, user_id]
        );

        if (noteResult.rows.length === 0) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        const note = noteResult.rows[0];

        // Get tags
        const tagsResult = await pool.query(
            `SELECT t.id, t.name, t.user_id, t.created_at
             FROM tags t
             INNER JOIN note_tags nt ON t.id = nt.tag_id
             WHERE nt.note_id = $1`,
            [id]
        );

        // Get manual links
        const linksResult = await pool.query(
            `SELECT id, source_note_id, target_note_id, created_at
             FROM manual_links
             WHERE source_note_id = $1 OR target_note_id = $1`,
            [id]
        );

        // Get related notes (auto-linked similar notes)
        const relatedNotesResult = await pool.query(
            `SELECT 
                n.id,
                n.user_id,
                n.title,
                n.content,
                n.transcript,
                n.audio_url,
                n.duration,
                n.embedding_status,
                n.created_at,
                n.updated_at,
                1 - (n.embedding <=> (SELECT embedding FROM notes WHERE id = $1)) as similarity_score,
                'Auto-linked based on semantic similarity' as connection_reason
             FROM notes n
             INNER JOIN manual_links ml ON (ml.source_note_id = n.id OR ml.target_note_id = n.id)
             WHERE (ml.source_note_id = $1 OR ml.target_note_id = $1)
               AND n.id != $1
               AND n.embedding IS NOT NULL
             ORDER BY similarity_score DESC
             LIMIT 5`,
            [id]
        );

        const response: NoteWithDetails = {
            ...note,
            tags: tagsResult.rows,
            manual_links: linksResult.rows,
            related_notes: relatedNotesResult.rows.map(row => ({
                id: row.id,
                user_id: row.user_id,
                title: row.title,
                content: row.content,
                transcript: row.transcript,
                audio_url: row.audio_url,
                duration: row.duration,
                embedding_status: row.embedding_status,
                created_at: row.created_at,
                updated_at: row.updated_at,
                similarity_score: row.similarity_score,
                connection_reason: row.connection_reason,
            })),
        };

        res.json(response);
    } catch (error) {
        console.error('Error getting note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
