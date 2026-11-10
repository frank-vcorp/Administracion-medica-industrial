# Administración Médica Industrial (AMI)

Sistema de gestión médica industrial: historial clínico, triaje y gestión de trabajadores.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 (App Router), Prisma, TypeScript — carpeta `frontend/` |
| API / IA / PDF | Python FastAPI — carpeta `backend/` |
| WhatsApp | Gateway Node — carpeta `whatsapp-gateway/` |
| Base de datos | PostgreSQL |

## Desarrollo (cloud-first)

El flujo de trabajo recomendado es **Cursor Cloud Agents + Project** (sin depender de un VPS de desarrollo). Para pruebas locales opcionales:

```bash
docker compose up
```

Frontend en `http://localhost:3000`, API en `http://localhost:8000`. Variables de entorno en `frontend/.env.local` (no versionadas; ver Context del Project o futuro `.env.example`).

Convenciones para agentes: ver [`AGENTS.md`](./AGENTS.md).

## Deploy (producción)

Los despliegues son **automáticos al hacer push** a la rama principal:

| Componente | Plataforma |
|------------|------------|
| Frontend Next.js | [Vercel](https://vercel.com) (`vercel.json` en raíz) |
| Backend, Postgres, WhatsApp | [Railway](https://railway.app) (Docker: `backend/Dockerfile`, `whatsapp-gateway/railway.toml`) |

Configurar `DATABASE_URL`, `NEXTAUTH_*`, `NEXT_PUBLIC_API_URL` y demás secretos en los dashboards de Vercel y Railway — no en el repositorio.

## Documentación adicional

- Bitácora y SPECs históricas: carpeta `context/` (incluye notas de infra pasada; no define el pipeline actual de deploy).
- WhatsApp: [`whatsapp-gateway/README.md`](./whatsapp-gateway/README.md).
