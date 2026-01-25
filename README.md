# Synapse Notes - Deployment Guide

A voice-first knowledge base that transforms audio notes into searchable, interconnected ideas.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A [Google AI Studio](https://aistudio.google.com/) API key

---

## Quick Start (5 minutes)

### 1. Get your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API Key**
3. Copy the key (starts with `AIza...`)

### 2. Configure the Environment

```bash
# Copy the example environment file
cp docker-compose.env.example docker-compose.env

# Edit docker-compose.env and set your API key:
# GOOGLE_API_KEY=AIza...your_key_here...
```

### 3. Start the Application

```bash
docker-compose up -d
```

### 4. Open in Browser

Go to **<http://localhost:5173>**

---

## Using Synapse Notes

### Recording a Voice Note

1. Click **+ New Note**
2. Click the **Record** button 🔴
3. Speak your thoughts
4. Click **Stop & Save**
5. Click **Upload & Transcribe**
6. Wait a few seconds → your speech appears as text!
7. Click **Save**

### Knowledge Graph

- Click **Graph** in the navigation
- See your notes as 3D nodes
- Related notes are connected by lines
- Click any node to view that note

---

## Stopping the Server

```bash
docker-compose down
```

To restart later:

```bash
docker-compose up -d
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Transcription failed" | Check `GOOGLE_API_KEY` in `docker-compose.env` |
| Graph won't load | Run `docker-compose build --no-cache && docker-compose up -d` |
| Containers won't start | Make sure Docker Desktop is running |

---

## Tech Stack

- **Frontend**: React + Three.js (3D graph)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with pgvector
- **AI**: Google Gemini 2.0 Flash
