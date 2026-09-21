export const dynamic = 'force-dynamic'

import prisma from '@/lib/prisma'
import ValidationQueueTable, {
  type ValidationQueueRow,
} from '@/components/validation/ValidationQueueTable'
import {
  EVENT_COMPLETENESS_BADGE,
  EVENT_COMPLETENESS_LABELS,
  getEventCompletenessFromSteps,
} from '@/lib/clinical/event-completeness'
import type { EventTestPipelineStatus } from '@/lib/clinical/study-status-display'
import { buildNotPerformedTestIdSet } from '@/lib/clinical/reception-checkout'
import {
  getValidationStage,
  VALIDATION_STAGE_BADGE,
  VALIDATION_STAGE_LABELS,
  type ValidationStage,
} from '@/lib/clinical/validation-stage'

async function getValidationQueue() {
  return prisma.medicalEvent.findMany({
    where: {
      dischargedAt: { not: null },
      status: { notIn: ['COMPLETED', 'CANCELED'] },
    },
    include: {
      worker: {
        include: { company: true },
      },
      eventTests: {
        select: {
          id: true,
          testNameSnapshot: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { dischargedAt: 'desc' },
    take: 200,
  })
}

function toValidationRows(
  events: Awaited<ReturnType<typeof getValidationQueue>>,
  incidencesByEvent: Map<string, Set<string>>,
): ValidationQueueRow[] {
  return events
    .map((event) => {
      const notPerformedIds = incidencesByEvent.get(event.id) ?? new Set<string>()
      const eventTests = event.eventTests.map((test) => ({
        id: test.id,
        status: test.status as EventTestPipelineStatus,
      }))
      const stage = getValidationStage(eventTests, notPerformedIds)
      const completeness = getEventCompletenessFromSteps(eventTests, notPerformedIds)
      const sortDate = (event.dischargedAt ?? event.checkInDate ?? event.updatedAt).toISOString()

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
        stage,
        stageLabel: VALIDATION_STAGE_LABELS[stage],
        stageBadgeClass: VALIDATION_STAGE_BADGE[stage],
        completeness,
        completenessLabel: EVENT_COMPLETENESS_LABELS[completeness],
        completenessBadgeClass: EVENT_COMPLETENESS_BADGE[completeness],
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

function countByStage(rows: ValidationQueueRow[]): Record<ValidationStage, number> {
  return rows.reduce(
    (acc, row) => {
      acc[row.stage] += 1
      return acc
    },
    { V1: 0, V2: 0, V3: 0 } as Record<ValidationStage, number>,
  )
}

export default async function ValidationPage() {
  const events = await getValidationQueue()
  const eventIds = events.map((e) => e.id)

  const timelineEntries =
    eventIds.length === 0
      ? []
      : await prisma.papeletaTimelineEntry.findMany({
          where: {
            eventId: { in: eventIds },
            eventTestId: { not: null },
            entryType: { in: ['ADMIN_INCIDENCE', 'STUDY_NOT_PERFORMED'] },
          },
          select: { eventId: true, eventTestId: true, entryType: true },
        })

  const incidencesByEvent = new Map<string, Set<string>>()
  for (const entry of timelineEntries) {
    if (!entry.eventTestId) continue
    const set = incidencesByEvent.get(entry.eventId) ?? new Set<string>()
    for (const id of buildNotPerformedTestIdSet([entry])) {
      set.add(id)
    }
    incidencesByEvent.set(entry.eventId, set)
  }

  const rows = toValidationRows(events, incidencesByEvent)
  const companies = extractCompanies(rows)
  const stageCounts = countByStage(rows)

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Validación diagnóstica
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Cierre clínico post-checkout — resultados, diagnóstico y dictamen.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-slate-600">
            En cola: <strong className="text-slate-900">{rows.length}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['V1', 'V2', 'V3'] as ValidationStage[]).map((stage) => (
          <div
            key={stage}
            className={`rounded-2xl border p-4 ${VALIDATION_STAGE_BADGE[stage]}`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
              {stage}
            </p>
            <p className="mt-1 text-sm font-bold">{VALIDATION_STAGE_LABELS[stage]}</p>
            <p className="mt-2 text-2xl font-black">{stageCounts[stage]}</p>
          </div>
        ))}
      </div>

      <ValidationQueueTable rows={rows} companies={companies} />
    </div>
  )
}
