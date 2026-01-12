#!/bin/bash
set -e

echo "Starting database initialization..."

# The database and user are already created by the PostgreSQL container
# We just need to run the migrations

echo "Running migrations..."
for f in /migrations/*.sql; do
    echo "Applying $f..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
echo "Migrations completed successfully!"

echo "Database initialization completed!"
