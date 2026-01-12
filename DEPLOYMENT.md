# Synapse Notes - Docker Deployment Guide

This guide provides step-by-step instructions for deploying Synapse Notes locally using Docker Compose.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Docker**: [Install Docker](https://docs.docker.com/get-docker/) (version 20.10 or higher)
- **Docker Compose**: [Install Docker Compose](https://docs.docker.com/compose/install/) (version 2.0 or higher)

To verify your installation:

```bash
docker --version
docker-compose --version
```

## Quick Start

### 1. Configure Environment Variables

The [`docker-compose.env`](docker-compose.env) file contains all required environment variables. Update the following values:

```bash
# JWT Configuration
JWT_SECRET=your_jwt_secret_here_change_this_in_production
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here_change_this_in_production

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
```

**Important**: Generate strong, random secrets for JWT configuration in production environments.

### 2. Deploy the Application

Run the deployment script:

```bash
./deploy.sh
```

This script will:

- Validate the Docker Compose configuration
- Build Docker images for all services
- Start PostgreSQL, backend, and frontend services
- Initialize the database with migrations
- Display service status and access URLs

### 3. Access the Application

Once deployment is complete, access the application at:

- **Frontend**: <http://localhost:5173>
- **Backend API**: <http://localhost:3000>

## Deployment Scripts

### [`deploy.sh`](deploy.sh)

Builds and starts all services.

```bash
./deploy.sh
```

### [`stop.sh`](stop.sh)

Stops all running services without removing containers or volumes.

```bash
./stop.sh
```

### [`clean.sh`](clean.sh)

Stops all services and removes containers, networks, and volumes. **This will delete all data.**

```bash
./clean.sh
```

## Service Architecture

The deployment consists of three main services:

### PostgreSQL Database

- **Image**: `pgvector/pgvector:pg16`
- **Port**: 5432
- **Database**: `synapse_notes`
- **User**: `synapse_user`
- **Password**: `synapse_password`
- **Features**: pgvector extension for semantic search

### Backend Service

- **Port**: 3000
- **Environment**: Production
- **Storage**: Persistent volume for audio uploads at `/app/uploads`
- **Health Check**: HTTP endpoint at `/health`

### Frontend Service

- **Port**: 5173
- **Environment**: Production
- **Health Check**: HTTP endpoint at `/`

## Database Initialization

The database is automatically initialized when the PostgreSQL container starts. The [`init-db.sh`](init-db.sh) script:

1. Runs migration files from [`backend/migrations/`](backend/migrations/)
2. Enables the pgvector extension
3. Creates all required tables and indexes
4. Sets up triggers for timestamp updates

Migration files are located in [`backend/migrations/001_init.sql`](backend/migrations/001_init.sql).

## Environment Variables

### Backend Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://synapse_user:synapse_password@postgres:5432/synapse_notes` |
| `JWT_SECRET` | Secret for JWT token signing | (required) |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing | (required) |
| `OPENAI_API_KEY` | OpenAI API key for embeddings and transcription | (required) |
| `PORT` | Backend server port | `3000` |
| `NODE_ENV` | Node environment | `production` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `AUDIO_STORAGE_PATH` | Path for audio file storage | `/app/uploads` |

### Frontend Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |

## Monitoring and Logs

### View All Logs

```bash
docker-compose logs -f
```

### View Specific Service Logs

```bash
# PostgreSQL logs
docker-compose logs -f postgres

# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend
```

### Check Service Status

```bash
docker-compose ps
```

### Check Service Health

```bash
# Check all services
docker-compose ps

# Check specific service health
docker inspect synapse-backend | grep -A 10 Health
```

## Troubleshooting

### Port Already in Use

If you encounter a port conflict, modify the port mappings in [`docker-compose.yml`](docker-compose.yml):

```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # Change to 5433
  backend:
    ports:
      - "3001:3000"  # Change to 3001
  frontend:
    ports:
      - "5174:5173"  # Change to 5174
```

### Database Connection Issues

If the backend cannot connect to the database:

1. Check if PostgreSQL is healthy:

   ```bash
   docker-compose ps postgres
   ```

2. View PostgreSQL logs:

   ```bash
   docker-compose logs postgres
   ```

3. Verify the database URL in [`docker-compose.env`](docker-compose.env)

### Migration Failures

If migrations fail to run:

1. Check the migration file exists:

   ```bash
   ls -la backend/migrations/
   ```

2. View initialization script logs:

   ```bash
   docker-compose logs postgres | grep "migration"
   ```

3. Manually run migrations:

   ```bash
   docker-compose exec backend npm run migrate
   ```

### Container Won't Start

If a container fails to start:

1. Check container logs:

   ```bash
   docker-compose logs <service-name>
   ```

2. Rebuild the container:

   ```bash
   docker-compose build <service-name>
   docker-compose up -d <service-name>
   ```

3. Remove and recreate:

   ```bash
   docker-compose down
   ./deploy.sh
   ```

### Permission Issues with Uploads

If the backend cannot write to the uploads directory:

1. Check volume permissions:

   ```bash
   docker-compose exec backend ls -la /app/uploads
   ```

2. Fix permissions:

   ```bash
   docker-compose exec backend chmod 755 /app/uploads
   ```

## Development vs Production

### Local Development

For local development without Docker, refer to [`backend/.env.example`](backend/.env.example) for environment variable configuration.

### Docker Deployment

For Docker deployment, use [`docker-compose.env`](docker-compose.env) which contains Docker-specific settings.

## Updating the Application

To update the application with new code changes:

1. Stop the services:

   ```bash
   ./stop.sh
   ```

2. Rebuild and start:

   ```bash
   ./deploy.sh
   ```

To rebuild without cache:

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Data Persistence

- **PostgreSQL data**: Stored in Docker volume `postgres_data`
- **Audio uploads**: Stored in Docker volume `backend_uploads`

Data persists across container restarts but is removed when running [`clean.sh`](clean.sh).

## Security Considerations

1. **Change default passwords**: Update PostgreSQL credentials in [`docker-compose.yml`](docker-compose.yml)
2. **Use strong secrets**: Generate random JWT secrets for production
3. **Limit exposure**: Consider using reverse proxy (nginx) for production
4. **Secure API keys**: Never commit [`docker-compose.env`](docker-compose.env) to version control
5. **Enable HTTPS**: Use SSL/TLS for production deployments

## Performance Optimization

### Database Optimization

The PostgreSQL container includes optimized indexes for:

- Vector similarity search (ivfflat index)
- User queries
- Timestamp-based queries
- Tag lookups

### Container Resources

Adjust resource limits in [`docker-compose.yml`](docker-compose.yml) if needed:

```yaml
services:
  postgres:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review service logs
3. Verify environment variables
4. Check Docker and Docker Compose versions

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
