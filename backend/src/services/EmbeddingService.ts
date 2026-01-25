import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from 'crypto';

/**
 * Simple LRU Cache implementation for embeddings
 */
class LRUCache<K, V> {
    private cache: Map<K, V>;
    private readonly maxSize: number;

    constructor(maxSize: number) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        // If key exists, delete it first to update position
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }
}

export class EmbeddingService {
    private genAI: GoogleGenerativeAI | null = null;
    private cache: LRUCache<string, number[]>;
    private readonly MAX_RETRIES = 3;
    private readonly BASE_DELAY = 1000; // 1 second
    private readonly MAX_CACHE_SIZE = 1000; // Limit to 1000 embeddings (~6MB for 768-dim vectors)

    constructor() {
        // Support both env var names for flexibility
        const apiKey = process.env.GOOGLE_API_KEY || process.env.NANO_BANANA_API_KEY;
        if (!apiKey) {
            console.warn('GOOGLE_API_KEY (or NANO_BANANA_API_KEY) not found in environment variables');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
        this.cache = new LRUCache<string, number[]>(this.MAX_CACHE_SIZE);
    }

    /**
     * Generate embedding for a given text using Google Gemini API
     * @param text - Text to generate embedding for
     * @returns Promise<number[]> - 768-dimension vector (standard for text-embedding-004)
     */
    async generateEmbedding(text: string): Promise<number[]> {
        // Check cache first
        const cacheKey = this.getCacheKey(text);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        if (!this.genAI) {
            throw new Error('Google Gemini API key not configured');
        }

        // Validate input
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }

        let lastError: Error | null = null;

        // Retry logic with exponential backoff
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const model = this.genAI.getGenerativeModel({ model: "text-embedding-004" });

                const result = await model.embedContent(text);
                const embedding = result.embedding.values;

                // Cache the result
                this.cache.set(cacheKey, embedding);

                return embedding;
            } catch (error) {
                lastError = error as Error;
                console.error(`Embedding generation attempt ${attempt} failed: `, error);

                // If this is the last attempt, throw the error
                if (attempt === this.MAX_RETRIES) {
                    throw new Error(`Failed to generate embedding after ${this.MAX_RETRIES} attempts: ${lastError.message} `);
                }

                // Calculate delay with exponential backoff
                const delay = this.BASE_DELAY * Math.pow(2, attempt - 1);
                console.log(`Retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }

        // This should never be reached
        throw new Error(`Failed to generate embedding: ${lastError?.message || 'Unknown error'} `);
    }

    /**
     * Generate cache key for text using SHA-256
     * @param text - Text to generate key for
     * @returns string - Cache key (SHA-256 hash)
     */
    private getCacheKey(text: string): string {
        return createHash('sha256').update(text).digest('hex');
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
        this.cache.clear();
    }

    /**
     * Get cache size
     * @returns number - Number of cached embeddings
     */
    getCacheSize(): number {
        return this.cache.size;
    }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
