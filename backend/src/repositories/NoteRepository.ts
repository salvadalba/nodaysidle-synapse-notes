import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

interface Note {
    id: string;
    user_id: string;
    title: string;
    content?: string;
    transcript?: string;
    audio_url?: string;
    duration?: number;
    embedding_status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: Date;
    updated_at: Date;
}

export interface NoteWithSimilarity {
    id: string;
    user_id: string;
    title: string;
    content?: string;
    transcript?: string;
    audio_url?: string;
    duration?: number;
    embedding_status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: Date;
    updated_at: Date;
    similarity_score: number;
}

export class NoteRepository {
    /**
     * Find similar notes using pgvector cosine similarity
     * @param noteId - ID of the note to find similar notes for
     * @param threshold - Minimum similarity score (0-1), default 0.7
     * @param limit - Maximum number of results, default 5
     * @returns Promise<NoteWithSimilarity[]> - Array of similar notes with similarity scores
     */
    async findSimilarNotes(
        noteId: string,
        threshold: number = 0.7,
        limit: number = 5
    ): Promise<NoteWithSimilarity[]> {
        try {
            // Validate threshold
            if (threshold < 0 || threshold > 1) {
                throw new Error('Threshold must be between 0 and 1');
            }

            // Validate limit
            if (limit < 1 || limit > 100) {
                throw new Error('Limit must be between 1 and 100');
            }

            // Query using pgvector cosine similarity
            // <=> operator calculates cosine distance (lower is more similar)
            // We convert to similarity score: 1 - distance
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
                    AND embedding IS NOT NULL
                    AND 1 - (embedding <=> (SELECT embedding FROM notes WHERE id = $1)) >= $2
                ORDER BY embedding <=> (SELECT embedding FROM notes WHERE id = $1)
                LIMIT $3
            `;

            const result = await pool.query(query, [noteId, threshold, limit]);

            return result.rows.map((row) => ({
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
            }));
        } catch (error) {
            console.error('Error finding similar notes:', error);
            throw error;
        }
    }

    /**
     * Update note embedding in database
     * @param noteId - ID of the note
     * @param embedding - 1536-dimension vector
     */
    async updateNoteEmbedding(noteId: string, embedding: number[]): Promise<void> {
        try {
            // Validate embedding dimensions
            if (embedding.length !== 1536) {
                throw new Error(`Expected 1536 dimensions, got ${embedding.length}`);
            }

            await pool.query(
                'UPDATE notes SET embedding = $1, embedding_status = $2 WHERE id = $3',
                [embedding, 'completed', noteId]
            );
        } catch (error) {
            console.error('Error updating note embedding:', error);
            throw error;
        }
    }

    /**
     * Update embedding status for a note
     * @param noteId - ID of the note
     * @param status - New embedding status
     */
    async updateEmbeddingStatus(
        noteId: string,
        status: 'pending' | 'processing' | 'completed' | 'failed'
    ): Promise<void> {
        try {
            await pool.query(
                'UPDATE notes SET embedding_status = $1 WHERE id = $2',
                [status, noteId]
            );
        } catch (error) {
            console.error('Error updating embedding status:', error);
            throw error;
        }
    }

    /**
     * Get note by ID with embedding
     * @param noteId - ID of the note
     * @returns Promise<Note | null> - Note with embedding or null if not found
     */
    async getNoteWithEmbedding(noteId: string): Promise<(Note & { embedding?: number[] }) | null> {
        try {
            const result = await pool.query(
                'SELECT * FROM notes WHERE id = $1',
                [noteId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
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
                embedding: row.embedding,
            };
        } catch (error) {
            console.error('Error getting note with embedding:', error);
            throw error;
        }
    }

    /**
     * Create manual link between notes
     * @param sourceNoteId - ID of the source note
     * @param targetNoteId - ID of the target note
     */
    async createManualLink(sourceNoteId: string, targetNoteId: string): Promise<void> {
        try {
            await pool.query(
                'INSERT INTO manual_links (source_note_id, target_note_id) VALUES ($1, $2)',
                [sourceNoteId, targetNoteId]
            );
        } catch (error) {
            console.error('Error creating manual link:', error);
            throw error;
        }
    }

    /**
     * Get manual links for a note
     * @param noteId - ID of the note
     * @returns Promise<ManualLink[]> - Array of manual links
     */
    async getManualLinks(noteId: string): Promise<any[]> {
        try {
            const result = await pool.query(
                `SELECT id, source_note_id, target_note_id, created_at
                 FROM manual_links
                 WHERE source_note_id = $1 OR target_note_id = $1`,
                [noteId]
            );

            return result.rows;
        } catch (error) {
            console.error('Error getting manual links:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const noteRepository = new NoteRepository();
