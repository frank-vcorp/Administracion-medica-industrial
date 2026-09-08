export const dynamic = 'force-dynamic'

import prisma from '@/lib/prisma'
import ValidationQueueTable, {
  type ValidationQueueRow,
} from '@/components/validation/ValidationQueueTable'
import {
  getEventCompleteness,
  getEventCompletenessBadgeClass,
  getEventCompletenessLabel,
} from '@/lib/clinical/event-completeness'
import type { EventTestPipelineStatus } from '@/lib/clinical/study-status-display'

async function getValidationQueue() {
  return prisma.medicalEvent.findMany({
    where: { status: 'VALIDATING' },
    include: {
      worker: {
        include: { company: true },
      },
      eventTests: {
        select: {
          testNameSnapshot: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

function toValidationRows(
  events: Awaited<ReturnType<typeof getValidationQueue>>,
): ValidationQueueRow[] {
  return events
    .map((event) => {
      const eventTests = event.eventTests.map((test) => ({
        status: test.status as EventTestPipelineStatus,
      }))
      const sortDate = (event.checkInDate ?? event.updatedAt ?? event.createdAt).toISOString()

      return {
        eventId: event.id,
        sortDate,
        patientName: `${event.worker.firstName} ${event.worker.lastName}`,
        universalId: event.worker.universalId,
        companyId: event.worker.companyId,
        companyName: event.worker.company?.name ?? '—',
        studies:
          event.eventTests.length > 0
            ? event.eventTests.map((test) => test.testNameSnapshot)
            : ['Sin estudios'],
        completeness: getEventCompleteness(eventTests),
        completenessLabel: getEventCompletenessLabel(eventTests),
        completenessBadgeClass: getEventCompletenessBadgeClass(eventTests),
        phone: event.worker.phone,
      }
    })
    .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
}

function extractCompanies(rows: ValidationQueueRow[]) {
  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.companyId) {
      map.set(row.companyId, row.companyName)
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export default async function ValidationPage() {
  const events = await getValidationQueue()
  const rows = toValidationRows(events)
  const companies = extractCompanies(rows)

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Validación diagnóstica
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Revisión, diagnóstico y firma digital de expedientes.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-slate-600">
            En cola: <strong className="text-slate-900">{rows.length}</strong>
          </span>
        </div>
      </div>

      <ValidationQueueTable rows={rows} companies={companies} />
    </div>
  )
}
