import pg from 'pg';

const { Pool } = pg;

/**
 * Shared database connection pool
 * All database operations should use this single pool instance
 * to prevent connection exhaustion and ensure consistent connection management
 */
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Connection pool settings for production use
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Log pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await pool.end();
    process.exit(0);
});

export default pool;
