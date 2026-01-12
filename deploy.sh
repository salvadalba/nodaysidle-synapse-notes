#!/bin/bash
set -e

echo "🚀 Starting Synapse Notes deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if docker-compose.env exists
if [ ! -f "docker-compose.env" ]; then
    echo "❌ docker-compose.env file not found. Please create it based on docker-compose.env.example"
    exit 1
fi

# Validate docker-compose configuration
echo "📋 Validating docker-compose configuration..."
docker-compose config > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Docker Compose configuration is valid"
else
    echo "❌ Docker Compose configuration is invalid"
    exit 1
fi

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build --no-cache

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service status
echo "📊 Checking service status..."
docker-compose ps

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Access the application at:"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:3000"
echo ""
echo "📝 View logs with: docker-compose logs -f"
echo "🛑 Stop services with: ./stop.sh"
echo "🧹 Clean up with: ./clean.sh"
