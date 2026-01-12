import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import pg from 'pg';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';
import { uploadRateLimitMiddleware } from '../middleware/rateLimit.js';
import { audioStorageService } from '../services/AudioStorageService.js';
import { audioProcessingService } from '../services/AudioProcessingService.js';
import { transcriptionService } from '../services/TranscriptionService.js';
import { AudioUploadResponse } from '../../../shared/types/index.js';

const router = Router();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Configure multer for memory storage (we'll process the file before saving)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (_req, _file, cb) => {
        // Allow all audio formats, validation will happen in the route handler
        cb(null, true);
    },
});

/**
 * POST /api/audio/upload - Upload audio file and create note
 */
router.post('/upload', authenticateToken, uploadRateLimitMiddleware, upload.single('audio'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Check if file was uploaded
        if (!req.file) {
            res.status(400).json({ error: 'No audio file provided' });
            return;
        }

        const { originalname, buffer } = req.file;

        // Validate audio format
        const formatValidation = audioProcessingService.validateAudioFormat(buffer);
        if (!formatValidation.valid) {
            res.status(400).json({ error: formatValidation.error || 'Invalid audio format' });
            return;
        }

        // Validate audio duration
        const durationResult = await audioProcessingService.extractAudioDuration(buffer);
        if (!durationResult.valid) {
            res.status(400).json({ error: durationResult.error || 'Invalid audio duration' });
            return;
        }

        const duration = durationResult.duration;

        // Store the file
        const relativePath = await audioStorageService.storeFile(buffer, originalname, user_id);

        // Get audio URL
        const audio_url = await audioStorageService.getSignedUrl(relativePath);

        // Generate default title for the note
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        };
        const dateStr = now.toLocaleDateString('en-US', options);
        const title = `Note - ${dateStr}`;

        // Create note entry
        const noteResult = await pool.query(
            `INSERT INTO notes (user_id, title, audio_url, duration, embedding_status)
             VALUES ($1, $2, $3, $4, 'pending')
             RETURNING id, user_id, title, content, transcript, audio_url, duration, embedding_status, created_at, updated_at`,
            [user_id, title, audio_url, duration]
        );

        const note = noteResult.rows[0];

        // Trigger transcription in background
        const fullFilePath = audioStorageService.getFullFilePath(relativePath);
        transcriptionService.queueTranscription(note.id, fullFilePath);

        const response: AudioUploadResponse = {
            note_id: note.id,
            audio_url: note.audio_url || '',
            duration: note.duration || 0,
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error uploading audio:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/audio/stream/:path - Stream audio file
 * Supports Range header for seeking
 */
router.get('/stream/*', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user_id;
        if (!user_id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Extract the path from the URL
        const path = req.path.replace('/api/audio/stream/', '');

        if (!path) {
            res.status(400).json({ error: 'Invalid file path' });
            return;
        }

        // Verify that the file belongs to the authenticated user
        const pathParts = path.split('/');
        if (pathParts.length < 2) {
            res.status(400).json({ error: 'Invalid file path format' });
            return;
        }

        const fileUserId = pathParts[0];
        if (fileUserId !== user_id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        // Get full file path
        const filePath = audioStorageService.getFullFilePath(path);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        // Get file stats
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;

        // Determine content type based on file extension
        const ext = path.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            m4a: 'audio/mp4',
            webm: 'audio/webm',
        };
        const contentType = contentTypes[ext || ''] || 'audio/mpeg';

        // Handle Range header for seeking
        const range = req.headers.range;

        if (range) {
            // Parse range header (format: "bytes=start-end")
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            // Validate range
            if (start >= fileSize || end >= fileSize || start > end) {
                res.status(416).json({ error: 'Requested range not satisfiable' });
                return;
            }

            const chunkSize = end - start + 1;

            // Create read stream for the requested range
            const stream = fs.createReadStream(filePath, { start, end });

            // Set headers for partial content
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
            });

            stream.pipe(res);
        } else {
            // No range header, send entire file
            const stream = fs.createReadStream(filePath);

            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
            });

            stream.pipe(res);
        }
    } catch (error) {
        console.error('Error streaming audio:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
