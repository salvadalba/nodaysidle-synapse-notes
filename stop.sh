#!/bin/bash
set -e

echo "🛑 Stopping Synapse Notes services..."

# Stop all services
docker-compose down

echo "✅ All services stopped successfully!"
echo ""
echo "📝 To start services again, run: ./deploy.sh"
echo "🧹 To remove containers and volumes, run: ./clean.sh"
