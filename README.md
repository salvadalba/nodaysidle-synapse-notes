# 🧠 Synapse Notes

![Synapse Notes Banner](assets/banner.png)

Synapse Notes is an **audio-first knowledge base** powered by Google Gemini (Nano Banana). It captures your thoughts at the speed of speech and automatically organizes them into a meaningful network of ideas.

---

## 🚀 The Vision

Most note-taking apps require you to type, categorize, and tag everything manually. This creates "friction" that often stops you from capturing great ideas when they happen.

**Synapse Notes flips the script.**

You talk, and the AI does the heavy lifting:

1. **Listen**: Captures your raw audio.
2. **Understand**: Transcribes and summarizes your thoughts using `gemini-1.5-flash`.
3. **Connect**: Links new notes to previous ones based on semantic meaning.
4. **Visualize**: Shows you an interactive **Knowledge Graph** of your thoughts.

---

## ✨ Key Features

### 🎙️ Effortless Recording

Just click "New Note" and start speaking. Perfect for meetings, brainstorming, or capturing late-night insights without needing a keyboard.

### 🤖 AI Intelligence (Powered by Nano Banana)

* **Automatic Transcription**: Instant conversion of voice to text.
* **Semantic Search**: Find ideas by meaning. Search for "business growth" and find notes about marketing and strategy automatically.
* **Auto-Linking**: The system automatically detects relationship between your notes.

### 🕸️ 3D Knowledge Graph

Visualize your mind. Every note is a node in a 3D space, connected by meaning and history. The more connections a note has, the larger it grows in your galaxy of ideas.

### 🛡️ Local-First & Private

* **Single-User Local Mode**: No complex sign-ups. Everything runs on your machine.
* **Privacy Centric**: Your data stays local. Use your own API keys for Gemini and OpenRouter.

---

## 🛠️ Tech Stack

* **Frontend**: React, Vite, Tailwind CSS, Three.js (for the Graph)
* **Backend**: Node.js, Express
* **Database**: PostgreSQL with `pgvector` for semantic search
* **AI**: Google Gemini (Transcription), OpenRouter (Embeddings)
* **Infrastructure**: Docker & Docker Compose

---

## 🚀 Getting Started

### 1. Requirements

- Docker and Docker Compose
* Nano Banana (Google Gemini) API Key
* OpenRouter API Key

### 2. Setup

1. Clone the repository.
2. Create a `docker-compose.env` file (see `docker-compose.env.example`).
3. Add your API keys.

### 3. Run

```bash
docker-compose up --build -d
```

Access the app at `http://localhost:5173`.

---

## 📜 License

MIT License. Created with ❤️ by the Synapse Team.
