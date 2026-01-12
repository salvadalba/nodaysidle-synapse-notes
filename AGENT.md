# AGENT

# Agent Prompts — synapse-notes

## 🧭 Global Rules

### ✅ Do

- Use React + Vite + TypeScript + Tailwind CSS
- Use Node.js + Express for REST API
- Use PostgreSQL with pgvector extension
- Implement JWT authentication with refresh tokens
- Store audio files locally in dev, abstract S3 interface for production

### ❌ Don’t

- Do not use Python - the stack specifies Node.js backend
- Do not use Pinecone - use pgvector with PostgreSQL
- Do not add real-time collaboration features initially
- Do not implement full-text search - use semantic search only
- Do not create complex state management - use React Context

## 🧩 Task Prompts

## Foundation: Auth & Database

**Context**
Set up project structure, PostgreSQL schema with pgvector, and JWT authentication system. Create monorepo with frontend/backend folders, shared types, and migration files.
