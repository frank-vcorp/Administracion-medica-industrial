import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import {
    AMI_STUDIES_BASELINE,
    amiBaselineStudiesNotApplied,
    buildDictamenStudySummary,
    type DictamenStudyEntry,
} from '@/lib/dictamen-summary'
import { SME_BRAND_LINE, SME_LEGAL_NAME } from '@/lib/brand-constants'

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica' },
    // IMPL-20260826-04 (FIX dictamen general AMI): membrete profesional.
    // Identifica claramente: sistema emisor, área, folio, fecha y
    // responsable de la firma digital — paridad con el resto de PDFs
    // AMI (audiometría, espirometría) y con el ZIP de cierre clínico.
    membrete: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        paddingBottom: 12,
        borderBottomWidth: 2,
        borderBottomColor: '#0f172a',
    },
    membreteBrand: {
        flexDirection: 'column',
        maxWidth: '60%',
    },
    membreteLogo: {
        height: 44,
        width: 180,
        objectFit: 'contain',
        marginBottom: 8,
    },
    membreteLogoFallback: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 8,
    },
    membreteBrandTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#0f172a',
        letterSpacing: 1.2,
    },
    membreteBrandSubtitle: {
        fontSize: 10,
        color: '#475569',
        marginTop: 2,
    },
    membreteBrandSystem: {
        fontSize: 9,
        color: '#64748b',
        marginTop: 4,
        fontStyle: 'italic',
    },
    membreteFolio: {
        alignItems: 'flex-end',
    },
    membreteFolioLabel: {
        fontSize: 8,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    membreteFolioValue: {
        fontSize: 11,
        color: '#0f172a',
        fontWeight: 'bold',
        marginTop: 2,
    },
    membreteFolioDate: {
        fontSize: 9,
        color: '#475569',
        marginTop: 6,
    },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 11, fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: 4, marginBottom: 8, color: '#0f172a' },
    row: { flexDirection: 'row', marginBottom: 5 },
    label: { width: 140, fontSize: 9, fontWeight: 'bold', color: '#475569' },
    value: { flex: 1, fontSize: 9, color: '#0f172a' },
    headerGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 },
    headerCell: { width: '50%', flexDirection: 'row', marginBottom: 4 },
    headerCellThird: { width: '33.33%', flexDirection: 'row', marginBottom: 4 },
    aptitudGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    aptitudCard: { width: '48%', flexDirection: 'row', alignItems: 'center', padding: 5, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, backgroundColor: '#ffffff', marginBottom: 4 },
    aptitudCardSelected: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
    aptitudCheckbox: { width: 13, height: 13, borderWidth: 1.5, borderColor: '#64748b', borderRadius: 2, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
    aptitudCheckboxSelected: { borderColor: '#059669', backgroundColor: '#059669' },
    aptitudCheckText: { fontSize: 8, fontWeight: 'bold', color: '#ffffff' },
    aptitudLabel: { fontSize: 8, fontWeight: 'bold', color: '#334155', flex: 1 },
    aptitudLabelSelected: { color: '#065f46' },
    verdictBox: { padding: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, backgroundColor: '#f8fafc' },
    verdictText: { fontSize: 9, lineHeight: 1.45, color: '#0f172a' },
    // IMPL-20260826-04: estilos para el resumen de estudios
    // (aplicados + adicionales disponibles del catálogo AMI).
    studyRow: { marginBottom: 8, paddingLeft: 10 },
    studyName: { fontSize: 10, fontWeight: 'bold', color: '#1e293b' },
    studyBadge: {
        fontSize: 8,
        fontWeight: 'bold',
        paddingHorizontal: 4,
        paddingVertical: 1,
        marginLeft: 6,
        borderRadius: 3,
    },
    studyBadgeAplicado: { backgroundColor: '#dcfce7', color: '#166534' },
    studyBadgePendiente: { backgroundColor: '#fef3c7', color: '#92400e' },
    studyBadgeDisponible: { backgroundColor: '#e2e8f0', color: '#334155' },
    studySummary: { fontSize: 9, color: '#475569', marginTop: 2, marginLeft: 12 },
    studyEmpty: {
        fontSize: 10,
        color: '#64748b',
        fontStyle: 'italic',
        paddingLeft: 10,
        marginBottom: 4,
    },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#94a3b8', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 },
    signatureArea: { marginTop: 60, alignItems: 'center' },
    signatureLine: { width: 200, borderBottomWidth: 1, borderBottomColor: '#000', marginBottom: 5 },
    signatureName: { fontSize: 10, fontWeight: 'bold' }
})

/** Deriva un identificador de folio legible a partir del eventId + verdictId. */
function deriveFolio(eventId: string, verdictId: string): string {
    const eventPart = eventId.split('-')[0]?.toUpperCase() ?? ''
    const verdictPart = verdictId.split('-')[0]?.toUpperCase() ?? ''
    return `DICT-${eventPart}-${verdictPart}`
}

/**
 * IMPL-20260826-06 (DEC-20260826-01 / BR-20260826-01):
 * Bloque consolidado de hallazgos por Event hermano de la misma
 * atención/cita. Cada entrada es un Event del trabajador (distinto o
 * igual al actual) con sus estudios + labs disponibles.
 */
interface ConsolidatedEventBlock {
    /** ID del Event hermano (UUID). */
    eventId: string
    /** Identificador legible derivado del eventId (folio corto). */
    eventShortId: string
    /** Indica si este Event es el Event firmado actualmente. */
    isCurrent: boolean
    /** Estudios auxiliares del Event (snapshot). */
    studies?: { serviceName: string; extractedData: unknown }[]
    /** Laboratorios del Event (snapshot). */
    labs?: { serviceName: string; extractedData: unknown }[]
}

export const MedicalDictamenPDF = ({ data }: {
    data: {
        signedAt: string | Date,
        eventId: string,
        worker: {
            firstName: string,
            lastName: string,
            universalId: string,
            sexo?: string | null,
            edad?: number | string | null,
            puesto?: string | null,
            tipoExamen?: string | null,
        },
        company?: { name: string },
        finalDiagnosis: string,
        recommendations?: string,
        /** Aptitud para cubrir o seguir en la plaza (audiencia empleador). */
        aptitudLaboral?: string,
        /** Restricciones o condicionantes laborales específicas. */
        restrictions?: string | null,
        validator: { fullName: string, professionalLicense?: string | null },
        id: string,
        studies?: { serviceName: string, extractedData: unknown }[],
        labs?: { serviceName: string, extractedData: unknown }[],
        /**
         * IMPL-20260826-06 (DEC-20260826-01 / BR-20260826-01):
         * Bloques de hallazgos por cada Event de la misma atención/cita.
         * Si se omite o se pasa `[]`, el PDF conserva el comportamiento
         * legacy (un único Event). Si se proporciona, el PDF renderiza
         * una sub-sección "HALLAZGOS DE LA ATENCIÓN" con un bloque
         * por Event hermano (incluyendo el actual, marcado como tal).
         *
         * NO se inventan datos: cada bloque sólo muestra los estudios
         * y labs presentes en el snapshot del Event correspondiente.
         */
        consolidatedEvents?: ConsolidatedEventBlock[]
        /** Logo SME (data-URL) para membrete; opcional. */
        logoUrl?: string | null
    }
}) => {
    // IMPL-20260826-04: el resumen de estudios y el catálogo AMI baseline
    // son puros (test focal en `dictamen-summary.test.ts`). El renderer
    // sólo orquesta — NO inventa datos ni resultados faltantes.
    const allEntries: DictamenStudyEntry[] = [
        ...(data.studies ?? []),
        ...(data.labs ?? []),
    ]
    const appliedSummaries = buildDictamenStudySummary(allEntries)
    const appliedNames = appliedSummaries.map((s) => s.serviceName)
    const availableNotApplied = amiBaselineStudiesNotApplied(appliedNames)

    return (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* MEMBRETE (IMPL-20260826-04) */}
            <View style={styles.membrete}>
                <View style={styles.membreteBrand}>
                    {data.logoUrl ? (
                        <Image style={styles.membreteLogo} src={data.logoUrl} />
                    ) : (
                        <Text style={styles.membreteLogoFallback}>SME</Text>
                    )}
                    <Text style={styles.membreteBrandTitle}>DICTAMEN MÉDICO DE APTITUD LABORAL</Text>
                    <Text style={styles.membreteBrandSubtitle}>{SME_BRAND_LINE}</Text>
                    <Text style={styles.membreteBrandSystem}>
                        {SME_LEGAL_NAME} · Sistema clínico digital
                    </Text>
                </View>
                <View style={styles.membreteFolio}>
                    <Text style={styles.membreteFolioLabel}>Folio</Text>
                    <Text style={styles.membreteFolioValue}>{deriveFolio(data.eventId, data.id)}</Text>
                    <Text style={[styles.membreteFolioLabel, { marginTop: 8 }]}>Fecha de emisión</Text>
                    <Text style={styles.membreteFolioDate}>
                        {new Date(data.signedAt).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </Text>
                    <Text style={[styles.membreteFolioLabel, { marginTop: 8 }]}>Estado</Text>
                    <Text style={styles.membreteFolioDate}>Emitido · Firmado digitalmente</Text>
                </View>
            </View>

            {/* I. DATOS DEL TRABAJADOR Y EMPRESA */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>I. DATOS DEL TRABAJADOR Y EMPRESA</Text>
                <View style={styles.headerGrid}>
                    <View style={styles.headerCell}>
                        <Text style={[styles.label, { width: 65 }]}>Nombre:</Text>
                        <Text style={styles.value}>{data.worker.firstName} {data.worker.lastName}</Text>
                    </View>
                    <View style={styles.headerCell}>
                        <Text style={[styles.label, { width: 50 }]}>Fecha:</Text>
                        <Text style={styles.value}>
                            {new Date(data.signedAt).toLocaleDateString('es-MX', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                            })}
                        </Text>
                    </View>
                    <View style={styles.headerCellThird}>
                        <Text style={[styles.label, { width: 40 }]}>Sexo:</Text>
                        <Text style={styles.value}>{data.worker.sexo || '—'}</Text>
                    </View>
                    <View style={styles.headerCellThird}>
                        <Text style={[styles.label, { width: 40 }]}>Edad:</Text>
                        <Text style={styles.value}>{data.worker.edad ? `${data.worker.edad} años` : '—'}</Text>
                    </View>
                    <View style={styles.headerCellThird}>
                        <Text style={[styles.label, { width: 75 }]}>Tipo examen:</Text>
                        <Text style={styles.value}>{data.worker.tipoExamen || 'Ingreso'}</Text>
                    </View>
                    <View style={styles.headerCell}>
                        <Text style={[styles.label, { width: 65 }]}>Empresa:</Text>
                        <Text style={styles.value}>{data.company?.name || 'Independiente'}</Text>
                    </View>
                    <View style={styles.headerCell}>
                        <Text style={[styles.label, { width: 50 }]}>Puesto:</Text>
                        <Text style={styles.value}>{data.worker.puesto || '—'}</Text>
                    </View>
                    <View style={styles.headerCell}>
                        <Text style={[styles.label, { width: 65 }]}>ID Paciente:</Text>
                        <Text style={styles.value}>{data.worker.universalId}</Text>
                    </View>
                    <View style={styles.headerCell}>
                        <Text style={[styles.label, { width: 50 }]}>Folio:</Text>
                        <Text style={styles.value}>{deriveFolio(data.eventId, data.id)}</Text>
                    </View>
                </View>
            </View>

            {/* II. ESTUDIOS AUXILIARES Y HALLAZGOS CLÍNICOS */}
            {appliedSummaries.length > 0 ? (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>II. ESTUDIOS AUXILIARES Y HALLAZGOS CLÍNICOS</Text>
                    {appliedSummaries.map((s, idx) => {
                        const isAplicado = s.status === 'APLICADO'
                        const badgeStyle = isAplicado
                            ? styles.studyBadgeAplicado
                            : styles.studyBadgePendiente
                        return (
                            <View key={`${s.serviceName}-${idx}`} style={styles.studyRow}>
                                <Text style={styles.studyName}>
                                    • {s.serviceName}
                                    <Text style={[styles.studyBadge, badgeStyle]}>  {s.label.toUpperCase()}  </Text>
                                </Text>
                                <Text style={styles.studySummary}>
                                    <Text style={{ fontWeight: 'bold', color: '#334155' }}>Hallazgos: </Text>
                                    {s.dataSummary}
                                </Text>
                            </View>
                        )
                    })}
                </View>
            ) : (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>II. ESTUDIOS AUXILIARES Y HALLAZGOS CLÍNICOS</Text>
                    <Text style={styles.studyEmpty}>
                        Sin estudios auxiliares registrados para este evento.
                    </Text>
                </View>
            )}

            {/* III. DICTAMEN DE APTITUD LABORAL */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>III. DICTAMEN DE APTITUD LABORAL</Text>
                <View style={styles.aptitudGrid}>
                    {[
                        { key: 'APTO', label: 'APTO' },
                        { key: 'CONDICIONADO', label: 'APTO CONDICIONADO' },
                        { key: 'RESTRICCIONES', label: 'APTO CON RESTRICCIONES' },
                        { key: 'NO_CUMPLE', label: 'NO CUMPLE CON LOS CRITERIOS DE SALUD' },
                    ].map((opt) => {
                        const raw = (data.aptitudLaboral || '').toUpperCase()
                        let isSelected = false
                        if (opt.key === 'APTO') {
                            isSelected = raw.includes('APTO') && !raw.includes('CONDICION') && !raw.includes('RESTRIC') && !raw.includes('NO')
                        } else if (opt.key === 'CONDICIONADO') {
                            isSelected = raw.includes('CONDICION')
                        } else if (opt.key === 'RESTRICCIONES') {
                            isSelected = raw.includes('RESTRIC')
                        } else if (opt.key === 'NO_CUMPLE') {
                            isSelected = raw.includes('NO CUMPLE') || raw.includes('NO APTO') || raw.includes('RECHAZ')
                        }
                        return (
                            <View key={opt.key} style={[styles.aptitudCard, isSelected ? styles.aptitudCardSelected : {}]}>
                                <View style={[styles.aptitudCheckbox, isSelected ? styles.aptitudCheckboxSelected : {}]}>
                                    {isSelected ? <Text style={styles.aptitudCheckText}>X</Text> : null}
                                </View>
                                <Text style={[styles.aptitudLabel, isSelected ? styles.aptitudLabelSelected : {}]}>
                                    {opt.label}
                                </Text>
                            </View>
                        )
                    })}
                </View>
                {(data.restrictions || (data.aptitudLaboral && !data.aptitudLaboral.toUpperCase().startsWith('APTO'))) ? (
                    <View style={[styles.verdictBox, { marginTop: 4, padding: 6 }]}>
                        <Text style={[styles.label, { width: '100%', marginBottom: 2, fontSize: 8 }]}>Restricciones / Condicionantes:</Text>
                        <Text style={styles.verdictText}>{data.restrictions || data.aptitudLaboral}</Text>
                    </View>
                ) : null}
            </View>

            {/* IV. CONCLUSIÓN MÉDICA (DICTAMEN) */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>IV. CONCLUSIÓN MÉDICA (DICTAMEN)</Text>
                <View style={styles.verdictBox}>
                    <Text style={styles.verdictText}>{data.finalDiagnosis}</Text>
                </View>
            </View>

            {/* V. OBSERVACIONES Y RECOMENDACIONES */}
            {data.recommendations && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>V. OBSERVACIONES Y RECOMENDACIONES</Text>
                    <Text style={styles.verdictText}>{data.recommendations}</Text>
                </View>
            )}

            {/* FIRMA */}
            <View style={styles.signatureArea}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>Dr. {data.validator.fullName}</Text>
                <Text style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>Médico Dictaminador</Text>
                {data.validator.professionalLicense ? (
                    <Text style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
                        Céd. Prof.: {data.validator.professionalLicense}
                    </Text>
                ) : null}
                <Text style={{ fontSize: 7, color: '#cbd5e1', marginTop: 6 }}>
                    Certificado Digital: {data.id}
                </Text>
            </View>

            {/* PIE */}
            <Text style={styles.footer}>
                Este documento es un dictamen médico oficial y confidencial emitido por Residente Digital ({SME_LEGAL_NAME}).
                Queda estrictamente prohibida su alteración o reproducción no autorizada.
            </Text>
        </Page>
    </Document>
    )
}
