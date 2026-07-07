# HANDOFF UI-20260706-01 → SOFIA: Menú "Reportes Masivos" + página índice

**De:** INTEGRA
**Para:** SOFIA
**Origen:** Frank Saavedra — queja de UX "no me sé los IDs de memoria"
**Origen funcional:** módulo EBOOK PDF en producción (commit `3d98326`)

## 🎯 Objetivo

Agregar acceso directo al módulo de reportes masivos desde el menú lateral, sin necesidad de conocer IDs de proyectos.

## Decisiones arquitectónicas FIJAS (NO discutir)

| # | Decisión |
|---|----------|
| 1 | **Reutilizar** `ProjectMassiveReportModal` existente — NO reescribir |
| 2 | **Reutilizar** `ProjectMassiveReportButton` existente |
| 3 | Página nueva `/reports/page.tsx` con lista de proyectos + historial |
| 4 | Sidebar: agregar `📊 Reportes Masivos` en sección "Empresas", después de "Proyectos" |
| 5 | Server-side render con `await params` (Next.js 16) consistente con `/projects/[id]` |
| 6 | Reutilizar server actions existentes de `project-reports.actions.ts` |

## Archivos a modificar/crear

### Nuevos
- `frontend/src/app/reports/page.tsx` — página índice de reportes
- `frontend/src/app/reports/__tests__/page.test.tsx` (opcional)

### Modificar
- `frontend/src/components/AppShell.tsx` — agregar NavItem "Reportes Masivos"

## Tareas (ejecutar en este orden)

### Tarea 1: Agregar NavItem al sidebar

**Archivo:** `frontend/src/components/AppShell.tsx`

**Lee las líneas 145-148** (sección "Empresas"). Agrega una línea DESPUÉS de "Proyectos":

```tsx
<NavSection label="Empresas" collapsed={isEventWorkspace} />
<NavItem href="/companies" icon="🏢" label="Empresas Cliente" collapsed={isEventWorkspace} />
<NavItem href="/projects" icon="🗂️" label="Proyectos" collapsed={isEventWorkspace} />
<NavItem href="/reports" icon="📊" label="Reportes Masivos" collapsed={isEventWorkspace} />
```

### Tarea 2: Crear página `/reports/page.tsx`

**Estructura esperada:**

```tsx
// frontend/src/app/reports/page.tsx

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
// Ajustar el import de authOptions según el patrón del proyecto
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ProjectMassiveReportButton } from '@/components/projects/ProjectMassiveReportButton';

export const dynamic = 'force-dynamic';

export default async function ReportsIndexPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) redirect('/login');
  
  const role = (session.user as any)?.role ?? '';
  const canGenerate = ['ADMIN', 'DOCTOR_GENERAL', 'RECEPTIONIST'].includes(role);
  
  // Lista de proyectos con conteo de trabajadores
  const projects = await prisma.project.findMany({
    where: canGenerate ? {} : { /* filtrar por empresa asignada si no es admin */ },
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { workers: true } },
    },
    orderBy: { startDate: 'desc' },
    take: 50,
  });
  
  // Historial reciente de reportes generados
  const recentReports = await prisma.projectReport.findMany({
    where: { generatedById: session.user.id },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { generatedAt: 'desc' },
    take: 20,
  });
  
  return (
    <div className="container mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">📊 Reportes Masivos</h1>
        <p className="text-slate-600">
          Genera concentrados XLSX o EBOOKs PDF navegables por proyecto.
        </p>
      </header>
      
      {/* SECCIÓN 1: Generar nuevo reporte */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Generar nuevo reporte
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
            >
              <div>
                <h3 className="font-semibold text-slate-900">
                  {project.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {project.company?.name}
                </p>
                <p className="text-xs text-slate-500">
                  {project._count.workers} trabajador(es)
                </p>
              </div>
              <div className="flex gap-2">
                {canGenerate && project._count.workers > 0 && (
                  <ProjectMassiveReportButton
                    projectId={project.id}
                    variant="primary"
                  />
                )}
                <Link
                  href={`/projects/${project.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ver proyecto →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* SECCIÓN 2: Historial reciente */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Historial reciente
        </h2>
        {recentReports.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Aún no has generado reportes.
          </p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Fecha
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Proyecto
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Formato
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Estado
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((report) => (
                  <tr key={report.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {new Date(report.generatedAt).toLocaleString('es-MX')}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-900">
                      {report.project?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {report.format}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          report.status === 'READY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : report.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {report.status === 'READY' && report.fileUrlPdf && (
                        <a
                          href={`/api/v2/projects/${report.projectId}/reports/${report.id}/download?format=pdf`}
                          className="text-blue-600 hover:underline"
                        >
                          EBOOK
                        </a>
                      )}
                      {report.status === 'READY' && report.fileUrlXlsx && (
                        <a
                          href={`/api/v2/projects/${report.projectId}/reports/${report.id}/download?format=xlsx`}
                          className="text-blue-600 hover:underline ml-2"
                        >
                          XLSX
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

### Tarea 3 (opcional): Test del componente

Si alcanzas, crear `frontend/src/app/reports/__tests__/page.test.tsx`:

```tsx
// Test mínimo: verifica que la página requiere sesión y renderiza la lista
// Si no alcanzaste, omite este test
```

## Adaptaciones que SOFIA debe hacer

Antes de escribir, **verifica** estos imports contra el código existente:

1. **Path de authOptions**: ¿es `@/lib/auth`? Busca en otros server components
2. **Path de prisma**: ¿es `@/lib/prisma`?
3. **Path de ProjectMassiveReportButton**: lee `frontend/src/components/projects/ProjectMassiveReportButton.tsx` para confirmar props que acepta
4. **Modelo ProjectReport**: lee `frontend/prisma/schema.prisma` para confirmar campos exactos (fileUrlPdf, fileUrlXlsx, generatedAt, etc.)
5. **Si ProjectMassiveReportButton ya abre el modal internamente** (lo cual es probable, dado el smoke test), no necesitas pasar `open` prop. Solo el `projectId`.

## Validaciones obligatorias

```bash
# 1. Frontend typecheck
cd frontend && pnpm typecheck 2>&1 | head -30
# Esperado: 0 errores nuevos

# 2. Frontend tests
cd frontend && pnpm test -- --run 2>&1 | tail -20
# Esperado: tests pasan (incluyendo los del modal)

# 3. Smoke test manual con Playwright (si es posible)
# - Login ADMIN
# - Click en nuevo menú "📊 Reportes Masivos" en sidebar
# - Verificar que carga la lista de proyectos
# - Click en "Generar Reporte" de un proyecto con trabajadores
# - Verificar que abre el modal correctamente
```

## Self-review antes de reportar

- [ ] ¿NavItem agregado en sidebar?
- [ ] ¿Página `/reports/page.tsx` carga sin errores?
- [ ] ¿Lista muestra proyectos reales de Prisma?
- [ ] ¿Botón "Generar Reporte" abre el modal existente?
- [ ] ¿Historial muestra reportes recientes del usuario?
- [ ] ¿Links de descarga funcionan (XLSX + EBOOK)?
- [ ] ¿No rompí otros tests?

## ❌ NO hacer

- ❌ NO reescribir `ProjectMassiveReportModal` ni `ProjectMassiveReportButton`
- ❌ NO crear un modal nuevo
- ❌ NO agregar items al sidebar fuera de la sección "Empresas"
- ❌ NO cambiar el routing de `/projects/[id]`
- ❌ NO commitear ni pushear (esperando OK Frank)
- ❌ NO pedir qodo (sunset)
- ❌ NO invocar GEMINI directamente

## Reporte final

Reporta con:
1. ✅/❌ de typecheck
2. ✅/❌ de tests
3. ✅/❌ de smoke test (si alcanzaste)
4. Lista de archivos modificados/creados
5. Self-review checklist
6. **Si alcanzaste límite de steps**: reporta dónde quedaste