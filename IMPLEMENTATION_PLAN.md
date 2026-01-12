ROLE: Expert Full-Stack Engineer

GOAL: Initialize monorepo, database schema with pgvector, and JWT auth endpoints

CONTEXT: Set up project structure, PostgreSQL schema with pgvector, and JWT authentication system. Create monorepo with frontend/backend folders, shared types, and migration files.

FILES TO CREATE:

- frontend/package.json
- backend/package.json
- shared/types/index.ts
- backend/migrations/001_init.sql
- backend/src/middleware/auth.ts
- backend/src/routes/auth.ts

FILES TO MODIFY:
_None_

DETAILED STEPS:

1. Create monorepo: frontend/ (Vite + React + TS), backend/ (Node + Express + TS), shared/ (types)
2. Configure TypeScript in both packages and Tailwind CSS in frontend
3. Create migration with users, notes, tags, note_tags, manual_links tables, enable pgvector extension
4. Implement auth routes: POST /api/auth/register, /api/auth/login, /api/auth/refresh using bcrypt and JWT
5. Create auth middleware to verify Bearer tokens and attach user_id to request

VALIDATION:
cd backend && npm run typecheck && cd ../frontend && npm run typecheck

```

---

## Note CRUD & Audio Upload

**Context**
Implement note management endpoints and audio file handling with validation, storage, and streaming support.

### Universal Agent Prompt
```

ROLE: Expert Backend Engineer

GOAL: Build note CRUD, audio storage service, validation, and upload endpoints

CONTEXT: Implement note management endpoints and audio file handling with validation, storage, and streaming support.

FILES TO CREATE:

- backend/src/services/AudioStorageService.ts
- backend/src/services/AudioProcessingService.ts
- backend/src/routes/notes.ts
- backend/src/routes/audio.ts
- backend/src/middleware/rateLimit.ts

FILES TO MODIFY:
_None_

DETAILED STEPS:

1. Create AudioStorageService with storeFile(), getSignedUrl(), deleteFile() - local filesystem with S3 abstraction
2. Create AudioProcessingService with validateAudioFormat() (magic bytes for MP3/WAV/M4A/WEBM), extractAudioDuration(), max 10min
3. Implement POST /api/notes with title auto-generation, PATCH /api/notes/:id, DELETE /api/notes/:id, GET /api/notes with pagination
4. Implement POST /api/audio/upload with multipart validation, GET /api/audio/:id/stream with Range header support
5. Add rate limiting middleware: 10 uploads/minute per user

VALIDATION:
cd backend && npm run typecheck

```

---

## Semantic Search & Embeddings

**Context**
Implement embedding generation via OpenAI API, pgvector similarity search, and auto-linking between related notes.

### Universal Agent Prompt
```

ROLE: Expert Backend Engineer

GOAL: Build embedding service, pgvector similarity search, and semantic search endpoint

CONTEXT: Implement embedding generation via OpenAI API, pgvector similarity search, and auto-linking between related notes.

FILES TO CREATE:

- backend/src/services/EmbeddingService.ts
- backend/src/services/TranscriptionService.ts
- backend/src/routes/search.ts
- backend/src/repositories/NoteRepository.ts

FILES TO MODIFY:
_None_

DETAILED STEPS:

1. Create EmbeddingService using OpenAI Embeddings API, generateEmbedding() returns 1536-dim vector, handle retries
2. Create TranscriptionService for async transcription, updates note.transcript and embedding_status to 'pending' on success
3. Implement findSimilarNotes() in NoteRepository using pgvector cosine similarity with ivfflat index, threshold default 0.7
4. Create POST /api/search endpoint: convert query to embedding, return results with transcript_snippet and similarity_score
5. Add auto-linking: after embedding, find and store related notes (max 5), return in note response with connection_reason

VALIDATION:
cd backend && npm run typecheck

```

---

## Frontend Core & Auth UI

**Context**
Build React application with routing, authentication context/pages, and API client with token refresh.

### Universal Agent Prompt
```

ROLE: Expert Frontend Engineer

GOAL: Set up React app with auth flow, routing, and API client

CONTEXT: Build React application with routing, authentication context/pages, and API client with token refresh.

FILES TO CREATE:

- frontend/src/App.tsx
- frontend/src/contexts/AuthContext.tsx
- frontend/src/hooks/useAuth.ts
- frontend/src/lib/api.ts
- frontend/src/pages/Login.tsx
- frontend/src/pages/Register.tsx

FILES TO MODIFY:
_None_

DETAILED STEPS:

1. Initialize Vite + React + TypeScript + Tailwind CSS, configure react-router with routes: /, /login, /register, /notes, /graph
2. Create AuthContext with login/register/logout, token storage in localStorage, auto-refresh on expiry
3. Build API client fetch wrapper that adds Bearer token, handles 401 with refresh and retry
4. Create login and register forms with validation, error display, redirect to /notes on success
5. Create Layout component with navigation, protect routes that require authentication

VALIDATION:
cd frontend && npm run typecheck && npm run build

```

---

## Audio Recording & Notes UI

**Context**
Implement in-browser audio recording with MediaRecorder API, notes list/detail pages, and 3D graph visualization with Three.js.

### Universal Agent Prompt
```

ROLE: Expert Frontend Engineer

GOAL: Build audio recording hook, notes pages, and Three.js graph visualization

CONTEXT: Implement in-browser audio recording with MediaRecorder API, notes list/detail pages, and 3D graph visualization with Three.js.

FILES TO CREATE:

- frontend/src/hooks/useAudioRecorder.ts
- frontend/src/components/AudioRecorder.tsx
- frontend/src/components/AudioPlayer.tsx
- frontend/src/pages/NotesList.tsx
- frontend/src/pages/NoteDetail.tsx
- frontend/src/pages/GraphView.tsx

FILES TO MODIFY:
_None_

DETAILED STEPS:

1. Create useAudioRecorder hook using MediaRecorder API: start/stop/pause/resume, getDuration(), return Blob on stop
2. Build AudioRecorder component with timer, visual indicator, pause/resume, 8-minute warning
3. Create AudioPlayer with play/pause, seekable progress bar, playback speed (0.5x-2x), time display
4. Build NotesList with pagination, NoteDetail with transcript/tags/edit, and GraphView with Three.js nodes/edges
5. Implement graph: nodes sized by connection_count, recent notes glow brighter, force-directed layout, click to view note

VALIDATION:
cd frontend && npm run typecheck && npm run build
