/**
 * @summary ARCH-20260326-02: integra el historial longitudinal en la ficha del trabajador.
 * @summary ARCH-20260808-05: rediseño moderado — botones funcionales, paleta slate coherente,
 *          TODO `branch-matriz (TODO: Populate)` resuelto vía `getWorkerById` aditivo, split
 *          server/client con WorkerDetailClient.
 * @backup context/SPECs/SPEC_ARCH-20260808-05-REDESIGN-FICHA-WORKER.md
 * @backup context/SPECs/SPEC_ARCH-20260325-07-PRELLENADO-LONGITUDINAL-DUAL.md
 * @intervention ARCH-20260326-10
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 */
import { getWorkerById } from '@/services/worker.service'
import { getWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { getCompanies } from '@/actions/admin.actions'
import { getMedicalProfileOptions } from '@/actions/medical-profiles'
import { notFound } from 'next/navigation'
import WorkerDetailClient, {
    type SerializedWorker,
    type HistoryPayload,
} from './WorkerDetailClient'

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const worker = await getWorkerById(id)

    if (!worker) {
        notFound()
    }

    const [historyResult, companies, medicalProfiles] = await Promise.all([
        getWorkerClinicalHistory(id),
        getCompanies(),
        getMedicalProfileOptions(),
    ])

    // Serialización Date → ISO string para cruzar el server/client boundary.
    // Evita `any`: tipo explícito SerializedWorker.
    const serialized: SerializedWorker = {
        id: worker.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        universalId: worker.universalId,
        email: worker.email,
        phone: worker.phone,
        nationalId: worker.nationalId,
        dob: worker.dob ? worker.dob.toISOString() : null,
        companyId: worker.companyId,
        medicalProfileId: worker.medicalProfileId,
        company: worker.company ? { id: worker.company.id, name: worker.company.name } : null,
        lastIdentityDocumentType: worker.lastIdentityDocumentType,
        lastIdentityFrontFileUrl: worker.lastIdentityFrontFileUrl,
        lastIdentityBackFileUrl: worker.lastIdentityBackFileUrl,
        lastIdentityVerifiedAt: worker.lastIdentityVerifiedAt
            ? worker.lastIdentityVerifiedAt.toISOString()
            : null,
        medicalHistory: worker.medicalHistory.map((e) => ({
            id: e.id,
            status: e.status,
            updatedAt: e.updatedAt.toISOString(),
            branchId: e.branchId,
            branch: e.branch ? { id: e.branch.id, name: e.branch.name } : null,
        })),
    }

    const companyOptions = companies.map((c: { id: string; name: string; email?: string | null; phone?: string | null; rfc?: string | null }) => ({
        id: c.id,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        rfc: c.rfc ?? null,
    }))
    const medicalProfileOptions = medicalProfiles.map((p: { id: string; name: string; companyId: string | null }) => ({
        id: p.id,
        name: p.name,
        companyId: p.companyId,
    }))

    const historyPayload: HistoryPayload = {
        success: historyResult.success,
        data: historyResult.success
            ? (historyResult.data
                ? { data: historyResult.data.data as Record<string, unknown> }
                : null)
            : null,
        error: historyResult.success ? undefined : (historyResult as { error?: string }).error,
    }

    return (
        <WorkerDetailClient
            worker={serialized}
            historyResult={historyPayload}
            companies={companyOptions}
            medicalProfiles={medicalProfileOptions}
        />
    )
}
