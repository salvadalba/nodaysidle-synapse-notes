import { Router, Response } from 'express';
import pg from 'pg';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';
import { SearchRequest, SearchResult } from '../../../shared/types/index.js';
import { embeddingService } from '../services/EmbeddingService.js';

const router = Router();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * POST /api/search - Semantic search endpoint
 */
router.post('/', authenticateToken, async (req: AuthRequest<{}, {}, SearchRequest>, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { query, limit = 10, threshold = 0.7 } = req.body;

        // Validate query
        if (!query || query.trim().length === 0) {
            res.status(400).json({ error: 'Query cannot be empty' });
            return;
        }

        // Validate limit
        if (limit < 1 || limit > 100) {
            res.status(400).json({ error: 'Limit must be between 1 and 100' });
            return;
        }

        // Validate threshold
        if (threshold < 0 || threshold > 1) {
            res.status(400).json({ error: 'Threshold must be between 0 and 1' });
            return;
        }

        // Generate embedding for the query
        const queryEmbedding = await embeddingService.generateEmbedding(query);

        // Search for similar notes using pgvector
        const searchQuery = `
            SELECT 
                id,
                user_id,
                title,
                content,
                transcript,
                audio_url,
                duration,
                embedding_status,
                created_at,
                updated_at,
                1 - (embedding <=> $1) as similarity_score
            FROM notes
            WHERE user_id = $2
                AND embedding IS NOT NULL
                AND 1 - (embedding <=> $1) >= $3
            ORDER BY embedding <=> $1
            LIMIT $4
        `;

        const result = await pool.query(searchQuery, [
            `[${queryEmbedding.join(',')}]`,
            user_id,
            threshold,
            limit,
        ]);

        // Format results with transcript snippets
        const searchResults: SearchResult[] = result.rows.map((row) => {
            // Generate transcript snippet (first 200 characters)
            let transcriptSnippet: string | undefined;
            if (row.transcript && row.transcript.length > 0) {
                transcriptSnippet = row.transcript.substring(0, 200);
                if (row.transcript.length > 200) {
                    transcriptSnippet += '...';
                }
            }

            return {
                note: {
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
                },
                transcript_snippet: transcriptSnippet,
                similarity_score: row.similarity_score,
            };
        });

        res.json({
            query,
            results: searchResults,
            total: searchResults.length,
        });
    } catch (error) {
        console.error('Error performing semantic search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/search/similar/:noteId - Get similar notes for a specific note
 */
router.get('/similar/:noteId', authenticateToken, async (req: AuthRequest<{ noteId: string }>, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const { noteId } = req.params;
        const limit = parseInt(req.query.limit as string) || 5;
        const threshold = parseFloat(req.query.threshold as string) || 0.7;

        // Validate limit
        if (limit < 1 || limit > 100) {
            res.status(400).json({ error: 'Limit must be between 1 and 100' });
            return;
        }

        // Validate threshold
        if (threshold < 0 || threshold > 1) {
            res.status(400).json({ error: 'Threshold must be between 0 and 1' });
            return;
        }

        // Check if note exists and belongs to user
        const noteCheck = await pool.query(
            'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
            [noteId, user_id]
        );

        if (noteCheck.rows.length === 0) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        // Find similar notes using pgvector
        const query = `
            SELECT 
                id,
                user_id,
                title,
                content,
                transcript,
                audio_url,
                duration,
                embedding_status,
                created_at,
                updated_at,
                1 - (embedding <=> (SELECT embedding FROM notes WHERE id = $1)) as similarity_score
            FROM notes
            WHERE id != $1
                AND user_id = $2
                AND embedding IS NOT NULL
                AND 1 - (embedding <=> (SELECT embedding FROM notes WHERE id = $1)) >= $3
            ORDER BY embedding <=> (SELECT embedding FROM notes WHERE id = $1)
            LIMIT $4
        `;

        const result = await pool.query(query, [noteId, user_id, threshold, limit]);

        // Format results with transcript snippets
        const searchResults: SearchResult[] = result.rows.map((row) => {
            let transcriptSnippet: string | undefined;
            if (row.transcript && row.transcript.length > 0) {
                transcriptSnippet = row.transcript.substring(0, 200);
                if (row.transcript.length > 200) {
                    transcriptSnippet += '...';
                }
            }

            return {
                note: {
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
                },
                transcript_snippet: transcriptSnippet,
                similarity_score: row.similarity_score,
            };
        });

        res.json({
            noteId,
            results: searchResults,
            total: searchResults.length,
        });
    } catch (error) {
        console.error('Error finding similar notes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
