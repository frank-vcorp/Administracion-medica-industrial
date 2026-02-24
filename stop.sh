#!/bin/bash
echo "🛑 Stopping services..."
docker stop frontend backend db || true
docker rm frontend backend db || true
docker network rm residente-net || true
echo "👋 Done."
