import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

interface RateLimitStore {
    [userId: string]: RateLimitEntry;
}

export interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Maximum requests per window
}

/**
 * In-memory rate limiter for upload endpoints
 * Tracks requests per user and enforces limits
 */
export class RateLimiter {
    private store: RateLimitStore = {};
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;
        // Clean up expired entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if request should be rate limited
     * @param userId - User ID to check
     * @returns Object with allowed status and retry time if limited
     */
    check(userId: string): { allowed: boolean; retryAfter?: number } {
        const now = Date.now();
        const entry = this.store[userId];

        // If no entry exists or window has expired, create new entry
        if (!entry || now >= entry.resetTime) {
            this.store[userId] = {
                count: 1,
                resetTime: now + this.config.windowMs,
            };
            return { allowed: true };
        }

        // Increment count
        entry.count++;

        // Check if limit exceeded
        if (entry.count > this.config.maxRequests) {
            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
            return { allowed: false, retryAfter };
        }

        return { allowed: true };
    }

    /**
     * Clean up expired entries from store
     */
    private cleanup(): void {
        const now = Date.now();
        for (const userId in this.store) {
            if (now >= this.store[userId].resetTime) {
                delete this.store[userId];
            }
        }
    }

    /**
     * Reset rate limit for a specific user (useful for testing)
     * @param userId - User ID to reset
     */
    reset(userId: string): void {
        delete this.store[userId];
    }

    /**
     * Get current count for a user
     * @param userId - User ID to check
     * @returns Current count and reset time
     */
    getStatus(userId: string): { count: number; resetTime: number } | null {
        const entry = this.store[userId];
        if (!entry || Date.now() >= entry.resetTime) {
            return null;
        }
        return {
            count: entry.count,
            resetTime: entry.resetTime,
        };
    }
}

// Create rate limiter for uploads: 10 requests per minute
export const uploadRateLimiter = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
});

/**
 * Express middleware to apply rate limiting to upload endpoints
 * @param limiter - RateLimiter instance to use
 * @returns Express middleware function
 */
export const rateLimitMiddleware = (limiter: RateLimiter) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        const userId = req.user_id;

        if (!userId) {
            // If user is not authenticated, let the auth middleware handle it
            next();
            return;
        }

        const result = limiter.check(userId);

        if (!result.allowed) {
            res.status(429).json({
                error: 'Too many requests',
                retryAfter: result.retryAfter,
            });
            res.setHeader('Retry-After', result.retryAfter?.toString() || '60');
            return;
        }

        // Add rate limit info to response headers
        const status = limiter.getStatus(userId);
        if (status) {
            res.setHeader('X-RateLimit-Limit', limiter['config'].maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', Math.max(0, limiter['config'].maxRequests - status.count).toString());
            res.setHeader('X-RateLimit-Reset', new Date(status.resetTime).toISOString());
        }

        next();
    };
};

// Export middleware configured for uploads
export const uploadRateLimitMiddleware = rateLimitMiddleware(uploadRateLimiter);
