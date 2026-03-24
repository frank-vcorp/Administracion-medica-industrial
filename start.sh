#!/bin/bash
set -e

## @id ARCH-20260324-29
## @backup context/checkpoints/CHK_2026-03-24_0519.md

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

load_env_file() {
  local env_file="$1"

  if [ -f "$env_file" ]; then
    echo "🔐 Loading environment from ${env_file#$SCRIPT_DIR/}..."
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  fi
}

load_env_file "$SCRIPT_DIR/.env"
load_env_file "$SCRIPT_DIR/.env.local"

LOCAL_DATABASE_URL="postgresql://user:password@db:5432/residente_digital"
APP_DATABASE_URL="${DATABASE_URL:-$LOCAL_DATABASE_URL}"
USE_REMOTE_DATABASE=false
if [ "$APP_DATABASE_URL" != "$LOCAL_DATABASE_URL" ]; then
  USE_REMOTE_DATABASE=true
fi

APP_NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-ami-local-dev-secret-20260324}"
APP_NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3001}"
APP_NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"

backend_env_args=(
  -e "DATABASE_URL=${APP_DATABASE_URL}"
)

if [ -n "${GEMINI_API_KEY:-}" ]; then
  backend_env_args+=(
    -e "GEMINI_API_KEY=${GEMINI_API_KEY}"
  )
fi

frontend_env_args=(
  -e "NEXT_PUBLIC_API_URL=${APP_NEXT_PUBLIC_API_URL}"
  -e "DATABASE_URL=${APP_DATABASE_URL}"
  -e "NEXTAUTH_SECRET=${APP_NEXTAUTH_SECRET}"
  -e "NEXTAUTH_URL=${APP_NEXTAUTH_URL}"
)

echo "🐳 Creating Network..."
docker network create residente-net || true

if [ "$USE_REMOTE_DATABASE" = false ]; then
  echo "🐘 Starting Database..."
  docker run -d --name db --network residente-net \
    -e POSTGRES_USER=user \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB=residente_digital \
    -p 5432:5432 \
    postgres:15-alpine
else
  echo "☁️ Using remote database for backend/frontend containers..."
fi

echo "🐍 Building & Starting Backend..."
docker build -t residente-backend ./backend
docker run -d --name backend --network residente-net \
  "${backend_env_args[@]}" \
  -v $(pwd)/uploads:/app/uploads \
  -p 8000:8000 \
  residente-backend

echo "⚛️ Building & Starting Frontend..."
docker build -t residente-frontend ./frontend
docker run -d --name frontend --network residente-net \
  "${frontend_env_args[@]}" \
  -v $(pwd)/uploads:/app/uploads \
  -p 3001:3000 \
  residente-frontend

if [ "$USE_REMOTE_DATABASE" = false ]; then
  echo "⏳ Running database migrations..."
  docker exec frontend sh -lc 'npx prisma migrate deploy'

  echo "🌱 Seeding local auth users..."
  docker exec frontend sh -lc 'node prisma/seed-local-auth.js'
else
  echo "⏭️ Skipping migrations and seed because a remote database is being used."
fi

echo "✅ System Running!"
echo "Frontend: http://localhost:3001"
echo "Backend: http://localhost:8000"
