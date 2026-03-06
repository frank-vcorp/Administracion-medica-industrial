# DICTAMEN TÉCNICO: Corrección de Params Asíncronos en Historial Clínico
- **ID:** FIX-20260306-02
- **Fecha:** 2026-03-06
- **Solicitante:** Antigravity (Automático tras reporte de usuario)
- **Estado:** EN ANÁLISIS

### A. Análisis de Causa Raíz
El sistema reporta un "crash" al acceder a la ruta `/history/[workerId]`.
La investigación revela que el proyecto utiliza **Next.js 16.1.6**.
En versiones recientes de Next.js (15+), las propiedades dinámicas como `params` y `searchParams` en `page.tsx`, `layout.tsx`, `route.ts` y `generateMetadata` han cambiado de ser objetos síncronos a ser **Promesas (Promises)** que deben ser esperadas (`await`).

El archivo `frontend/src/app/history/[workerId]/page.tsx` accede a `params.workerId` de forma síncrona tanto en el componente `HistoryPage` como en la función `generateMetadata`. Esto provoca un error en tiempo de ejecución al intentar acceder a propiedades de una Promesa sin resolver.

**Código Afectado:**
```typescript
// frontend/src/app/history/[workerId]/page.tsx

// Síncrono (Incorrecto en Next.js 15+)
export async function generateMetadata({ params }: HistoryPageProps) { ... }
export default async function HistoryPage({ params }: HistoryPageProps) { ... }
```

### B. Justificación de la Solución
Se debe refactorizar el código para tratar `params` como una Promesa, tal como lo exige la documentación de actualización de Next.js 15.

**Cambios Requeridos:**
1.  Actualizar la definición de tipos de `HistoryPageProps` para que `params` sea `Promise<{ workerId: string }>`.
2.  En `generateMetadata`, esperar `params` antes de usar sus propiedades: `const { workerId } = await params`.
3.  En el componente `HistoryPage`, esperar `params` antes de usar sus propiedades: `const { workerId } = await params`.

Adicionalmente, se verificará que no existan problemas de serialización de datos (objetos `Date`) al pasar `initialData` al componente cliente, asegurando que solo se pasen datos serializables.

### C. Instrucciones de Handoff para Antigravity
El fix es estructural y compatible con la versión actual de Next.js.
Una vez aplicado, el agente de UI (Antigravity) podrá continuar con el pulido visual.
No se requieren cambios en la lógica de negocio ni en la base de datos.
