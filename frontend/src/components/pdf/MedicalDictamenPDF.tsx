import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 10 },
    headerText: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    subHeader: { fontSize: 10, color: '#64748b' },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: 5, marginBottom: 10, color: '#0f172a' },
    row: { flexDirection: 'row', marginBottom: 5 },
    label: { width: 140, fontSize: 10, fontWeight: 'bold', color: '#475569' },
    value: { flex: 1, fontSize: 10, color: '#0f172a' },
    verdictBox: { padding: 15, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 5, backgroundColor: '#f8fafc' },
    verdictText: { fontSize: 11, lineHeight: 1.5, color: '#0f172a' },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#94a3b8', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 },
    signatureArea: { marginTop: 60, alignItems: 'center' },
    signatureLine: { width: 200, borderBottomWidth: 1, borderBottomColor: '#000', marginBottom: 5 },
    signatureName: { fontSize: 10, fontWeight: 'bold' }
})

export const MedicalDictamenPDF = ({ data }: {
    data: {
        signedAt: string | Date,
        eventId: string,
        worker: { firstName: string, lastName: string, universalId: string },
        company?: { name: string },
        finalDiagnosis: string,
        recommendations?: string,
        validator: { fullName: string },
        id: string
    }
}) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* HEADER */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerText}>DICTAMEN MÉDICO</Text>
                    <Text style={styles.subHeader}>Administración Médica Industrial (AMI)</Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={styles.subHeader}>Fecha: {new Date(data.signedAt).toLocaleDateString()}</Text>
                    <Text style={styles.subHeader}>Folio: {data.eventId.split('-')[0].toUpperCase()}</Text>
                </View>
            </View>

            {/* WORKER DATA */}
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
            </View>

            {/* FINAL VERDICT */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>II. CONCLUSIÓN MÉDICA (DICTAMEN)</Text>
                <View style={styles.verdictBox}>
                    <Text style={styles.verdictText}>{data.finalDiagnosis}</Text>
                </View>
            </View>

            {/* RECOMMENDATIONS */}
            {data.recommendations && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>III. RECOMENDACIONES Y SEGUIMIENTO</Text>
                    <Text style={styles.verdictText}>{data.recommendations}</Text>
                </View>
            )}

            {/* SIGNATURE */}
            <View style={styles.signatureArea}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>Dr. {data.validator.fullName}</Text>
                <Text style={{ fontSize: 9, color: '#64748b' }}>Médico Dictaminador</Text>
                <Text style={{ fontSize: 7, color: '#cbd5e1', marginTop: 8 }}>
                    Certificado Digital: {data.id}
                </Text>
            </View>

            {/* FOOTER */}
            <Text style={styles.footer}>
                Este documento es un dictamen médico oficial y confidencial emitido por Residente Digital (Sistema AMI).
                Queda estrictamente prohibida su alteración o reproducción no autorizada.
            </Text>
        </Page>
    </Document>
)
