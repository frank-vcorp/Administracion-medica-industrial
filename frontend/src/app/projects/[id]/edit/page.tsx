import { notFound } from 'next/navigation'
import { getProject } from '@/actions/project.actions'
import { getMobileUnits } from '@/actions/mobile-unit.actions'
import EditProjectForm from '@/components/mobile-units/EditProjectForm'

export const dynamic = 'force-dynamic'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let project
  try {
    project = await getProject(id)
  } catch {
    notFound()
  }
  const units = await getMobileUnits()
  return (
    <EditProjectForm
      projectId={id}
      units={units.map((u) => ({ id: u.id, name: u.name, plate: u.plate, status: u.status }))}
      initial={{
        name: project.name,
        startDate: new Date(project.startDate).toISOString().slice(0, 10),
        endDate: new Date(project.endDate).toISOString().slice(0, 10),
        branchId: project.branchId ?? null,
        unitRef: project.unitRef ?? null,
        mobileUnitId: project.mobileUnitId ?? null,
        notes: project.notes ?? null,
      }}
    />
  )
}
