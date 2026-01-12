import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const router = Router();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface RegisterRequest {
    email: string;
    password: string;
}

interface LoginRequest {
    email: string;
    password: string;
}

interface RefreshRequest {
    refresh_token: string;
}

// POST /api/auth/register
router.post('/register', async (req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
            [email, password_hash]
        );

        const user_id = result.rows[0].id;

        // Generate tokens
        const access_token = jwt.sign({ user_id }, JWT_SECRET, { expiresIn: '15m' });
        const refresh_token = jwt.sign({ user_id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            user_id,
            access_token,
            refresh_token,
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        // Find user
        const result = await pool.query(
            'SELECT id, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const user = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Generate tokens
        const access_token = jwt.sign({ user_id: user.id }, JWT_SECRET, { expiresIn: '15m' });
        const refresh_token = jwt.sign({ user_id: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            user_id: user.id,
            access_token,
            refresh_token,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request<{}, {}, RefreshRequest>, res: Response): Promise<void> => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            res.status(400).json({ error: 'Refresh token is required' });
            return;
        }

        // Verify refresh token
        const decoded = jwt.verify(refresh_token, JWT_SECRET) as { user_id: string };

        // Check if user exists
        const result = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [decoded.user_id]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid user' });
            return;
        }

        // Generate new access token
        const access_token = jwt.sign({ user_id: decoded.user_id }, JWT_SECRET, { expiresIn: '15m' });

        res.json({
            access_token,
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});

export default router;
