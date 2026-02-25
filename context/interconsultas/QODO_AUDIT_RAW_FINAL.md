# QODO AUDIT RAW - INTEGRIDAD DE SISTEMA (2026-02-25)

## 1) Mapa de integración Frontend ↔ Backend (FastAPI)
**Veredicto:** Los endpoints usados por el frontend **sí existen** en el backend y las rutas coinciden (`/api/v1/analyze`, `/api/v1/sign-pdf`, `/api/v1/generate-excel-report`).

## 2) Variables de entorno / base URLs (posibles desalineaciones)
**Riesgo detectado:** En `docker-compose.yml`, el servicio `frontend` define `NEXT_PUBLIC_API_URL=http://localhost:8000`. En un entorno Docker, las Server Actions (que corren en el contenedor frontend) fallarán al intentar conectar a `localhost:8000` porque el backend está en otro contenedor. Debería ser `http://backend:8000`.

## 3) Flujo de archivos /uploads
**Veredicto:** El contrato de `file_path` es **coherente** y el volumen está **compartido** correctamente según `docker-compose.yml`.

## 4) Rutas Next.js y enlaces internos
**Veredicto:** No se encontraron enlaces internos rotos. Todas las rutas referenciadas en el Sidebar y Portal existen en el App Router.

## 5) Autenticación (NextAuth) y protección de rutas
**Veredicto:** El flujo `/login` → `/api/auth/*` y la protección por middleware se ven **consistentes**. No hay bypass evidente.

## 6) Desalineación Funcional Crítica: Descarga de PDF Firmado
**Riesgo detectado:** La acción `signMedicalDictamPDF()` guarda correctamente la ruta del PDF firmado en la base de datos (`pdfUrl`). Sin embargo, el endpoint del frontend `GET /api/pdf/[eventId]` **no lee este archivo firmado**. En su lugar, regenera un PDF "on the fly" usando `@react-pdf/renderer`. Esto significa que el usuario descargará un PDF sin firma, rompiendo el propósito de la Fase 6.
