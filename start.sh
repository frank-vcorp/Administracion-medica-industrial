#!/bin/bash
set -e

echo "🐳 Creating Network..."
docker network create residente-net || true

echo "🐘 Starting Database..."
docker run -d --name db --network residente-net \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=residente_digital \
  -p 5432:5432 \
  postgres:15-alpine

echo "🐍 Building & Starting Backend..."
docker build -t residente-backend ./backend
docker run -d --name backend --network residente-net \
  -e DATABASE_URL=postgresql://user:password@db:5432/residente_digital \
  -v $(pwd)/uploads:/app/uploads \
  -p 8000:8000 \
  residente-backend

echo "⚛️ Building & Starting Frontend..."
docker build -t residente-frontend ./frontend
docker run -d --name frontend --network residente-net \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  -v $(pwd)/uploads:/app/uploads \
  -p 3001:3000 \
  residente-frontend

echo "✅ System Running!"
echo "Frontend: http://localhost:3001"
echo "Backend: http://localhost:8000"
