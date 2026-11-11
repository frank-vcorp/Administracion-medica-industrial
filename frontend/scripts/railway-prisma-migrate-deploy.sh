#!/usr/bin/env bash
# Aplica migraciones Prisma pendientes contra la BD de producción (Railway).
# DATABASE_URL la inyecta Railway; no commitear ni pegar la URL en chat.
#
# Uso (repo enlazado: `railway link`):
#   cd frontend
#   railway run --service 'Administracion-medica-industrial' ./scripts/railway-prisma-migrate-deploy.sh
#
# Alternativa con URL en el entorno (máquina local con .env.production):
#   cd frontend
#   set -a && source .env.production && set +a
#   ./scripts/railway-prisma-migrate-deploy.sh
#
# Migraciones críticas recientes si estaban pendientes:
#   - 20261028190000_medical_verdict_patient_pdf
#   - 20261106171000_appointment_follow_up_from_consult

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no está definida." >&2
  echo "En Railway: railway run --service 'Administracion-medica-industrial' $0" >&2
  exit 1
fi

echo "=== prisma migrate deploy (cwd: $ROOT) ==="
npx prisma migrate deploy

echo ""
echo "=== prisma migrate status ==="
npx prisma migrate status
