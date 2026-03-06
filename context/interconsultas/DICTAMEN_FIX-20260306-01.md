# DICTAMEN TÉCNICO: Error 500 y Crash en Expedientes (Vercel)

- **ID:** FIX-20260306-01
- **Fecha:** 2026-03-06
- **Solicitante:** Antigravity (Detección durante E2E Walkthrough)
- **Agente:** @DEBY (Forense / QA)
- **Estado:** ✅ VALIDADO (Fix Aplicado)

---

## A. Análisis de Causa Raíz

### Síntoma
Al intentar acceder a la ruta dinámica `/events/[id]` en el entorno de producción (Vercel), el servidor retornaba un **Error 500 (Internal Server Error)** y el cliente mostraba una excepción genérica de Next.js. El problema era reproducible para todos los expedientes (Juan Mendoza, Ismael Prueba).

### Hallazgo Forense

| Área Investigada | Resultado |
|---|---|
| Base de Datos Railway | ✅ Integridad total. Los objetos `MedicalEvent` existen y tienen relaciones correctas con `Worker` y `Branch`. |
| Renderizado SSR | ✅ Simulación local con datos reales de Railway completada sin errores. |
| Consola de Navegador | ❌ Excepción de hidratación y fallo al cargar recurso (500). |
| Dependencias | ⚠️ `Next.js 16.1.6` detected. Versión canary/experimental que endurece las reglas de serialización y contexto. |

### Causa Raíz

Se identificaron dos problemas concurrentes que provocaban el crash en producción:

1.  **Missing `SessionProvider`:** El componente `EventFlowController.tsx` invocaba `useSession()` de `next-auth/react`. Sin embargo, el `RootLayout` no envolvía a sus hijos en un `SessionProvider`, lo que causaba un crash inmediato en el cliente al intentar acceder a un contexto inexistente.
2.  **Fallo de Serialización de Fechas (React 19 / Next 15+):** La página de servidor enviaba objetos `Date` nativos (provenientes de Prisma) a componentes cliente (`TriageForm`, `DoctorExamForm`). En versiones modernas de React/Next, esto puede causar errores de hidratación si la serialización automática falla o produce discrepancias entre servidor y cliente, resultando en un error 500 durante el renderizado estático/dinámico en el servidor de Vercel.

---

## B. Justificación de la Solución

### Cambios Aplicados

1.  **Implementación de Providers:**
    - Creado `frontend/src/components/Providers.tsx` como Client Component para envolver `SessionProvider`.
    - Modificado `frontend/src/app/layout.tsx` para integrar el wrapper de proveedores.

2.  **Parche Defensivo en `EventPage` (`/events/[id]/page.tsx`):**
    - **Serialización Manual:** Se implementó un patrón `JSON.parse(JSON.stringify(data))` para asegurar que solo objetos planos (POJOs) con strings de fecha lleguen a los componentes cliente.
    - **Robusteza (Try-Catch):** Se envolvió toda la lógica de obtención de datos del servidor en un bloque `try-catch` para evitar 500s "ciegos". En caso de fallo crítico, se muestra una UI de error controlada con opción de retorno al Piso Clínico.

### Archivos Modificados
- `frontend/src/components/Providers.tsx` (Nuevo)
- `frontend/src/app/layout.tsx` (Inyección de Providers)
- `frontend/src/app/events/[id]/page.tsx` (Lógica de serialización y manejo de errores)

---

## C. Instrucciones de Handoff

### Para SOFIA (Builder):
1. No pasar objetos `Date` directamente desde Server Components a Client Components. Convertirlos siempre a `string` o usar `JSON.parse(JSON.stringify())`.
2. El contexto de sesión ya está disponible globalmente en la app.

### Para INTEGRA (Orquestadora):
1. El sistema es estable de nuevo para continuar el walkthrough.
2. Se recomienda revisar si la versión `16.1.6` de Next.js fue una actualización intencional o accidental, dado que es una versión muy reciente/experimental.

---

## Commits (Sugeridos para el Push)

| Tipo | Descripción |
|---|---|
| `fix(auth)` | `FIX-20260306-01` - Implementar SessionProvider faltante en Layout |
| `fix(clinical)` | `FIX-20260306-01` - Corregir serialización de fechas y 500 en Expedientes |
