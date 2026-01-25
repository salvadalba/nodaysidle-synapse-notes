import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';
import pool from '../db/pool.js';

const router = Router();

/**
 * Extract noteId from image filename
 * Expected format: image-{noteId}-{timestamp}.png
 */
function extractNoteIdFromFilename(filename: string): string | null {
    const match = filename.match(/^image-([a-f0-9-]+)-\d+\.png$/i);
    return match ? match[1] : null;
}

/**
 * Verify that the authenticated user owns the note associated with the image
 */
async function verifyImageOwnership(noteId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
        'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
        [noteId, userId]
    );
    return result.rows.length > 0;
}

/**
 * GET /api/images/:filename - Serve generated image
 * Only serves images for notes owned by the authenticated user
 */
router.get('/:filename', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { filename } = req.params as { filename: string };
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Sanitize filename to prevent directory traversal
        const safeFilename = path.basename(filename);

        // Extract noteId from filename and verify ownership
        const noteId = extractNoteIdFromFilename(safeFilename);
        if (!noteId) {
            res.status(400).json({ error: 'Invalid image filename format' });
            return;
        }

        const isOwner = await verifyImageOwnership(noteId, userId);
        if (!isOwner) {
            res.status(403).json({ error: 'Access denied: you do not own this image' });
            return;
        }

        const storagePath = process.env.AUDIO_STORAGE_PATH || './audio_uploads';
        const filePath = path.join(process.cwd(), storagePath, safeFilename);

        // Check if file exists (async)
        try {
            await fs.access(filePath);
        } catch {
            res.status(404).json({ error: 'Image not found' });
            return;
        }

        res.sendFile(filePath);
    } catch (error) {
        console.error('Error serving image:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
