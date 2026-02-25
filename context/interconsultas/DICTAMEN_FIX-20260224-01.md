# 🛡️ DICTAMEN TÉCNICO FORENSE: FIX-20260224-01

**Fecha:** 2026-02-24
**Auditor:** DEBY (con asistencia de Qodo CLI)
**Módulo:** `frontend/src/actions/*`

## A. HALLAZGO Y CAUSA RAÍZ
Durante la auditoría forense ejecutada con Qodo CLI, se detectaron múltiples vulnerabilidades de robustez y performance en la capa de Server Actions de Next.js:
1. **Ausencia de Try/Catch Global:** Acciones como `worker.actions.ts`, `company.actions.ts` y `event.actions.ts` ejecutan queries y mutaciones a la base de datos (Prisma) sin capturar excepciones. Si Prisma arroja un error (ej. restricción de llaves únicas o caída de BD), el cliente recibe un error 500 no controlado.
2. **Inconsistencia de Contratos en `uploadFile`:** El archivo `upload.actions.ts` lanza una excepción (`throw new Error`) si faltan metadatos, pero retorna un objeto `{ success: false }` si falla la escritura del archivo, obligando al frontend a prever ambos escenarios.
3. **Deuda de Rendimiento en Memoria:** La función `getEventsKanban` en `event.actions.ts` recorre el array principal 3 veces completas (con `.filter`) para separar los eventos por estatus, causando degradación de performance cuadratica `O(N)` innecesaria frente a un `reduce`.

## B. IMPACTO EN PRODUCCIÓN
Si estos vectores de riesgo alcanzan producción:
- Los usuarios verán pantallas blancas o errores crípticos del servidor al intentar crear registros duplicados o si la base de datos se interrumpe temporalmente, degradando la experiencia de usuario.
- A medida que crezca la volumetría de eventos agendados, la vista de Kanban se volverá más lenta y consumirá más memoria de Vercel/Node.js, pudiendo causar retardos importantes.
- El manejo inconsistente en las subidas de archivos puede propagar crashes a la interfaz si no se atrapa el `throw`.

## C. RESOLUCIÓN APLICADA (Mínima Intervención)
Para parchar la herida sin reescribir la lógica de la aplicación, ejecutaremos:
1. **Refactorización de `uploadFile`:** Unificar el retorno a `{ success: false, error: string }` para remover el `throw new Error`.
2. **Inyección de bloques `try/catch`:** Proteger el código fuente de las acciones críticas para retornar un `{ error }` tipado en lugar de colapsar la app.
3. **Optimización Lineal (Kanban):** Reemplazar los 3 `.filter` por un único `reduce` en `getEventsKanban` logrando `O(N)` en un solo pase.
