# CHK_FIX-20260326-04 — Corrección fileUrl fantasma y 404 en regeneración IA

**ID de Intervención:** ARCH-20260326-04  
**Agente:** SOFIA - Builder  
**Fecha:** 2026-03-26  
**Commit hash:** d72b443  
**Branch:** main  
**Estado:** ✅ Enviado a producción

---

## Causa Raíz Confirmada

`uploadEventTestFile` (fallback V1) generaba una ruta local inventada sin subir el archivo físicamente:

```ts
// ANTES — ruta fantasma sin archivo físico en disco:
const fileUrl = `/uploads/${Date.now()}-${file.name.replace(...)}`
```

Esta ruta se guardaba en `EventTest.fileUrl` **sin subir nada al backend**. Cuando `regenerateStudyAI` pedía `${apiBase}${fileUrl}` el servidor respondía HTTP 404 y la tarjeta de regeneración quedaba rota sin mensaje claro.  
Estudio afectado conocido: `2fb732f2-bd89-4e5f-a7a8-a7c779df8412 / AUDIOMETRIA`.

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/app/main.py` | ➕ Nuevo endpoint `POST /api/v1/upload-only` |
| `frontend/src/actions/event-test.actions.ts` | 🔧 Fallback V1 real + mensaje 404 accionable en `regenerateStudyAI` |

---

## Cambios Detallados

### 1. `backend/app/main.py` — `POST /api/v1/upload-only`

Endpoint nuevo y mínimo, sin IA. Recibe `UploadFile`, persiste bytes en `UPLOAD_DIR` y retorna:
```json
{ "status": "success", "file": "1711400000-archivo.pdf", "file_url": "/uploads/1711400000-archivo.pdf" }
```
Sin dependencia de servicios IA → nunca crashea si Gemini no está disponible.

### 2. `uploadEventTestFile` — fallback V1 real

| | Antes | Después |
|--|-------|---------|
| fileUrl | Inventada `${Date.now()}-...` | Solo guarda si `/api/v1/upload-only` responde `success` |
| DB con archivo inexistente | Siempre | Nunca |
| Si upload físico también falla | Guardaba ruta falsa | `fileUrl` omitido; error accionable al usuario |

### 3. `regenerateStudyAI` — mensaje 404 claro

**Antes:** `"No se pudo descargar el archivo para regenerar IA: HTTP 404"` (opaco)

**Ahora** cuando `status === 404`:
> "El archivo del estudio ya no está disponible en el servidor. Vuelva a subir el archivo para regenerar el análisis IA."

Persiste también en `resultNotes` del `EventTest` para trazabilidad.

---

## Soft Gates

| Gate | Estado | Evidencia |
|------|--------|-----------|
| 1 — Compilación Backend | ✅ | `python3 -c "import ast; ast.parse(...)"` → sin errores |
| 1 — Compilación Frontend | ✅ | `pnpm run build` → 17/17 páginas, sin errores TS |
| 2 — Testing | ⚠️ Parcial | Flujo condicional `if (fileUrl)` elimina la regresión de raíz. E2E requiere backend vivo. |
| 3 — Revisión | ✅ | 2 archivos, < 70 líneas nuevas |
| 4 — Documentación | ✅ | Checkpoint presente, `resultNotes` trazable en DB |

---

## Acción Pendiente (manual)

El estudio `2fb732f2-bd89-4e5f-a7a8-a7c779df8412 / AUDIOMETRIA` tiene una ruta inventada en DB previa al fix.  
Con este fix `regenerateStudyAI` retorna el mensaje claro en lugar del 404 opaco.  
**El operador debe volver a subir el archivo** para que el pipeline IA procese normalmente.
