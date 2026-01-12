# PRD

# Synapse Notes

## 🎯 Product Vision

An audio-first knowledge base that transforms voice notes into a searchable, interconnected semantic graph of ideas, making spoken thoughts as discoverable and linkable as written documents.

## ❓ Problem Statement

Voice notes are trapped in audio files—impossible to search, difficult to organize, and disconnected from related ideas. Users lose valuable insights because they cannot find or connect past voice recordings by meaning or concept.

## 🎯 Goals

- Transform voice recordings into searchable text transcripts
- Automatically discover and surface semantic connections between notes
- Enable concept-based search across audio content (not keyword-only)
- Visualize notes as an interconnected knowledge graph
- Provide synchronized audio-transcript playback

## 🚫 Non-Goals

- Video recording or support
- Real-time collaboration between users
- Advanced audio editing capabilities
- Social sharing or public note publishing
- Multi-language support in initial release

## 👥 Target Users

- Researchers and academics who capture ideas verbally
- Writers and content creators who brainstorm aloud
- Product managers and designers who document user feedback
- Professionals who prefer voice over typing for quick capture

## 🧩 Core Features

- Voice recording with automatic transcription
- Semantic similarity analysis between notes
- Automatic suggestion of related notes
- Concept-based search using natural language queries
- Interactive node graph visualization of note connections
- Audio player synced to transcript text
- Manual linking and tagging of notes

## ⚙️ Non-Functional Requirements

- Transcripts available within 10 seconds of recording
- Support recordings up to 10 minutes
- Search results returned under 500ms
- Responsive design for mobile and desktop
- Browser-based recording (no app download required)

## 📊 Success Metrics

- Time saved finding past voice notes (target: 80% faster than linear audio scanning)
- Weekly active voice note creators
- Percentage of notes with at least one semantic connection discovered
- Average number of connections per note
- Search result click-through rate

## 📌 Assumptions

- Users have reliable internet connection for cloud processing
- Users primarily use Chrome, Firefox, or Safari browsers
- Most recordings will be under 5 minutes
- Users speak clearly enough for transcription accuracy
- PostgreSQL with pgvector can handle initial user base scale

## ❓ Open Questions

- Should notes be organized in workspaces or remain flat?
- What is the deletion and retention policy for old notes?
- How do we handle sensitive or private information in transcripts?
- Should users be able to edit auto-generated transcripts?
- What authentication method (SSO, email/password, OAuth)?
