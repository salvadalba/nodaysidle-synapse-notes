# ARD

# Architecture Requirements Document

## 🧱 System Overview

A single-page React application with a 3D graph visualization frontend, REST API backend for audio processing and transcript management, and PostgreSQL with pgvector for semantic similarity search and note storage.

## 🏗 Architecture Style

Three-tier web application with client-side rendering and RESTful backend

## 🎨 Frontend Architecture

- **Framework:** React with Three.js for 3D graph visualization
- **State Management:** React Context API or Zustand for global state
- **Routing:** React Router for client-side routing
- **Build Tooling:** Vite for fast development and optimized production builds

## 🧠 Backend Architecture

- **Approach:** Monolithic Node.js REST API
- **API Style:** RESTful JSON API with OpenAPI specification
- **Services:**
- audio processing service
- transcription service
- semantic embedding service
- search service
- note CRUD service

## 🗄 Data Layer

- **Primary Store:** PostgreSQL with pgvector extension for semantic similarity
- **Relationships:** Notes table with embedding vectors, tags table, and manual_links table for user-defined connections
- **Migrations:** Database migrations via a tool like db-migrate or Prisma migrations

## ☁️ Infrastructure

- **Hosting:** Cloud hosting (AWS, GCP, or Azure) with containerized deployment
- **Scaling Strategy:** Horizontal scaling of API servers behind a load balancer, connection pooling for PostgreSQL
- **CI/CD:** GitHub Actions or similar for automated testing and deployment

## ⚖️ Key Trade-offs

- Monolithic backend simplifies initial development but may complicate future scaling of transcription service
- Client-side rendering reduces server complexity but impacts SEO and initial load time
- pgvector in PostgreSQL eliminates separate vector database but may not scale as well as specialized solutions
- Browser-based recording avoids app installation but limits audio quality and background recording capabilities
- Real-time transcription vs batch processing tradeoff affects cost and complexity

## 📐 Non-Functional Requirements

- Transcripts available within 10 seconds of recording completion
- Support recordings up to 10 minutes in duration
- Search results returned under 500ms for typical queries
- Responsive design supporting mobile and desktop viewports
- Browser-based recording using Web Audio API and MediaRecorder API
- API response times under 200ms for non-transcription endpoints
- Support for concurrent uploads from multiple users
- Graceful degradation when 3D visualization is not supported
