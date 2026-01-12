#!/bin/bash
set -e

echo "🧹 Cleaning up Synapse Notes deployment..."

# Ask for confirmation
read -p "⚠️  This will remove all containers, volumes, and data. Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove any dangling images
echo "🗑️  Removing dangling images..."
docker image prune -f

echo "✅ Cleanup completed successfully!"
echo ""
echo "📝 To deploy again, run: ./deploy.sh"
