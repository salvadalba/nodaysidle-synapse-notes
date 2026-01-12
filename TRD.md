# TRD

# Technical Requirements Document

## 🧭 System Context

Synapse Notes is an audio-first knowledge management platform built as a three-tier web application. The system processes voice recordings, generates transcripts, creates semantic embeddings for search and auto-linking, and visualizes notes as interconnected nodes in a 3D graph. The frontend is a single-page React application with Three.js for visualization. The backend is a Node.js REST API handling audio processing, transcription, and semantic operations. PostgreSQL with pgvector stores notes, transcripts, and embedding vectors for similarity search.

## 🔌 API Contracts

### Create Voice Note

- **Method:** POST
- **Path:** /api/notes
- **Auth:** Bearer token required
- **Request:** {"duration_seconds": "integer (required, max 600)", "audio_blob": "base64 encoded audio data (required, max 50MB)", "title": "string (optional, auto-generated if omitted)", "tags": "array of strings (optional)"}
- **Response:** {"id": "uuid", "title": "string", "transcript": "string", "audio_url": "string", "created_at": "ISO8601 timestamp", "embedding_status": "'pending'|'complete'|'failed'", "related_notes": "array of note objects with similarity scores"}
- **Errors:**
- 400: Invalid audio format or size exceeds limit
- 413: Audio file too large
- 429: Too many concurrent uploads

### Get Note by ID

- **Method:** GET
- **Path:** /api/notes/:id
- **Auth:** Bearer token required
- **Request:**
- **Response:** {"id": "uuid", "title": "string", "transcript": "string", "audio_url": "string", "created_at": "ISO8601 timestamp", "updated_at": "ISO8601 timestamp", "tags": "array of strings", "related_notes": "array of {id, title, similarity_score}", "manual_links": "array of note IDs"}
- **Errors:**
- 404: Note not found
- 403: Access denied

### List All Notes

- **Method:** GET
- **Path:** /api/notes
- **Auth:** Bearer token required
- **Request:**
- **Response:** {"notes": "array of note summary objects", "total": "integer", "page": "integer", "page_size": "integer"}
- **Errors:**
_None_

### Semantic Search

- **Method:** POST
- **Path:** /api/search
- **Auth:** Bearer token required
- **Request:** {"query": "string (required)", "limit": "integer (optional, default 10)", "similarity_threshold": "float (optional, default 0.7)"}
- **Response:** {"results": "array of {id, title, transcript_snippet, similarity_score, matched_concepts}", "query_embedding_used": "boolean"}
- **Errors:**
- 400: Invalid query or parameters

### Get Related Notes

- **Method:** GET
- **Path:** /api/notes/:id/related
- **Auth:** Bearer token required
- **Request:**
- **Response:** {"related": "array of {id, title, similarity_score, connection_reason}"}
- **Errors:**
- 404: Note not found

### Create Manual Link

- **Method:** POST
- **Path:** /api/notes/:id/links
- **Auth:** Bearer token required
- **Request:** {"target_note_id": "uuid (required)", "relationship_type": "string (optional, default 'related')"}
- **Response:** {"id": "uuid", "source_note_id": "uuid", "target_note_id": "uuid", "created_at": "timestamp"}
- **Errors:**
- 404: Source or target note not found
- 400: Cannot link to self

### Update Note

- **Method:** PATCH
- **Path:** /api/notes/:id
- **Auth:** Bearer token required
- **Request:** {"title": "string (optional)", "tags": "array of strings (optional)", "transcript": "string (optional - for manual edits)"}
- **Response:** {"id": "uuid", "title": "string", "transcript": "string", "tags": "array of strings", "updated_at": "timestamp"}
- **Errors:**
- 404: Note not found
- 403: Access denied

### Delete Note

- **Method:** DELETE
- **Path:** /api/notes/:id
- **Auth:** Bearer token required
- **Request:**
- **Response:** {"deleted": "boolean", "id": "uuid"}
- **Errors:**
- 404: Note not found
- 403: Access denied

### Get Graph Data

- **Method:** GET
- **Path:** /api/graph
- **Auth:** Bearer token required
- **Request:**
- **Response:** {"nodes": "array of {id, title, created_at, connection_count, recency_score}", "edges": "array of {source_id, target_id, type, strength}"}
- **Errors:**
_None_

### Upload Audio File

- **Method:** POST
- **Path:** /api/audio/upload
- **Auth:** Bearer token required
- **Request:** {"audio_file": "multipart/form-data (required)", "title": "string (optional)"}
- **Response:** {"upload_id": "uuid", "status": "'processing'|'complete'", "note_id": "uuid (when complete)"}
- **Errors:**
- 400: Invalid audio format
- 413: File too large

### Get Audio Stream

- **Method:** GET
- **Path:** /api/audio/:id/stream
- **Auth:** Bearer token required
- **Request:**
- **Response:** audio binary stream with Content-Type: audio/mpeg
- **Errors:**
- 404: Audio not found

### User Registration

- **Method:** POST
- **Path:** /api/auth/register
- **Auth:** None
- **Request:** {"email": "string (required, valid email)", "password": "string (required, min 8 chars)", "name": "string (optional)"}
- **Response:** {"user_id": "uuid", "email": "string", "access_token": "jwt string", "refresh_token": "jwt string"}
- **Errors:**
- 409: Email already registered
- 400: Invalid input

### User Login

- **Method:** POST
- **Path:** /api/auth/login
- **Auth:** None
- **Request:** {"email": "string (required)", "password": "string (required)"}
- **Response:** {"user_id": "uuid", "email": "string", "access_token": "jwt string", "refresh_token": "jwt string"}
- **Errors:**
- 401: Invalid credentials

### Refresh Token

- **Method:** POST
- **Path:** /api/auth/refresh
- **Auth:** None
- **Request:** {"refresh_token": "string (required)"}
- **Response:** {"access_token": "jwt string", "refresh_token": "jwt string"}
- **Errors:**
- 401: Invalid or expired refresh token

## 🧱 Modules

### Audio Processing Service

- **Responsibilities:**
- Validate incoming audio files
- Convert audio to compatible format
- Extract audio metadata (duration, format)
- Store audio files in object storage
- **Interfaces:**
- processAudioUpload(audioData: Buffer): Promise<AudioMetadata>
- validateAudioFormat(audioData: Buffer): boolean
- extractAudioDuration(audioData: Buffer): number
- **Depends on:**
- Storage Service

### Transcription Service

- **Responsibilities:**
- Send audio to transcription provider
- Handle transcription job status polling
- Store completed transcripts
- Trigger embedding generation on transcript completion
- **Interfaces:**
- transcribe(audioUrl: string, noteId: string): Promise<string>
- getTranscriptionStatus(jobId: string): Promise<TranscriptionStatus>
- **Depends on:**
- Audio Processing Service
- Note Repository
- Embedding Service

### Embedding Service

- **Responsibilities:**
- Generate embeddings from transcript text
- Store embeddings in pgvector
- Query similar embeddings
- Update related notes based on similarity threshold
- **Interfaces:**
- generateEmbedding(text: string): Promise<number[]>
- findSimilarNotes(embedding: number[], threshold: float, limit: integer): Promise<SimilarNote[]>
- storeEmbedding(noteId: string, embedding: number[]): Promise<void>
- **Depends on:**
- Database
- External Embedding API

### Search Service

- **Responsibilities:**
- Convert search query to embedding
- Find semantically similar notes
- Rank and filter results
- Return matched concepts from transcripts
- **Interfaces:**
- semanticSearch(query: string, options: SearchOptions): Promise<SearchResult[]>
- **Depends on:**
- Embedding Service
- Note Repository

### Note Repository

- **Responsibilities:**
- CRUD operations for notes
- Manage tags and manual links
- Query notes with pagination
- Retrieve notes for graph visualization
- **Interfaces:**
- createNote(noteData: NoteInput): Promise<Note>
- getNoteById(id: string): Promise<Note>
- listNotes(options: ListOptions): Promise<Note[]>
- updateNote(id: string, updates: NoteUpdate): Promise<Note>
- deleteNote(id: string): Promise<boolean>
- getGraphData(): Promise<GraphData>
- **Depends on:**
- Database

### Authentication Service

- **Responsibilities:**
- User registration and password hashing
- JWT token generation and validation
- Refresh token management
- Request authentication middleware
- **Interfaces:**
- register(email: string, password: string, name?: string): Promise<AuthResult>
- login(email: string, password: string): Promise<AuthResult>
- verifyToken(token: string): Promise<UserPayload>
- refreshTokens(refreshToken: string): Promise<TokenPair>
- **Depends on:**
- Database

### Graph Visualization Module

- **Responsibilities:**
- Render 3D node graph using Three.js
- Handle node selection and expansion
- Display transcript view with audio sync
- Visualize connection strength between nodes
- **Interfaces:**
- renderGraph(nodes: GraphNode[], edges: GraphEdge[]): void
- selectNode(nodeId: string): void
- highlightRelatedNodes(nodeId: string): void
- syncAudioToTranscript(timestamp: number): void
- **Depends on:**
- API Client

### Recording Module

- **Responsibilities:**
- Capture audio from microphone
- Handle recording controls (start/stop/pause)
- Display recording duration
- Prepare audio for upload
- **Interfaces:**
- startRecording(): void
- stopRecording(): Promise<Blob>
- pauseRecording(): void
- resumeRecording(): void
- getDuration(): number
- **Depends on:**
_None_

### Storage Service

- **Responsibilities:**
- Store audio files
- Generate signed URLs for audio access
- Clean up orphaned files
- **Interfaces:**
- storeFile(file: Buffer, key: string): Promise<string>
- getSignedUrl(key: string): Promise<string>
- deleteFile(key: string): Promise<void>
- **Depends on:**
- Cloud Storage (S3 or equivalent)

## 🗃 Data Model Notes

- PostgreSQL with pgvector extension for vector similarity search
- Notes table stores note metadata with a foreign key to users table
- Embeddings stored as vector(1536) column in notes table for OpenAI-compatible embeddings
- Tags normalized into separate table with many-to-many relationship
- Manual links stored in bidirectional relationship table
- Audio files stored externally (S3-compatible) with URLs in notes table
- Transcription jobs tracked separately for async processing status

## 🔐 Validation & Security

- JWT access tokens expire after 1 hour, refresh tokens expire after 30 days
- Password hashing using bcrypt with cost factor 12
- Rate limiting: 10 uploads per minute per user
- Input validation: Audio max 50MB, max 10 minutes duration, accepted formats MP3/WAV/M4A/WEBM
- SQL injection prevention via parameterized queries
- XSS prevention via input sanitization and Content Security Policy headers
- CORS restricted to frontend domain only
- API authentication via Bearer tokens on all protected endpoints
- File upload validation by magic bytes, not just extension
- User can only access their own notes - user_id filtering enforced at repository level

## 🧯 Error Handling Strategy

Standardized error responses with codes: VALIDATION_ERROR(400), UNAUTHORIZED(401), FORBIDDEN(403), NOT_FOUND(404), CONFLICT(409), RATE_LIMITED(429), INTERNAL_ERROR(500). All errors logged with context for debugging. Client receives user-friendly messages without sensitive internals.

## 🔭 Observability

- **Logging:** Structured JSON logging with levels: error, warn, info, debug. Include timestamp, request_id, user_id, endpoint, duration. Log to stdout for container log aggregation.
- **Tracing:** Distributed tracing with OpenTelemetry, propagating trace context through request chain for audio upload -> transcription -> embedding -> search flows
- **Metrics:**
- api_request_duration_seconds (histogram, labeled by endpoint, status)
- audio_processing_duration_seconds (histogram)
- transcription_completion_time_seconds (histogram)
- search_query_duration_seconds (histogram)
- active_users_count (gauge)
- notes_created_total (counter)
- semantic_search_queries_total (counter)
- embedding_generation_failures_total (counter)

## ⚡ Performance Notes

- Transcription API calls should timeout after 30 seconds, queue for async processing if longer
- Embedding generation batched when possible for efficiency
- pgvector similarity queries use ivfflat index with appropriate probe count for sub-500ms responses
- Audio files served via CDN with appropriate caching headers
- Graph visualization lazy-loads nodes beyond visible viewport
- Database connection pooling with max 20 connections per instance
- Search results cached for 5 minutes based on query hash

## 🧪 Testing Strategy

### Unit

- EmbeddingService.generateEmbedding() with mock input
- SearchService.semanticSearch() edge cases
- AudioProcessingService.validateAudioFormat() with various formats
- NoteRepository CRUD operations with test database
- AuthenticationService token generation and validation

### Integration

- Full audio upload -> transcription -> embedding pipeline
- Semantic search with actual pgvector queries
- Authentication flow (register -> login -> refresh)
- Graph data retrieval with complex note relationships

### E2E

- User records audio, views transcript, sees auto-linked related notes
- User searches by concept and finds semantically related notes
- User navigates 3D graph and clicks nodes to view details
- User creates manual link between notes and sees graph update
- Audio playback synced with transcript highlights

## 🚀 Rollout Plan

- Phase 1: Core infrastructure - Database schema, basic API skeleton, authentication
- Phase 2: Note CRUD and audio upload - Basic note creation without transcription
- Phase 3: Transcription integration - Async transcription processing and transcript display
- Phase 4: Semantic search - Embedding generation and search functionality
- Phase 5: Auto-linking - Automatic related note suggestions based on similarity
- Phase 6: Graph visualization - 3D node graph with basic interactivity
- Phase 7: Polish - Manual links, audio sync, performance optimization

## ❓ Open Questions

_None_
