/**
 * Página de Gestión de Proyectos de Visita Médica
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 * @id FIX-20260519-08
 * @backup context/checkpoints/CHK_IMPL-20260519-14-PROJECT-ALTA-MASIVA.md
 * @id IMPL-20260527-01
 * @spec context/SPECs/SPEC_ARCH-20260519-16-CALENDARIO-PROYECTOS-VISITAS.md
 * @backup context/checkpoints/CHK_IMPL-20260527-01-CALENDARIO-PROYECTOS.md
 */
export const dynamic = 'force-dynamic'

import { getProjects } from '@/actions/project.actions'
import { getCompanies, getBranches } from '@/actions/admin.actions'
import ProjectsCalendar from '@/components/ProjectsCalendar'

export default async function ProjectsPage() {
  const [projectsResult, companiesResult, branchesResult] = await Promise.allSettled([
    getProjects(),
    getCompanies(),
    getBranches(),
  ])

  if (projectsResult.status !== 'fulfilled' || companiesResult.status !== 'fulfilled') {
    throw new Error('No se pudieron cargar los proyectos')
  }

  const projects = projectsResult.value
  const companies = companiesResult.value
  const branches = branchesResult.status === 'fulfilled' ? branchesResult.value : []

  // Normalizar branches al mínimo necesario
  const branchOptions = branches.map((b: { id: string; name: string }) => ({
    id: b.id,
    name: b.name,
  }))

  const companyOptions = companies.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }))

  return (
    <div className="space-y-8 pb-12">
      <ProjectsCalendar
        projects={projects}
        companies={companyOptions}
        branches={branchOptions}
      />
    </div>
  )
}
