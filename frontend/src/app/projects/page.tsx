/**
 * Página de Gestión de Proyectos de Visita Médica
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 * @id FIX-20260519-08
 * @backup context/checkpoints/CHK_IMPL-20260519-14-PROJECT-ALTA-MASIVA.md
 * @id IMPL-20260527-01
 * @spec context/SPECs/SPEC_ARCH-20260519-16-CALENDARIO-PROYECTOS-VISITAS.md
 * @backup context/checkpoints/CHK_IMPL-20260527-01-CALENDARIO-PROYECTOS.md
 * @id ARCH-20260804-03 — Vinculación inversa: ProjectsCalendar muestra badge 🔧 Mant.
 */
export const dynamic = 'force-dynamic'

import { getProjects } from '@/actions/project.actions'
import { getCompanies, getBranches } from '@/actions/admin.actions'
import { getMaintenancesByUnitIds } from '@/actions/maintenance.actions'
import { getMobileUnits } from '@/actions/mobile-unit.actions'
import ProjectsCalendar from '@/components/ProjectsCalendar'

type ProjectLike = { mobileUnit?: { id: string } | null }

export default async function ProjectsPage() {
  const [projectsResult, companiesResult, branchesResult, mobileUnitsResult] = await Promise.allSettled([
    getProjects(),
    getCompanies(),
    getBranches(),
    getMobileUnits(),
  ])

  if (projectsResult.status !== 'fulfilled' || companiesResult.status !== 'fulfilled') {
    throw new Error('No se pudieron cargar los proyectos')
  }

  const projects = projectsResult.value
  const companies = companiesResult.value
  const branches = branchesResult.status === 'fulfilled' ? branchesResult.value : []
  const mobileUnits = mobileUnitsResult.status === 'fulfilled' ? mobileUnitsResult.value : []

  // Normalizar branches y unidades móviles al mínimo necesario
  const branchOptions = branches.map((b: { id: string; name: string }) => ({
    id: b.id,
    name: b.name,
  }))

  const companyOptions = companies.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }))

  const mobileUnitOptions = mobileUnits.map((u: { id: string; name: string; plate: string | null; status: string }) => ({
    id: u.id,
    name: u.name,
    plate: u.plate,
    status: u.status,
  }))

  // ARCH-20260804-03 — Fase 4 / §8.1: extraer unidades referenciadas y obtener mantenimientos activos.
  const mobileUnitIds = Array.from(
    new Set(
      (projects as ProjectLike[])
        .map((p) => p.mobileUnit?.id)
        .filter((id): id is string => Boolean(id))
    )
  )

  const unitMaintenances =
    mobileUnitIds.length > 0
      ? await getMaintenancesByUnitIds(mobileUnitIds, ['PROGRAMADO', 'REPROGRAMADO'])
      : []

  return (
    <div className="space-y-8 pb-12">
      <ProjectsCalendar
        projects={projects}
        companies={companyOptions}
        branches={branchOptions}
        mobileUnits={mobileUnitOptions}
        unitMaintenances={unitMaintenances}
      />
    </div>
  )
}
