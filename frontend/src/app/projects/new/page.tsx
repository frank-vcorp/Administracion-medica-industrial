import { getCompanies, getBranches } from '@/actions/admin.actions'
import { getMobileUnits } from '@/actions/mobile-unit.actions'
import NewProjectForm from '@/components/mobile-units/NewProjectForm'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  const [companies, branches, units] = await Promise.all([
    getCompanies(),
    getBranches(),
    getMobileUnits(),
  ])

  return (
    <NewProjectForm
      units={units.map((u) => ({ id: u.id, name: u.name, plate: u.plate, status: u.status }))}
      companyOptions={companies.map((c) => ({ id: c.id, name: c.name }))}
      branchOptions={branches.map((b) => ({ id: b.id, name: b.name }))}
    />
  )
}
