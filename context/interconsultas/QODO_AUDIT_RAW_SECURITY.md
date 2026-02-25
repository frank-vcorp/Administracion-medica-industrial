# QODO AUDIT RAW - SEGURIDAD Y CALIDAD (2026-02-25)

## Hallazgos críticos (seguridad)

### 1) Secreto/API Key hardcodeado en backend (exfiltración inmediata)
**Archivo:** `backend/app/main.py`
**Evidencia:** `GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyC5bVos0JwqdutC3JsQf6I3sNY7NVv2qlQ")`
**Impacto:** Cualquiera con acceso al repo puede usar la clave de Gemini.
**Recomendación:** Eliminar el fallback hardcodeado y exigir `GEMINI_API_KEY` por entorno.

### 2) Credenciales débiles/por defecto en firma PDF
**Archivo:** `backend/app/main.py` (`SignPdfRequest`)
**Evidencia:** `password: Optional[str] = "test1234"`
**Impacto:** Compromete la clave privada del certificado P12.
**Recomendación:** Exigir password por env/secret manager.

### 3) docker-compose con credenciales de BD triviales
**Archivo:** `docker-compose.yml`
**Evidencia:** `user/password` y `DATABASE_URL=postgresql://user:password@db...`
**Impacto:** Riesgo alto si se reutiliza fuera de local/dev.
**Recomendación:** Mover a `.env` fuera del repo.

### 4) Exposición de datos sensibles en logs
**Archivos:** `frontend/src/actions/upload.actions.ts` y `backend/app/main.py`
**Evidencia:** `console.log('🧠 AI Result:', result)`
**Impacto:** Resultados IA/extracción pueden contener PHI/PII.
**Recomendación:** Sanitizar/redactar logs.

## Hallazgos importantes (seguridad / robustez)

### 5) Llamadas a Gemini sin controles de timeouts
**Archivo:** `backend/app/services/ai/base.py`
**Evidencia:** Usa `requests.post(...)` sin timeout.
**Impacto:** Cuelgues del worker, agotamiento de conexiones.
**Recomendación:** Agregar `timeout=(connect, read)`.

### 6) SSRF (bajo/medio) por URL de API desde env en server action
**Archivo:** `frontend/src/actions/upload.actions.ts`
**Evidencia:** `const PYTHON_API = process.env.NEXT_PUBLIC_API_URL`
**Recomendación:** Usar variable *server-only* (no `NEXT_PUBLIC_*`).

## Calidad de código / mantenibilidad

### 7) Código muerto / deprecated stubs en backend
**Archivo:** `backend/app/main.py`
**Evidencia:** Funciones con `pass` y marcadas "DEPRECATED".
**Recomendación:** Eliminarlas.

### 8) Uso extensivo de `any` en frontend
**Archivos:** Múltiples componentes y páginas.
**Recomendación:** Tipar props y DTOs.

### 9) Dockerfile backend con `--reload`
**Archivo:** `backend/Dockerfile`
**Evidencia:** `CMD ["uvicorn", "app.main:app", "--reload"]`
**Recomendación:** Quitar `--reload` para producción.
