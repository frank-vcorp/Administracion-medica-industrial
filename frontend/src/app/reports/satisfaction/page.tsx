export const dynamic = 'force-dynamic'

import { getSatisfactionReport } from '@/actions/satisfaction.actions'
import SatisfactionReportClient from '@/components/reports/SatisfactionReportClient'
import prisma from '@/lib/prisma'

type Props = {
  searchParams: Promise<{
    from?: string
    to?: string
    companyId?: string
    branchId?: string
    channel?: string
  }>
}

export default async function SatisfactionReportPage({ searchParams }: Props) {
  const params = await searchParams
  const channel =
    params.channel === 'TABLET' ||
    params.channel === 'WHATSAPP_LINK' ||
    params.channel === 'DIRECT'
      ? params.channel
      : undefined

  const [report, companies, branches] = await Promise.all([
    getSatisfactionReport({
      from: params.from,
      to: params.to,
      companyId: params.companyId,
      branchId: params.branchId,
      channel,
    }),
    prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          Satisfacción del paciente
        </h2>
        <p className="text-sm text-slate-500 font-medium">
          Encuesta AMI — KPIs y detalle por visita.
        </p>
      </div>

      <SatisfactionReportClient
        initialReport={report}
        companies={companies}
        branches={branches}
        initialFilters={{
          from: params.from ?? '',
          to: params.to ?? '',
          companyId: params.companyId ?? '',
          branchId: params.branchId ?? '',
          channel: channel ?? '',
        }}
      />
    </div>
  )
}
