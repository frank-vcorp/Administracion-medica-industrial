# SPEC IMPL-20260630-04 — Cierre Frontend Módulo de Reportes Masivos

**ID:** IMPL-20260630-04
**Fecha:** 2026-06-30
**Estado:** Planificado
**Continuación de:** IMPL-20260630-03 (backend completo, frontend bloqueado)
**SPEC funcional:** `context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md`

## Objetivo

Cerrar el frontend del módulo de reportes masivos resolviendo los 3 bloqueos pendientes de IMPL-20260630-03:
1. Conflicto `tsconfig.json` con `vitest/globals` que rompe resolución de tipos
2. Tipo `ReportStatus` duplicado (local vs canónico) en `useProjectReportStatus.ts`
3. Ruta `frontend/src/app/projects/[id]/page.tsx` inexistente

## Alcance (scope recortado, decisiones arquitectónicas explícitas)

### Decisión 1: Fix tsconfig (1 línea)

**Causa raíz:** `frontend/tsconfig.json` tiene `"types": ["vitest/globals", "vitest", ...]`. El archivo `vitest/globals.d.ts` referencia propiedades que TypeScript no resuelve estáticamente.

**Fix aplicado por INTEGRA:**
- Quitar `"vitest/globals"` del array `compilerOptions.types` en `frontend/tsconfig.json`
- Dejar solo `"vitest"` + cualquier otro tipo base (ej. `"node"`)
- El vitest config ya tiene `globals: true` en runtime, así que los tests siguen ejecutando

**Validación:** `pnpm typecheck` debe mostrar 0 errores de los símbolos `vi`, `afterEach`, `beforeEach`, `suite`, `test`.

### Decisión 2: Fix tipo ReportStatus (5 líneas)

**Causa raíz:** `frontend/src/hooks/useProjectReportStatus.ts` declara localmente:
```ts
export type ReportStatus = 'idle' | 'pending' | 'processing' | 'ready' | 'failed';
```
Pero `@/lib/reports/types` ya tiene el tipo canónico uppercase:
```ts
export type ReportStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
```

**Fix aplicado por INTEGRA:**
1. Eliminar el `export type ReportStatus` local en `useProjectReportStatus.ts`
2. Agregar import: `import type { ReportStatus } from '@/lib/reports/types';`
3. Eliminar `export type ReportStatus` local si quedó duplicado

**Validación:** `pnpm typecheck` debe mostrar 0 errores en `useProjectReportStatus.ts` líneas 97 y 101 (comparaciones `data.status !== 'READY'`).

### Decisión 3: Crear ruta `/projects/[id]/page.tsx`

**Archivo nuevo:** `frontend/src/app/projects/[id]/page.tsx`

**Requisitos (Next.js 16 + sesión + RBAC):**
- `async function Page({ params }: { params: Promise<{ id: string }> })`
- `const { id } = await params;` (OBLIGATORIO Next.js 16)
- Obtener sesión con `getServerSession(authOptions)` (verificar import exacto)
- Cargar proyecto con `prisma.project.findUnique({ where: { id }, include: {...} })`
- `notFound()` si no existe
- Botón "Reporte Masivo" condicional si rol ∈ {ADMIN, DOCTOR_GENERAL, RECEPTIONIST}
- Montar `<ProjectMassiveReportModal projectId={id} open={false} onClose={...} />`

**Patrón a seguir:** leer `frontend/src/app/companies/[id]/page.tsx` (verificado que usa `await params` correcto).

### Decisión 4: Errores preexistentes NO se tocan

Los errores preexistentes en `frontend/src/services/__tests__/company.service.test.ts` (`toBeInstanceOf`) son deuda técnica previa a IMPL-20260630-04. NO se arreglan en este scope. Documentar como TODO preexistente.

## Tareas de implementación (ejecutar en orden estricto)

### Tarea 1: Fix tsconfig

```bash
# 1. Leer frontend/tsconfig.json
# 2. Localizar array compilerOptions.types
# 3. Quitar "vitest/globals" (dejar solo "vitest" + otros)
# 4. Guardar
cd frontend && pnpm typecheck 2>&1 | head -30
```

Si siguen apareciendo errores de `vi`, `afterEach`, etc., **NO continuar** — escalar a INTEGRA.

### Tarea 2: Fix ReportStatus

```bash
# 1. Leer frontend/src/hooks/useProjectReportStatus.ts
# 2. Buscar la declaración local de ReportStatus
# 3. Reemplazar por: import type { ReportStatus } from '@/lib/reports/types';
# 4. Guardar
cd frontend && pnpm typecheck 2>&1 | head -30
```

### Tarea 3: Crear `/projects/[id]/page.tsx`

**Antes de escribir, leer en paralelo:**
1. `frontend/src/app/companies/[id]/page.tsx` — patrón de detalle con `await params`
2. `frontend/src/app/projects/page.tsx` — cómo se listan proyectos
3. `frontend/src/components/projects/ProjectMassiveReportModal.tsx` — props del modal
4. `frontend/src/actions/project-reports.actions.ts` — funciones del backend
5. `frontend/src/lib/reports/types.ts` — tipos del módulo
6. `frontend/prisma/schema.prisma` — modelo `Project` + relaciones

**Snippet base (adaptar nombres exactos al schema real):**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';  // ← verificar ruta exacta
import { prisma } from '@/lib/prisma';      // ← verificar ruta exacta
import { ProjectMassiveReportModal } from '@/components/projects/ProjectMassiveReportModal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      company: true,
      workers: {
        include: {
          event: {
            include: {
              eventTests: {
                include: {
                  medicalTest: true,
                  audiometry: true,
                  espirometry: true,
                  rxColumna: true,
                  rxTorax: true,
                  ecg: true,
                  laboratorio: true,
                  campimetria: true,
                  examenMedico: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const role = (session?.user as any)?.role ?? '';
  const canGenerateReport = ['ADMIN', 'DOCTOR_GENERAL', 'RECEPTIONIST'].includes(role);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Link href="/projects" className="text-sm text-blue-600 hover:underline">
        ← Volver a proyectos
      </Link>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="text-sm text-slate-600">{project.company?.name}</p>
        </div>

        {canGenerateReport && (
          <ProjectMassiveReportModal
            projectId={project.id}
            workers={project.workers}
          />
        )}
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          Trabajadores ({project.workers.length})
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-sm text-slate-600">
            {project.workers.length === 0
              ? 'Sin trabajadores cargados aún.'
              : `${project.workers.length} trabajadores registrados en este proyecto.`}
          </p>
        </div>
      </section>
    </div>
  );
}
```

**Adaptar:**
- Nombre del modelo (puede ser `worker` vs `workers` según schema real)
- Forma de las relaciones (puede ser `events` vs `event`)
- Ruta de `authOptions` y `prisma` (verificar imports existentes)
- Tipo del rol en `session.user` (puede haber tipo `User` ya definido)

### Tarea 4: Validar todo

```bash
cd frontend && pnpm typecheck
cd frontend && pnpm test
cd frontend && pnpm lint
```

Los errores preexistentes en `company.service.test.ts` no deben bloquear.

## Validaciones obligatorias antes de cerrar

- ✅ `pnpm typecheck` → 0 errores introducidos por IMPL-20260630-04
- ✅ `pnpm test` → todos los tests pasan
- ✅ `pnpm lint` → 0 errores nuevos

Errores preexistentes en `company.service.test.ts` (`toBeInstanceOf`) NO bloquean el cierre — son deuda técnica previa.

## Smoke test manual (cuando DB esté disponible)

```bash
# Terminal 1
cd backend && docker compose up -d postgres
cd backend && npx prisma migrate deploy
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && pnpm dev
```

Pasos:
1. Login como ADMIN en `http://localhost:3000`
2. Navegar a `/projects` → seleccionar un proyecto existente
3. Verificar que carga `/projects/[id]` con datos del proyecto
4. Verificar botón "Reporte Masivo" visible
5. Click → modal → seleccionar XLSX → "Generar"
6. Esperar polling (PENDING → PROCESSING → READY en ≤30s)
7. Descargar XLSX, abrir, verificar 3 hojas con datos reales
8. Repetir con PDF
9. Captura de pantalla del proceso

**Si smoke test no se puede ejecutar** (no hay DB con datos), documentar pasos exactos para validación humana.

## Self-review obligatorio antes de reportar

- [ ] ¿El código refleja esta SPEC punto por punto?
- [ ] ¿Sigue el patrón de `/companies/[id]/page.tsx`?
- [ ] ¿Usa `await params` (Next.js 16)?
- [ ] ¿Permisos RBAC correctos?
- [ ] ¿El modal se monta solo si rol autorizado?
- [ ] ¿No introduce código muerto ni TODOs nuevos?

## NO hacer

- ❌ NO modificar `schema.prisma`
- ❌ NO modificar backend
- ❌ NO commitear, pushear ni hacer deploy
- ❌ NO pedir qodo (sunset)
- ❌ NO invocar GEMINI directamente
- ❌ NO arreglar errores preexistentes en `company.service.test.ts`
- ❌ NO crear nuevas migraciones
- ❌ NO modificar otros tests

## Reporte final

Estructura esperada:
1. ✅/❌ de cada validación (typecheck, tests, lint)
2. ✅/❌ de creación de `/projects/[id]/page.tsx`
3. ✅/❌/⏸️ del smoke test
4. Lista exacta de archivos modificados/creados
5. Self-review con checklist
6. Pasos para validación humana si smoke test no se ejecutó

## Referencias

- SPEC funcional: `context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md`
- SPEC IMPL-20260630-03 (padre): `context/SPECs/SPEC_IMPL-20260630-03-MODULO-REPORTES-BACKEND.md`
- Checkpoint IMPL-20260630-03: `context/checkpoints/CHK_IMPL-20260630-03-MODULO-REPORTES.md`
- Handoff anterior: `context/interconsultas/HANDOFF_IMPL-20260630-03_SOFIA_MODULO-REPORTES.md`
- Junta origen: `context/Juntas/Avances AMI_ 2026_04_08 12_50 CST - Notas de Gemini.md`