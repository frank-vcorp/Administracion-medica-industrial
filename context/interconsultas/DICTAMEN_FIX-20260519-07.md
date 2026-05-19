# DICTAMEN TÉCNICO: Separación forense entre NameError de IA y 500 en /appointments
- **ID:** FIX-20260519-07
- **Fecha:** 2026-05-19
- **Solicitante:** INTEGRA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz

Hipótesis principal del 500 en `/appointments`:

1. El 500 de Vercel en `/appointments` no apunta, con la evidencia actual, al mismo defecto que rompe la subida IA en `backend/app/main.py`.
2. La página de citas es un componente cliente en `frontend/src/app/appointments/page.tsx`, sin referencias a `GEMINI_MODEL` ni `GEMINI_MODEL_EXTRACTION`, por lo que el `NameError` detectado en backend no explica por sí mismo un fallo de render inicial de Server Components en Next.
3. El render inicial de `/appointments` sí depende de superficie server-side del frontend: el `RootLayout` ejecuta `getServerSession(authOptions)` antes de renderizar y la propia ruta importa acciones server-side de `frontend/src/actions/appointment.actions.ts` a través de la página y de `AppointmentFormModal`.
4. Por eso, el escenario más probable es un segundo defecto localizado en el frontend desplegado en Vercel: o bien evaluación de módulo/ruta en la cadena de `appointment.actions.ts`, o bien fallo de auth/session/env en el shell server-side que esa ruta atraviesa.

Lectura forense:

1. `backend/app/main.py` sí conserva referencias rotas legacy (`GEMINI_MODEL`, `GEMINI_MODEL_EXTRACTION`) dentro de payloads de auditoría y respuestas V2; eso explica de forma directa el síntoma de subida IA.
2. No se encontraron referencias equivalentes en `frontend/` que conecten `/appointments` con ese corte de migración a Qwen/Featherless.
3. Si el 500 aparece solo en `/appointments` y no en otras rutas autenticadas, el sospechoso principal deja de ser `frontend/src/app/layout.tsx` y pasa a ser la cadena de imports específica de citas (`page.tsx` → `AppointmentFormModal.tsx` → `appointment.actions.ts` y acciones relacionadas).
4. Si además fallan otras rutas autenticadas, entonces el problema real está más arriba: `frontend/src/app/layout.tsx`, `frontend/src/auth.ts` o variables de entorno de Vercel ligadas a NextAuth/Prisma.

Chequeo discriminante mínimo:

1. Abrir otra ruta autenticada que no importe `appointment.actions.ts`.
2. Si esa ruta funciona, el 500 de `/appointments` es un defecto separado y local al frontend de citas.
3. Si esa ruta también cae con el mismo patrón, el defecto está en layout/auth/env de Vercel y sigue siendo separado del NameError del backend IA.

Segunda opinión no disponible:

1. Se intentó usar Qodo CLI para contraste forense, pero no está instalado en este entorno (`qodo: command not found`).

### B. Justificación de la Solución

No basta con corregir solo `backend/app/main.py` si el objetivo es cerrar ambos síntomas.

1. Corregir `backend/app/main.py` es necesario para eliminar el `NameError` de la subida IA.
2. El 500 de `/appointments` requiere validar frontend/Vercel porque su superficie de ejecución es distinta: layout server-side, auth de NextAuth, y acciones server-side de citas empaquetadas por Next.
3. La migración ARCH-20260519-13 sí dejó un defecto real en backend, pero la evidencia actual no soporta afirmar que el 500 de `/appointments` salga de ese mismo corte sin revisar el despliegue frontend.

### C. Instrucciones de Handoff para INTEGRA

Archivos ancla a corregir o validar:

1. Corregir `backend/app/main.py` en todas las auditorías/payloads donde aún se usa `GEMINI_MODEL` o `GEMINI_MODEL_EXTRACTION` como nombres operativos de extracción.
2. Validar `frontend/src/app/appointments/page.tsx` para confirmar que la ruta sigue siendo cliente puro y no arrastra imports que obliguen evaluación server-side inesperada.
3. Validar `frontend/src/components/AppointmentFormModal.tsx` porque amplía la cadena de imports de server actions específica de `/appointments`.
4. Validar `frontend/src/actions/appointment.actions.ts` como sospechoso principal del 500 si otras rutas autenticadas sí abren correctamente.
5. Validar `frontend/src/app/layout.tsx` y `frontend/src/auth.ts` si el fallo se reproduce en más rutas autenticadas; ahí está la frontera server-side común del render.
6. Validar en Vercel los logs del request y la configuración de entorno asociada a NextAuth/Prisma para distinguir fallo de módulo versus fallo de auth/env.

Conclusión ejecutiva:

1. **Hipótesis principal:** el 500 de `/appointments` es más probable como segundo defecto separado en frontend/Vercel que como efecto directo del NameError de `backend/app/main.py`.
2. **Alcance de corrección:** no basta con tocar backend; hay que revisar al menos la cadena frontend de citas y/o el entorno de Vercel.
3. **Prioridad de triage:** primero corregir `backend/app/main.py` para cerrar la regresión confirmada de IA, y en paralelo validar logs de Vercel sobre `appointment.actions.ts`, `layout.tsx` y `auth.ts` para clasificar el 500.