import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import { embeddingService } from './EmbeddingService.js';
import { noteRepository } from '../repositories/NoteRepository.js';
import pool from '../db/pool.js';

interface TranscriptionJob {
    note_id: string;
    audio_path: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    error?: string;
}

export class TranscriptionService {
    private genAI: GoogleGenerativeAI | null = null;
    private queue: TranscriptionJob[] = [];
    private isProcessing = false;

    constructor() {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.NANO_BANANA_API_KEY;
        if (!apiKey) {
            console.warn('GOOGLE_API_KEY (or NANO_BANANA_API_KEY) not found in environment variables');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    /**
     * Transcribe audio file using Google Gemini API
     * @param audioPath - Path to the audio file
     * @param noteId - ID of the note to update
     * @returns Promise<string> - Transcribed text
     */
    async transcribeAudio(audioPath: string, noteId: string): Promise<string> {
        if (!this.genAI) {
            throw new Error('Gemini API key (GOOGLE_API_KEY) not configured');
        }

        // Validate audio file exists
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        try {
            // Read the audio file
            const audioBuffer = fs.readFileSync(audioPath);
            const audioBase64 = audioBuffer.toString('base64');

            // Use Gemini 2.0 Flash for fast and efficient transcription
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const result = await model.generateContent([
                {
                    inlineData: {
                        mimeType: "audio/mpeg", // Assume mp3 for simplicity, or detect from extension
                        data: audioBase64
                    }
                },
                { text: "Please transcribe this audio accurately. If it's short, provide the full text. Only return the transcript, nothing else." },
            ]);

            const transcript = result.response.text();

            if (!transcript) {
                throw new Error('Gemini returned an empty transcript');
            }

            // Update note with transcript
            await this.updateNoteTranscript(noteId, transcript);

            // Update embedding status to pending
            await this.updateEmbeddingStatus(noteId, 'pending');

            return transcript;
        } catch (error) {
            console.error('Error transcribing audio:', error);
            throw new Error(`Transcription failed: ${(error as Error).message}`);
        }
    }

    /**
     * Add transcription job to queue
     * @param noteId - ID of the note
     * @param audioPath - Path to the audio file
     */
    async queueTranscription(noteId: string, audioPath: string): Promise<void> {
        const job: TranscriptionJob = {
            note_id: noteId,
            audio_path: audioPath,
            status: 'pending',
        };

        this.queue.push(job);
        console.log(`Transcription job queued for note ${noteId}`);

        // Start processing if not already running
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process transcription queue
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (!job) continue;

            try {
                job.status = 'processing';
                console.log(`Processing transcription for note ${job.note_id}`);

                const transcript = await this.transcribeAudio(job.audio_path, job.note_id);

                job.status = 'completed';
                console.log(`Transcription completed for note ${job.note_id}`);

                // Generate embedding asynchronously (don't block the queue)
                this.generateEmbeddingForNote(job.note_id, transcript).catch(err => {
                    console.error(`Failed to generate embedding for note ${job.note_id}:`, err);
                });
            } catch (error) {
                job.status = 'failed';
                job.error = (error as Error).message;
                console.error(`Transcription failed for note ${job.note_id}:`, error);

                // Update note with error status
                await this.updateEmbeddingStatus(job.note_id, 'failed');
            }
        }

        this.isProcessing = false;
    }

    /**
     * Update note transcript in database
     * @param noteId - ID of the note
     * @param transcript - Transcribed text
     */
    private async updateNoteTranscript(noteId: string, transcript: string): Promise<void> {
        try {
            await pool.query(
                'UPDATE notes SET transcript = $1 WHERE id = $2',
                [transcript, noteId]
            );

            // Trigger image generation asynchronously
            // We don't await this to keep transcription response fast,
            // or we could await if we want to ensure it's done before 'completed' status.
            // Given the queue system, awaiting is safer.
            try {
                const { imageGenerationService } = await import('./ImageGenerationService.js');
                // Generate a prompt based on the transcript summary or just the first chunk
                // Use a truncated version to avoid token limits in prompt
                // Apply content moderation before sending to image generation
                const sanitizedPrompt = this.sanitizePromptForImageGeneration(transcript.substring(0, 1000));

                if (!sanitizedPrompt) {
                    console.log(`Skipping image generation for note ${noteId}: content failed moderation`);
                } else {
                    const result = await imageGenerationService.generateImage(sanitizedPrompt, noteId);

                    if (result.success && result.filename) {
                        const imageUrl = `/api/images/${result.filename}`;
                        await pool.query(
                            'UPDATE notes SET image_url = $1 WHERE id = $2',
                            [imageUrl, noteId]
                        );
                        console.log(`Image generated and linked for note ${noteId}`);
                    } else if (!result.success) {
                        console.warn(`Image generation failed for note ${noteId}: ${result.error}`);
                    }
                }
            } catch (imgError) {
                console.error('Failed to generate image during transcription post-processing:', imgError);
                // Don't fail the whole job just because image gen failed
            }

        } catch (error) {
            console.error('Error updating note transcript:', error);
            throw error;
        }
    }

    /**
     * Update embedding status in database
     * @param noteId - ID of the note
     * @param status - New embedding status
     */
    private async updateEmbeddingStatus(
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
     * Get queue status
     * @returns Object with queue information
     */
    getQueueStatus(): {
        queueLength: number;
        isProcessing: boolean;
    } {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
        };
    }

    /**
     * Generate embedding for a note's transcript
     * @param noteId - ID of the note
     * @param transcript - The transcribed text to embed
     */
    private async generateEmbeddingForNote(noteId: string, transcript: string): Promise<void> {
        try {
            console.log(`Generating embedding for note ${noteId}`);
            await this.updateEmbeddingStatus(noteId, 'processing');

            // Generate embedding for the transcript
            const embedding = await embeddingService.generateEmbedding(transcript);

            // Store embedding in database
            await noteRepository.updateNoteEmbedding(noteId, embedding);

            await this.updateEmbeddingStatus(noteId, 'completed');
            console.log(`Embedding generated successfully for note ${noteId}`);
        } catch (error: unknown) {
            console.error(`Failed to generate embedding for note ${noteId}:`, error);
            await this.updateEmbeddingStatus(noteId, 'failed');
        }
    }

    /**
     * Sanitize and moderate content before using as image generation prompt
     * Filters out potentially harmful or inappropriate content
     * @param text - Raw text to sanitize
     * @returns Sanitized text or null if content should not be used for image generation
     */
    private sanitizePromptForImageGeneration(text: string): string | null {
        if (!text || text.trim().length === 0) {
            return null;
        }

        // Lowercase for pattern matching
        const lowerText = text.toLowerCase();

        // List of harmful content patterns to filter out
        // These patterns indicate content that should not be visualized
        const blockedPatterns = [
            // Violence and harm
            /\b(kill|murder|attack|assault|weapon|gun|bomb|explode|terrorist)\b/,
            /\b(violence|violent|gore|blood|death|dead|die|dying)\b/,
            // Explicit content
            /\b(nude|naked|sexual|porn|xxx|explicit)\b/,
            // Hate speech indicators
            /\b(hate|racist|racism|nazi|supremacist)\b/,
            // Self-harm
            /\b(suicide|self-harm|cut myself|end my life)\b/,
            // Illegal activities
            /\b(drug deal|illegal|smuggle|trafficking)\b/,
            // Personal identifying information patterns
            /\b(social security|ssn|credit card|password|bank account)\b/,
            /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
            /\b\d{16}\b/, // Credit card pattern
        ];

        // Check for blocked patterns
        for (const pattern of blockedPatterns) {
            if (pattern.test(lowerText)) {
                console.warn('Content moderation: blocked pattern detected in image prompt');
                return null;
            }
        }

        // Remove any potential prompt injection attempts
        // These could try to override the safe prompt prefix in ImageGenerationService
        const injectionPatterns = [
            /ignore previous instructions/i,
            /disregard the above/i,
            /forget everything/i,
            /new instructions:/i,
            /system prompt:/i,
        ];

        let sanitized = text;
        for (const pattern of injectionPatterns) {
            sanitized = sanitized.replace(pattern, '');
        }

        // Remove excessive special characters that might cause issues
        sanitized = sanitized
            .replace(/[<>{}[\]\\]/g, '') // Remove potentially problematic characters
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        // If sanitization removed too much content, reject it
        if (sanitized.length < 10) {
            return null;
        }

        return sanitized;
    }
}

// Export singleton instance
export const transcriptionService = new TranscriptionService();
