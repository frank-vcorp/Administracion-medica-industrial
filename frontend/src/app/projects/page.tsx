/**
 * Página de Gestión de Proyectos de Visita Médica
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 */
export const dynamic = 'force-dynamic'

import { getProjects } from '@/actions/project.actions'
import { getCompanies, getBranches } from '@/actions/admin.actions'
import ProjectFormModal from '@/components/ProjectFormModal'
import ProjectsTable from '@/components/ProjectsTable'

export default async function ProjectsPage() {
  const [projects, companies, branches] = await Promise.all([
    getProjects(),
    getCompanies(),
    getBranches(),
  ])

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Proyectos de Visita Médica</h2>
          <p className="text-sm text-slate-500 font-medium">
            Gestión de campañas y visitas médicas por empresa.
          </p>
        </div>

        <ProjectFormModal companies={companyOptions} branches={branchOptions} />
      </div>

      <ProjectsTable
        projects={projects}
        companies={companyOptions}
        branches={branchOptions}
      />
    </div>
  )
}
