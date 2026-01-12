# TASKS

# Tasks Plan — Synapse Notes

## 📌 Global Assumptions

- Transcription API is external (e.g., OpenAI Whisper) and requires API key in environment
- Audio storage uses local filesystem in development, S3-compatible service in production
- pgvector extension available in PostgreSQL instance
- Single-tenant architecture (each user sees only their own notes)
- No real-time collaboration needed initially
- Browser supports MediaRecorder API (Chrome, Firefox, Safari modern versions)

## ⚠️ Risks

- Transcription API costs may escalate with usage - need cost monitoring
- pgvector performance may degrade with large datasets - index tuning required
- Audio file storage costs grow linearly with user base - cleanup policy needed
- Browser microphone permission may be blocked by some users' privacy settings
- Force-directed graph layout may become unstable with 500+ nodes
- Embedding API rate limits could bottleneck note creation

## 🧩 Epics

## Foundation & Authentication

**Goal:** Set up project infrastructure, database schema, and user authentication system

### ✅ Initialize project structure (small)

Create monorepo with frontend (React + Vite) and backend (Node.js + Express) folders. Configure TypeScript for both. Set up Tailwind CSS in frontend.

**Acceptance Criteria**

- Frontend and backend folders exist with package.json
- TypeScript compiles without errors in both
- Tailwind CSS configured and base styles applied
- Shared types package created for API contracts

**Dependencies**
_None_

### ✅ Set up PostgreSQL database schema (small)

Create migration files for users, notes, tags, note_tags, and manual_links tables. Enable pgvector extension. Add embedding column to notes.

**Acceptance Criteria**

- Users table with id, email, password_hash, name, created_at
- Notes table with id, user_id, title, transcript, audio_url, embedding (vector), created_at, updated_at
- Tags table with id, name
- note_tags junction table
- manual_links table with source_id, target_id, relationship_type
- pgvector extension enabled
- Migration runs successfully

**Dependencies**

- Initialize project structure

### ✅ Implement user registration (small)

Create POST /api/auth/register endpoint. Hash passwords with bcrypt (cost 12). Return JWT access and refresh tokens.

**Acceptance Criteria**

- Endpoint accepts email, password, name
- Password hashed with bcrypt
- User stored in database
- Returns access_token (1hr expiry) and refresh_token (30day expiry)
- 409 error on duplicate email
- 400 error on invalid input

**Dependencies**

- Set up PostgreSQL database schema

### ✅ Implement user login (small)

Create POST /api/auth/login endpoint. Verify credentials and return JWT tokens.

**Acceptance Criteria**

- Endpoint accepts email, password
- Verifies password against hash
- Returns access_token and refresh_token on success
- 401 error on invalid credentials

**Dependencies**

- Implement user registration

### ✅ Implement token refresh (small)

Create POST /api/auth/refresh endpoint. Validate refresh token and issue new token pair.

**Acceptance Criteria**

- Endpoint accepts refresh_token
- Validates token and issues new access_token and refresh_token
- 401 error on invalid/expired token

**Dependencies**

- Implement user login

### ✅ Create authentication middleware (small)

Build Express middleware to verify JWT Bearer tokens and attach user to request.

**Acceptance Criteria**

- Middleware extracts Bearer token from Authorization header
- Validates JWT and attaches user_id to request
- Returns 401 on invalid/missing token
- Applied to protected route as test

**Dependencies**

- Implement token refresh

## Note Management Core

**Goal:** Implement basic CRUD operations for notes without audio processing

### ✅ Create note creation endpoint (small)

Implement POST /api/notes. Support title (auto-generate if omitted) and tags. Return note with empty transcript.

**Acceptance Criteria**

- Creates note with user_id from auth context
- Auto-generates title from timestamp if not provided
- Supports optional tags array
- Returns note object with id, title, transcript (empty), created_at
- 400 error on invalid input

**Dependencies**

- Create authentication middleware

### ✅ Implement get note by ID (small)

Create GET /api/notes/:id. Return full note details with empty related_notes array.

**Acceptance Criteria**

- Returns note with id, title, transcript, audio_url, dates, tags
- 404 if note not found
- 403 if note belongs to different user
- related_notes returns empty array

**Dependencies**

- Create note creation endpoint

### ✅ Implement list notes with pagination (small)

Create GET /api/notes with page and page_size query params. Only return user's notes.

**Acceptance Criteria**

- Accepts page (default 1) and page_size (default 20)
- Returns notes array filtered by user_id
- Returns total count for pagination
- Notes ordered by created_at DESC

**Dependencies**

- Implement get note by ID

### ✅ Implement note update (small)

Create PATCH /api/notes/:id. Allow editing title, tags, and transcript (for manual edits).

**Acceptance Criteria**

- Updates only provided fields
- Returns updated note with updated_at timestamp
- 404 if note not found
- 403 if not owner

**Dependencies**

- Implement list notes with pagination

### ✅ Implement note deletion (small)

Create DELETE /api/notes/:id. Soft delete preferred for recovery.

**Acceptance Criteria**

- Marks note as deleted or removes from database
- Returns {deleted: true, id}
- 404 if note not found
- 403 if not owner

**Dependencies**

- Implement note update

## Audio Processing

**Goal:** Handle audio upload, validation, storage, and transcription

### ✅ Set up audio storage service (small)

Create service for storing audio files. Use local filesystem initially with S3 interface abstraction. Accept uploads up to 50MB.

**Acceptance Criteria**

- storeFile() accepts Buffer and key, returns URL
- getSignedUrl() returns accessible URL for audio
- deleteFile() removes stored file
- Validates file size <= 50MB

**Dependencies**

- Implement note creation endpoint

### ✅ Implement audio validation (medium)

Create AudioProcessingService with format validation by magic bytes. Accept MP3, WAV, M4A, WEBM. Extract duration.

**Acceptance Criteria**

- validateAudioFormat() checks magic bytes, not extension
- Accepts MP3, WAV, M4A, WEBM
- extractAudioDuration() returns duration in seconds
- Max 10 minutes (600 seconds) enforced
- Returns helpful error messages on validation failure

**Dependencies**

- Set up audio storage service

### ✅ Create audio upload endpoint (small)

Implement POST /api/audio/upload with multipart/form-data. Validate and store audio. Create pending note.

**Acceptance Criteria**

- Accepts audio_file and optional title
- Validates format and size before processing
- Returns upload_id, status='processing', note_id
- Creates note record with audio_url
- 400 on invalid format, 413 on oversized file

**Dependencies**

- Implement audio validation

### ✅ Implement audio streaming endpoint (small)

Create GET /api/audio/:id/stream. Serve audio binary with proper Content-Type.

**Acceptance Criteria**

- Returns audio stream with correct MIME type
- Supports Range headers for seeking
- 404 if audio not found
- 403 if user doesn't own note

**Dependencies**

- Create audio upload endpoint

### ✅ Integrate transcription service (medium)

Create TranscriptionService that calls external API (e.g., OpenAI Whisper). Store results in note.transcript.

**Acceptance Criteria**

- transcribe() sends audio_url to provider
- Polls for job completion async
- Updates note with transcript when complete
- Handles failures gracefully with status tracking
- Updates embedding_status to 'pending' on success

**Dependencies**

- Implement audio streaming endpoint

### ✅ Add rate limiting for uploads (small)

Implement 10 uploads per minute per user. Use express-rate-limit or similar.

**Acceptance Criteria**

- Rate limit enforced per user_id
- Returns 429 with retry-after header when exceeded
- Configurable limit via environment variable

**Dependencies**

- Create audio upload endpoint

## Semantic Search & Auto-Linking

**Goal:** Generate embeddings, enable semantic search, and auto-link related notes

### ✅ Set up embedding generation (medium)

Create EmbeddingService using OpenAI Embeddings API or similar. Generate 1536-dimensional vectors.

**Acceptance Criteria**

- generateEmbedding() returns number[] from text
- Handles API errors with retries
- Stores embedding in pgvector column
- Updates embedding_status to 'complete' or 'failed'

**Dependencies**

- Integrate transcription service

### ✅ Create pgvector similarity search (medium)

Implement findSimilarNotes() using pgvector cosine similarity. Use ivfflat index for performance.

**Acceptance Criteria**

- Query returns notes ranked by similarity
- Accepts threshold (default 0.7) and limit (default 10)
- Sub-500ms response time with index
- Excludes the note itself from results

**Dependencies**

- Set up embedding generation

### ✅ Implement semantic search endpoint (small)

Create POST /api/search. Convert query to embedding and find similar notes.

**Acceptance Criteria**

- Accepts query string, optional limit and similarity_threshold
- Returns results with transcript_snippet and similarity_score
- Highlights matched concepts in results
- 400 on invalid query

**Dependencies**

- Create pgvector similarity search

### ✅ Implement auto-linking on note creation (small)

After embedding generation, find and store related notes. Return in note response.

**Acceptance Criteria**

- New notes automatically get related_notes array
- Related notes include similarity_score
- Connection_reason explains semantic relationship
- Max 5 related notes per note

**Dependencies**

- Implement semantic search endpoint

### ✅ Add get related notes endpoint (small)

Create GET /api/notes/:id/related. Return semantic and manual links.

**Acceptance Criteria**

- Returns related array with id, title, similarity_score, connection_reason
- Includes both semantic and manual links
- 404 if note not found

**Dependencies**

- Implement auto-linking on note creation

## Manual Linking

**Goal:** Allow users to create and manage manual connections between notes

### ✅ Create manual link endpoint (small)

Implement POST /api/notes/:id/links. Create bidirectional relationship.

**Acceptance Criteria**

- Accepts target_note_id and optional relationship_type
- Creates bidirectional link in database
- Cannot link note to itself (400 error)
- 404 if either note not found
- Returns link with id, created_at

**Dependencies**

- Add get related notes endpoint

### ✅ Update graph data endpoint with manual links (small)

Enhance GET /api/graph to include manual links as edges with type='manual'.

**Acceptance Criteria**

- Edges include both 'semantic' and 'manual' types
- Manual links have strength=1.0
- Nodes include connection_count combining both types

**Dependencies**

- Create manual link endpoint

### ✅ Implement delete manual link (small)

Add DELETE /api/notes/:id/links/:target_id. Remove bidirectional relationship.

**Acceptance Criteria**

- Removes link from database
- Returns {deleted: true}
- 404 if link not found
- 403 if not owner of either note

**Dependencies**

- Update graph data endpoint with manual links

## Frontend Core

**Goal:** Build React application with routing, authentication, and basic UI

### ✅ Set up React project structure (small)

Initialize React with Vite, TypeScript, and Tailwind CSS. Configure routing with react-router.

**Acceptance Criteria**

- Vite dev server runs without errors
- TypeScript configured
- Tailwind CSS base styles applied
- Routes defined for /, /login, /register, /notes, /graph
- Layout component with navigation

**Dependencies**
_None_

### ✅ Create authentication context and hooks (small)

Build AuthContext with login, register, logout, and token refresh logic.

**Acceptance Criteria**

- AuthProvider wraps app
- useAuth() hook exposes user and auth methods
- Tokens stored in localStorage
- Auto-refresh on token expiry
- Redirects to login on unauthenticated routes

**Dependencies**

- Set up React project structure

### ✅ Build login and register pages (small)

Create forms for user authentication with validation and error handling.

**Acceptance Criteria**

- Login form with email/password
- Register form with email/password/name
- Client-side validation
- Displays API errors
- Redirects to /notes on success

**Dependencies**

- Create authentication context and hooks

### ✅ Create API client utility (small)

Build fetch wrapper that adds Bearer token and handles refresh on 401.

**Acceptance Criteria**

- Automatically includes Authorization header
- Refreshes token on 401 and retries request
- Handles network errors gracefully
- Type-safe responses using shared types

**Dependencies**

- Build login and register pages

### ✅ Build notes list page (small)

Display paginated list of user's notes. Show title, date, and tags.

**Acceptance Criteria**

- Fetches and displays notes from API
- Pagination controls
- Loading and error states
- Click to view note details
- Empty state when no notes

**Dependencies**

- Create API client utility

## Audio Recording UI

**Goal:** Implement in-browser audio recording functionality

### ✅ Create recording hook (medium)

Build useAudioRecorder hook using MediaRecorder API. Handle start/stop/pause/resume.

**Acceptance Criteria**

- Requests microphone permission
- startRecording() initializes capture
- stopRecording() returns audio Blob
- pauseRecording() and resumeRecording() work
- getDuration() returns current duration

**Dependencies**

- Build notes list page

### ✅ Build recording UI component (small)

Create visual recording interface with timer, waveform visualization, and controls.

**Acceptance Criteria**

- Start/stop buttons with clear states
- Live duration display
- Visual indicator when recording
- Pause/resume functionality
- Displays recording duration warning at 8 minutes

**Dependencies**

- Create recording hook

### ✅ Implement audio upload flow (small)

Handle upload after recording. Show progress and create note on completion.

**Acceptance Criteria**

- Converts Blob to base64 or FormData
- Calls POST /api/audio/upload
- Shows upload progress
- Redirects to note detail on success
- Handles upload errors with retry option

**Dependencies**

- Build recording UI component

## Note Detail & Transcript View

**Goal:** Display note details with transcript and audio playback

### ✅ Create note detail page (small)

Build page showing note title, transcript, tags, and audio player.

**Acceptance Criteria**

- Fetches note by ID from API
- Displays title, transcript, created_at
- Shows tags as clickable badges
- Edit button for title and transcript
- Loading and error states

**Dependencies**

- Implement audio upload flow

### ✅ Implement audio player (medium)

Create custom audio player with play/pause, seek, and speed controls.

**Acceptance Criteria**

- Plays audio from streaming endpoint
- Play/pause toggle
- Seekable progress bar
- Playback speed options (0.5x, 1x, 1.5x, 2x)
- Time display (current/total)

**Dependencies**

- Create note detail page

### ✅ Add transcript-audio sync (medium)

Highlight transcript words as audio plays. Click transcript to seek audio.

**Acceptance Criteria**

- Transcript highlights current position during playback
- Clicking transcript seeks audio to timestamp
- Requires word-level timestamps from transcription

**Dependencies**

- Implement audio player

### ✅ Display related notes (small)

Show auto-linked and manually related notes. Allow quick navigation.

**Acceptance Criteria**

- Lists related notes with similarity scores
- Shows connection_reason for semantic links
- Click to navigate to related note
- Empty state when no related notes

**Dependencies**

- Add transcript-audio sync

## 3D Graph Visualization

**Goal:** Build Three.js graph view of interconnected notes

### ✅ Set up Three.js base scene (medium)

Initialize Three.js with scene, camera, renderer, and orbit controls.

**Acceptance Criteria**

- Canvas renders in React component
- OrbitControls for rotation/zoom/pan
- Responsive resize handling
- Basic lighting setup

**Dependencies**

- Display related notes

### ✅ Create graph node rendering (medium)

Render notes as spheres/nodes with size based on connection count and brightness based on recency.

**Acceptance Criteria**

- Each note renders as 3D node
- Node size scales with connection_count
- Recent notes (last 7 days) glow brighter
- Nodes positioned using force-directed layout
- Hover shows note title tooltip

**Dependencies**

- Set up Three.js base scene

### ✅ Create graph edge rendering (small)

Draw lines between connected notes. Style by relationship type and strength.

**Acceptance Criteria**

- Edges connect related notes
- Semantic links shown with opacity based on similarity
- Manual links shown as solid lines
- Different colors for each relationship type

**Dependencies**

- Create graph node rendering

### ✅ Implement node interaction (medium)

Handle click on nodes to show note details. Highlight related nodes on hover.

**Acceptance Criteria**

- Click node opens detail panel/overlay
- Hover highlights node and its connections
- Clicking empty space deselects
- Smooth camera animation to selected node

**Dependencies**

- Create graph edge rendering

### ✅ Add graph controls and filters (small)

UI to filter by tags, search nodes, and adjust layout.

**Acceptance Criteria**

- Search input to filter visible nodes
- Tag filter dropdown
- Reset view button
- Toggle between 2D and 3D views

**Dependencies**

- Implement node interaction

### ✅ Implement lazy loading for large graphs (medium)

Load nodes progressively. Only render visible viewport initially.

**Acceptance Criteria**

- Initial render shows 50 most recent notes
- Additional nodes load on zoom/pan
- LOD (Level of Detail) for distant nodes
- Performance maintained with 500+ notes

**Dependencies**

- Add graph controls and filters

## Search Interface

**Goal:** Build semantic search UI with results display

### ✅ Create search page layout (small)

Build search input with autocomplete and results area.

**Acceptance Criteria**

- Prominent search input
- Search as-you-type with debounce
- Recent searches display
- Clear loading/error states

**Dependencies**

- Set up React project structure

### ✅ Implement semantic search results (small)

Display search results with transcript snippets and similarity indicators.

**Acceptance Criteria**

- Results show title, snippet, similarity_score
- Matched concepts highlighted
- Click to view full note
- Empty state with search tips
- No results message

**Dependencies**

- Create search page layout

### ✅ Add search filters and options (small)

Controls for similarity threshold and result limit.

**Acceptance Criteria**

- Slider for similarity threshold (0.5-0.9)
- Dropdown for result count (5, 10, 20, 50)
- Filters update results in real-time
- Persist preferences to localStorage

**Dependencies**

- Implement semantic search results

## Polish & Production Readiness

**Goal:** Error handling, performance optimization, testing, and deployment prep

### ✅ Implement global error handling (small)

Add error boundary in React and error handler in Express. Log all errors.

**Acceptance Criteria**

- React Error Boundary catches component errors
- Express middleware logs all errors
- User-friendly error messages
- Error reporting service ready (Sentry integration point)

**Dependencies**

- Add search filters and options

### ✅ Add loading states and skeletons (small)

Implement skeleton screens for all async operations.

**Acceptance Criteria**

- Skeleton loaders for notes list
- Skeleton for note detail
- Skeleton for search results
- Loading spinners for actions

**Dependencies**

- Implement global error handling

### ✅ Implement search result caching (small)

Cache semantic search results for 5 minutes based on query hash.

**Acceptance Criteria**

- Search results cached in-memory or Redis
- Cache key based on query + params hash
- Cache expires after 5 minutes
- Invalidated on new note creation

**Dependencies**

- Add loading states and skeletons

### ✅ Add structured logging (small)

Implement JSON logging with request_id tracing throughout.

**Acceptance Criteria**

- All logs in JSON format
- Includes timestamp, request_id, user_id
- Log levels: error, warn, info, debug
- Logs to stdout for container aggregation

**Dependencies**

- Implement search result caching

### ✅ Add API metrics tracking (medium)

Track request duration, transcription time, search latency.

**Acceptance Criteria**

- Histogram for api_request_duration_seconds
- Counter for notes_created_total
- Histogram for search_query_duration_seconds
- Gauge for active_users_count
- Metrics endpoint for Prometheus

**Dependencies**

- Add structured logging

### ✅ Write integration tests (medium)

Test critical flows: auth, note CRUD, audio upload, search.

**Acceptance Criteria**

- Auth flow (register, login, refresh)
- Note creation and retrieval
- Audio upload and storage
- Semantic search with pgvector
- All tests pass with >80% coverage on services

**Dependencies**

- Add API metrics tracking

### ✅ Create deployment configuration (small)

Docker-compose for local dev. Environment variable templates.

**Acceptance Criteria**

- docker-compose.yml with frontend, backend, PostgreSQL
- .env.example with all required variables
- Database migrations run on startup
- Production build scripts

**Dependencies**

- Write integration tests

## ❓ Open Questions

- Which transcription provider? (OpenAI Whisper vs. alternative)
- Which embedding model? (OpenAI ada-002 vs. open source)
- Storage backend for production? (AWS S3, GCS, or self-hosted)
- Should transcription support multiple languages?
- Max notes per user limit? (storage and cost planning)
- Should users be able to export their data?
