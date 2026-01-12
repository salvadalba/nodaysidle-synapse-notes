# Multi-stage build for frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Add build argument for Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy root package files
COPY package*.json ./
# Copy subdirectory package files
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm install

# Copy source code
COPY frontend/ ./frontend/
COPY shared/ ./shared/

# Build the application
WORKDIR /app/frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm install && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5173/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application using Vite preview
WORKDIR /app/frontend
CMD ["npm", "run", "preview", "--", "--port", "5173", "--host"]
