import OpenAI from 'openai';

interface EmbeddingCache {
    [key: string]: number[];
}

export class EmbeddingService {
    private openai: OpenAI | null = null;
    private cache: EmbeddingCache = {};
    private readonly MAX_RETRIES = 3;
    private readonly BASE_DELAY = 1000; // 1 second

    constructor() {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.warn('OPENROUTER_API_KEY not found in environment variables');
        } else {
            this.openai = new OpenAI({
                apiKey,
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    'HTTP-Referer': 'https://github.com/nodaysidle/synapse-notes', // Optional, for OpenRouter tracking
                    'X-Title': 'Synapse Notes', // Optional, for OpenRouter tracking
                }
            });
        }
    }

    /**
     * Generate embedding for a given text using OpenAI API
     * @param text - Text to generate embedding for
     * @returns Promise<number[]> - 1536-dimension vector
     */
    async generateEmbedding(text: string): Promise<number[]> {
        // Check cache first
        const cacheKey = this.getCacheKey(text);
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        if (!this.openai) {
            throw new Error('OpenAI API key not configured');
        }

        // Validate input
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }

        let lastError: Error | null = null;

        // Retry logic with exponential backoff
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const response = await this.openai.embeddings.create({
                    model: 'openai/text-embedding-3-small',
                    input: text,
                    dimensions: 1536,
                });

                const embedding = response.data[0].embedding;

                // Validate embedding dimensions
                if (embedding.length !== 1536) {
                    throw new Error(`Expected 1536 dimensions, got ${embedding.length}`);
                }

                // Cache the result
                this.cache[cacheKey] = embedding;

                return embedding;
            } catch (error) {
                lastError = error as Error;
                console.error(`Embedding generation attempt ${attempt} failed:`, error);

                // If this is the last attempt, throw the error
                if (attempt === this.MAX_RETRIES) {
                    throw new Error(`Failed to generate embedding after ${this.MAX_RETRIES} attempts: ${lastError.message}`);
                }

                // Calculate delay with exponential backoff
                const delay = this.BASE_DELAY * Math.pow(2, attempt - 1);
                console.log(`Retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }

        // This should never be reached, but TypeScript needs it
        throw new Error(`Failed to generate embedding: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Generate cache key for text
     * @param text - Text to generate key for
     * @returns string - Cache key
     */
    private getCacheKey(text: string): string {
        // Simple hash function for caching
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }

    /**
     * Sleep for specified milliseconds
     * @param ms - Milliseconds to sleep
     * @returns Promise<void>
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clear the embedding cache
     */
    clearCache(): void {
        this.cache = {};
    }

    /**
     * Get cache size
     * @returns number - Number of cached embeddings
     */
    getCacheSize(): number {
        return Object.keys(this.cache).length;
    }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
