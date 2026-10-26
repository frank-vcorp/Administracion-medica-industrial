# Qodo Agent Context & Guidelines

## Project Identity
- **Name**: Administracion-medica-industrial
- **Description**: Sistema de gestión médica industrial con Historial Clínico, Triaje y Gestión de Trabajadores.

## Tech Stack & Versioning (CRITICAL)
- **Framework**: Next.js **16.1.6** (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Validation**: Zod (Server-side enforced)

## Development Rules

### 1. Next.js 16+ Compatibility (Strict)
- **Async Params**: In `page.tsx`, `layout.tsx`, and `route.ts`, the `params` and `searchParams` props are **Promises**.
  - ❌ **INCORRECT (Legacy)**: `const { id } = params;`
  - ✅ **CORRECT (Required)**: `const { id } = await params;`
  - **Instruction**: Do NOT report as warning/error. Do NOT suggest synchronous access.

### 2. Server Actions & Data Fetching
- **Error Handling**: Never fail silently. If a DB call returns `null` or fails, the UI must render an error state, not an empty form.
- **Privacy**: Never `console.log` full data objects in production. Use minimal identifiers/hashes.

### 3. Security
- **XSS**: React escapes by default. Verify no usage of `dangerouslySetInnerHTML` with user content.
- **Input Validation**: Client-side validation is UX only. Server-side Zod validation is mandatory in `src/actions`.

## Workflow
- **Spec First**: All changes must follow defined SPECs.
- **Audit**: Verify `await params` in all new dynamic routes.

## Development environment (human + agents)

- **Default:** implement and verify via **Cursor Cloud Agents** and the linked **Project**; production deploy is **git push → Vercel (frontend) + Railway (backend, DB, WhatsApp)** — not a self-hosted VPS.
- **Optional local stack:** `docker compose up` from repo root for Postgres + backend + frontend when someone needs a full stack on a machine.
- **Do not** assume Contabo, Hermes sync, or Coolify as part of this repo’s deploy path; any mentions in `context/` or comments are historical or generic FS notes only.
