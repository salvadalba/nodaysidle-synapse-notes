# Synapse Notes

A voice-first knowledge base with glassmorphism UI that transforms audio notes into searchable, interconnected ideas.

## Features

- Voice-first note capture with real-time waveform visualization
- AI-powered transcription via Google Gemini
- Semantic search using embeddings (text-embedding-004)
- AI-generated visualizations for each note (Imagen 3)
- Interactive knowledge graph showing note connections
- Real-time collaboration via workspaces
- Modern glassmorphism design with teal/cyan accents

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Three.js
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **AI**: Google Gemini 2.0 Flash, text-embedding-004, Imagen 3.0
- **Hosting**: Vercel (frontend) + Supabase (backend)

---

## Deployment Guide

### Prerequisites

- [Supabase](https://supabase.com) account (free tier works)
- [Vercel](https://vercel.com) account (free tier works)
- [Google AI Studio](https://aistudio.google.com/) API key

---

### 1. Set Up Supabase

#### Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** from Settings > API

#### Enable Extensions

Run in SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Create Database Schema

Run in SQL Editor:

```sql
-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace members
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,
  transcript TEXT,
  audio_url TEXT,
  image_url TEXT,
  duration INTEGER,
  embedding VECTOR(768),
  embedding_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view workspace members"
  ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can join workspaces"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view notes in their workspace"
  ON notes FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create notes in their workspace"
  ON notes FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update notes in their workspace"
  ON notes FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete notes in their workspace"
  ON notes FOR DELETE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
```

#### Create Storage Buckets

In Storage section:

1. Create bucket `audio` (public)
2. Create bucket `images` (public)

#### Deploy Edge Functions

Install Supabase CLI and deploy:

```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Set secret for Edge Functions
supabase secrets set GOOGLE_API_KEY=your_google_api_key

# Deploy functions
supabase functions deploy transcribe
supabase functions deploy generate-embedding
supabase functions deploy generate-image
```

---

### 2. Deploy to Vercel

#### Connect Repository

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import the repository
4. Set root directory to `frontend`

#### Configure Environment Variables

In Vercel project settings, add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

#### Deploy

Click Deploy. Vercel will build and deploy automatically.

---

### 3. Get Google API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API Key**
3. Copy the key and add it as a Supabase secret (see above)

---

## Local Development

```bash
# Frontend
cd frontend
npm install
cp .env.example .env  # Then edit with your Supabase credentials
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

---

## Using Synapse Notes

### Getting Started

1. Open the app and create or join a workspace
2. Share the invite code with collaborators

### Recording a Voice Note

1. Tap the mic button on the home screen
2. Speak your thoughts
3. Tap stop when done
4. Note is saved and processing begins automatically
5. View transcription and AI visualization when ready

### Knowledge Graph

- Tap the Graph tab to see your notes as connected nodes
- Related notes cluster together based on semantic similarity
- Tap any node to view that note
- Pinch to zoom, drag to pan

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Transcription fails | Check `GOOGLE_API_KEY` secret in Supabase |
| Notes don't save | Verify RLS policies are set up correctly |
| Real-time not working | Ensure Supabase Realtime is enabled |
| Graph empty | Notes need embeddings - wait for processing |

---

## Project Structure

```
synapse-notes/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── contexts/    # Auth & Workspace providers
│   │   ├── lib/         # Supabase client & utilities
│   │   └── pages/       # Route pages
│   └── vercel.json      # Vercel config
└── supabase/
    └── functions/       # Edge Functions
        ├── transcribe/
        ├── generate-embedding/
        └── generate-image/
```
