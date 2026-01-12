import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

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
        const apiKey = process.env.NANO_BANANA_API_KEY;
        if (!apiKey) {
            console.warn('NANO_BANANA_API_KEY not found in environment variables');
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
            throw new Error('Gemini API key (NANO_BANANA_API_KEY) not configured');
        }

        // Validate audio file exists
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        try {
            // Read the audio file
            const audioBuffer = fs.readFileSync(audioPath);
            const audioBase64 = audioBuffer.toString('base64');

            // Use Gemini 1.5 Flash for fast and efficient transcription
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

                await this.transcribeAudio(job.audio_path, job.note_id);

                job.status = 'completed';
                console.log(`Transcription completed for note ${job.note_id}`);
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
}

// Export singleton instance
export const transcriptionService = new TranscriptionService();
