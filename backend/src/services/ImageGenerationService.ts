import fs from 'fs/promises';
import path from 'path';

/**
 * Result of image generation operation
 */
export interface ImageGenerationResult {
    success: boolean;
    filename?: string;
    error?: string;
}

export class ImageGenerationService {
    private apiKey: string;
    private storagePath: string;

    constructor() {
        this.apiKey = process.env.GOOGLE_API_KEY || process.env.NANO_BANANA_API_KEY || '';
        this.storagePath = process.env.AUDIO_STORAGE_PATH || './audio_uploads';

        if (!this.apiKey) {
            console.warn('Google API Key not configured for Image Generation');
        }
    }

    /**
     * Generate an image based on the text prompt using Imagen 3
     * @param prompt - Text prompt for image generation
     * @param noteId - ID of the note to associate the image with
     * @returns Promise<ImageGenerationResult> - Result with filename on success, error message on failure
     */
    async generateImage(prompt: string, noteId: string): Promise<ImageGenerationResult> {
        if (!this.apiKey) {
            return {
                success: false,
                error: 'Google API Key is required for image generation'
            };
        }

        try {
            console.log(`Generating image for note ${noteId} with prompt: ${prompt.substring(0, 50)}...`);

            const safePrompt = `A purely abstract, artistic visualization of: ${prompt}. Digital art style, neutral, no text.`;

            // Using the standard generative language API for Imagen
            const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey
                },
                body: JSON.stringify({
                    instances: [
                        { prompt: safePrompt }
                    ],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: "1:1"
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Image Gen API Error:', errorText);
                return {
                    success: false,
                    error: `API returned ${response.status}: ${errorText}`
                };
            }

            const data = await response.json() as any;

            if (!data || !data.predictions || data.predictions.length === 0) {
                console.error('Image Gen Response:', JSON.stringify(data));
                return {
                    success: false,
                    error: 'No image generated from API'
                };
            }

            const base64Image = data.predictions[0].bytesBase64Encoded;
            if (!base64Image) {
                return {
                    success: false,
                    error: 'Image data not found in response'
                };
            }

            const buffer = Buffer.from(base64Image, 'base64');
            const filename = `image-${noteId}-${Date.now()}.png`;
            // Ensure we use the correct absolute path relative to the container/process workspace
            const fullStoragePath = path.resolve(process.cwd(), this.storagePath);
            const filePath = path.join(fullStoragePath, filename);

            // Create directory if it doesn't exist (async)
            await fs.mkdir(fullStoragePath, { recursive: true });
            await fs.writeFile(filePath, buffer);
            console.log(`Image saved to ${filePath}`);

            return {
                success: true,
                filename
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Image generation failed:', error);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
}

export const imageGenerationService = new ImageGenerationService();
