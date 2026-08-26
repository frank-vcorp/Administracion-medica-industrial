import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
    AMI_STUDIES_BASELINE,
    amiBaselineStudiesNotApplied,
    buildDictamenStudySummary,
    type DictamenStudyEntry,
} from '@/lib/dictamen-summary'

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
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: 5, marginBottom: 10, color: '#0f172a' },
    row: { flexDirection: 'row', marginBottom: 5 },
    label: { width: 140, fontSize: 10, fontWeight: 'bold', color: '#475569' },
    value: { flex: 1, fontSize: 10, color: '#0f172a' },
    verdictBox: { padding: 15, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 5, backgroundColor: '#f8fafc' },
    verdictText: { fontSize: 11, lineHeight: 1.5, color: '#0f172a' },
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
        worker: { firstName: string, lastName: string, universalId: string },
        company?: { name: string },
        finalDiagnosis: string,
        recommendations?: string,
        validator: { fullName: string },
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
                    <Text style={styles.membreteBrandTitle}>DICTAMEN MÉDICO DE APTITUD LABORAL</Text>
                    <Text style={styles.membreteBrandSubtitle}>
                        Administración Médica Industrial (AMI)
                    </Text>
                    <Text style={styles.membreteBrandSystem}>
                        Sistema Residente Digital · Subsistema de Dictaminación
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
                <View style={styles.row}>
                    <Text style={styles.label}>Nombre Completo:</Text>
                    <Text style={styles.value}>{data.worker.firstName} {data.worker.lastName}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>ID de Paciente:</Text>
                    <Text style={styles.value}>{data.worker.universalId}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Empresa Contratante:</Text>
                    <Text style={styles.value}>{data.company?.name || 'Independiente'}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Folio del evento:</Text>
                    <Text style={styles.value}>{deriveFolio(data.eventId, data.id)}</Text>
                </View>
            </View>

            {/* II. ESTUDIOS AUXILIARES APLICADOS (IMPL-20260826-04) */}
            {appliedSummaries.length > 0 ? (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>II. ESTUDIOS AUXILIARES APLICADOS</Text>
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
                                <Text style={styles.studySummary}>{s.dataSummary}</Text>
                            </View>
                        )
                    })}
                </View>
            ) : (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>II. ESTUDIOS AUXILIARES APLICADOS</Text>
                    <Text style={styles.studyEmpty}>
                        Sin estudios auxiliares registrados para este evento.
                    </Text>
                </View>
            )}

            {/* III. ESTUDIOS ADICIONALES DISPONIBLES EN EL CATÁLOGO AMI
                (IMPL-20260826-04, BR-20260825-17). Lista los estudios del
                catálogo baseline NO aplicados a este evento. NO se
                incluyen datos del paciente, resultados ni hallazgos:
                sólo nombres de estudios disponibles en el dominio AMI. */}
            {availableNotApplied.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>III. ESTUDIOS ADICIONALES DISPONIBLES EN EL CATÁLOGO AMI</Text>
                    <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 6 }}>
                        Estudios del catálogo AMI no aplicados a este evento. Su inclusión en
                        futuros exámenes queda a criterio del médico dictaminador.
                    </Text>
                    {availableNotApplied.map((name) => (
                        <View key={name} style={styles.studyRow}>
                            <Text style={styles.studyName}>
                                • {name}
                                <Text style={[styles.studyBadge, styles.studyBadgeDisponible]}>  NO APLICADO  </Text>
                            </Text>
                            <Text style={styles.studySummary}>
                                Disponible en el catálogo AMI — no aplicado a este evento.
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* III.B HALLAZGOS CONSOLIDADOS POR ATENCIÓN/CITA
                (IMPL-20260826-06 / DEC-20260826-01 / BR-20260826-01).
                Una sub-sección por cada Event de la misma cita,
                mostrando los estudios aplicados (con badge
                APLICADO/PENDIENTE) y su resumen textual. NO inventa
                resultados: cada bloque sólo refleja el snapshot del
                Event correspondiente. Si `consolidatedEvents` está
                vacío o no se proporciona, esta sección se omite
                (comportamiento legacy intacto). */}
            {data.consolidatedEvents && data.consolidatedEvents.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>III.B HALLAZGOS CONSOLIDADOS POR ATENCIÓN/CITA</Text>
                    <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 6 }}>
                        Estudios auxiliares de los Events del trabajador ligados a la misma
                        cita. Sólo se muestran los datos disponibles en cada Event; los
                        faltantes aparecen como PENDIENTE sin inventar resultados.
                    </Text>
                    {data.consolidatedEvents.map((block) => {
                        const blockEntries: DictamenStudyEntry[] = [
                            ...(block.studies ?? []),
                            ...(block.labs ?? []),
                        ]
                        const blockSummaries =
                            buildDictamenStudySummary(blockEntries)
                        return (
                            <View key={block.eventId} style={{
                                marginBottom: 10,
                                paddingLeft: 10,
                                paddingTop: 4,
                                paddingBottom: 4,
                                borderLeftWidth: 2,
                                borderLeftColor: block.isCurrent ? '#0f172a' : '#cbd5e1',
                            }}>
                                <Text style={styles.studyName}>
                                    • Event {block.eventShortId}
                                    {block.isCurrent && (
                                        <Text style={[styles.studyBadge, styles.studyBadgeAplicado]}>  ACTUAL  </Text>
                                    )}
                                </Text>
                                {blockSummaries.length === 0 ? (
                                    <Text style={styles.studyEmpty}>
                                        Sin estudios auxiliares registrados para este Event.
                                    </Text>
                                ) : (
                                    blockSummaries.map((s, sIdx) => {
                                        const isAplicado = s.status === 'APLICADO'
                                        const badgeStyle = isAplicado
                                            ? styles.studyBadgeAplicado
                                            : styles.studyBadgePendiente
                                        return (
                                            <View
                                                key={`${block.eventId}-${s.serviceName}-${sIdx}`}
                                                style={styles.studyRow}
                                            >
                                                <Text style={styles.studyName}>
                                                    – {s.serviceName}
                                                    <Text style={[styles.studyBadge, badgeStyle]}>  {s.label.toUpperCase()}  </Text>
                                                </Text>
                                                <Text style={styles.studySummary}>
                                                    {s.dataSummary}
                                                </Text>
                                            </View>
                                        )
                                    })
                                )}
                            </View>
                        )
                    })}
                </View>
            )}

            {/* IV. CONCLUSIÓN MÉDICA (DICTAMEN) */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>IV. CONCLUSIÓN MÉDICA (DICTAMEN)</Text>
                <View style={styles.verdictBox}>
                    <Text style={styles.verdictText}>{data.finalDiagnosis}</Text>
                </View>
            </View>

            {/* V. RECOMENDACIONES Y SEGUIMIENTO */}
            {data.recommendations && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>V. RECOMENDACIONES Y SEGUIMIENTO</Text>
                    <Text style={styles.verdictText}>{data.recommendations}</Text>
                </View>
            )}

            {/* FIRMA */}
            <View style={styles.signatureArea}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>Dr. {data.validator.fullName}</Text>
                <Text style={{ fontSize: 9, color: '#64748b' }}>Médico Dictaminador</Text>
                <Text style={{ fontSize: 7, color: '#cbd5e1', marginTop: 8 }}>
                    Certificado Digital: {data.id}
                </Text>
            </View>

            {/* PIE */}
            <Text style={styles.footer}>
                Este documento es un dictamen médico oficial y confidencial emitido por Residente Digital (Sistema AMI).
                Queda estrictamente prohibida su alteración o reproducción no autorizada.
            </Text>
        </Page>
    </Document>
    )
}
