# REPORT: E2E Verification on Vercel
**ID:** TEST-VERCEL-20260307-01
**Target:** https://administracion-medica-industrial.vercel.app/
**Date:** 2026-03-07

## 1. Action
Attempted to run Playwright E2E tests directly against the Vercel deployment to verify the "Async Params" fix in `/history/[workerId]` and `/events/[id]`.

## 2. Setup
- Created `frontend/tests/vercel-sanity.spec.ts`.
- Seeded user `test_vercel@sistema.com` / `Test123!` directly to Railway DB (assuming Vercel connects to same DB).
- Configured Playwright to target Vercel URL.

## 3. Result: FAIL (Login Block)
The tes was unable to bypass the Login screen.
- **Credentials Tried:**
  - `admin@sistema.com` / `Admin123!` (Standard)
  - `admin@sistema.com` / `Admin@123` (From `seed-auth.ts` reference)
  - `test_vercel@sistema.com` / `Test123!` (Newly seeded)
- **Outcome:**
  - Auth flow initiates (Click "Iniciar Sesión").
  - System remains on `/login`.
  - Error container (`.bg-red-50`) appears, indicating a functional rejection (e.g., 401 Unauthorized or Config Error).

## 4. Root Cause Analysis (Hypothesis)
1. **NEXTAUTH_URL Mismatch:** If Vercel Environment Variable `NEXTAUTH_URL` is not set to `https://administracion-medica-industrial.vercel.app`, the auth cookie may be rejected or redirect fails.
2. **NEXTAUTH_SECRET Mismatch:** If the secret differs from build time or is missing.
3. **Database Disconnect:** If Vercel is NOT connected to the Railway DB where `test_vercel` exists.

## 5. Recommendation
1. Verify Vercel Project Settings > Environment Variables:
   - `NEXTAUTH_URL`: Must match the Vercel domain.
   - `DATABASE_URL`: Must match the active Railway DB.
   - `NEXTAUTH_SECRET`: Must be defined.
2. Check Vercel Function Logs for `[next-auth]` errors.
