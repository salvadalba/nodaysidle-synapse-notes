import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import noteRoutes from './routes/notes.js';
import audioRoutes from './routes/audio.js';
import imageRoutes from './routes/images.js';
import searchRoutes from './routes/search.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/search', searchRoutes);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
