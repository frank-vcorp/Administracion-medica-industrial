/**
 * @fileoverview Plantilla PDF del recibo de pago (ARCH-20260630-01)
 * @id IMPL-20260630-01
 */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 12,
  },
  brand: { fontSize: 22, fontWeight: 'bold' },
  subBrand: { fontSize: 9, color: '#64748b', marginTop: 4 },
  meta: { alignItems: 'flex-end' },
  metaLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase' },
  metaValue: { fontSize: 11, fontWeight: 'bold', marginBottom: 6 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    padding: 6,
    marginBottom: 8,
    color: '#0f172a',
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', marginBottom: 5 },
  label: { width: 140, fontSize: 9, color: '#475569', fontWeight: 'bold' },
  value: { flex: 1, fontSize: 10 },
  amountBox: {
    marginTop: 18,
    marginBottom: 18,
    padding: 16,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#06b6d4',
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: { fontSize: 10, color: '#0e7490', fontWeight: 'bold' },
  amountValue: { fontSize: 26, fontWeight: 'bold', color: '#0e7490' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
})

export interface ReceiptPDFData {
  paymentId: string
  eventId: string
  createdAt: Date | string
  amount: number
  method: string
  reference: string | null
  worker: { firstName: string; lastName: string; universalId?: string | null }
  company: { name: string } | null
  branch?: { name: string } | null
  receivedBy: string
}

export const PaymentReceiptPDF = ({ data }: { data: ReceiptPDFData }) => {
  const created = new Date(data.createdAt)
  const formattedAmount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(data.amount)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>RECIBO DE PAGO</Text>
            <Text style={styles.subBrand}>
              Administración Médica Industrial (AMI)
            </Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Folio</Text>
            <Text style={styles.metaValue}>{data.paymentId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.metaLabel}>Fecha</Text>
            <Text style={styles.metaValue}>
              {created.toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: '2-digit',
              })}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={styles.sectionTitle}>DATOS DEL TRABAJADOR</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nombre:</Text>
            <Text style={styles.value}>
              {data.worker.firstName} {data.worker.lastName}
            </Text>
          </View>
          {data.worker.universalId && (
            <View style={styles.row}>
              <Text style={styles.label}>ID:</Text>
              <Text style={styles.value}>{data.worker.universalId}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Empresa:</Text>
            <Text style={styles.value}>{data.company?.name ?? '—'}</Text>
          </View>
          {data.branch && (
            <View style={styles.row}>
              <Text style={styles.label}>Sucursal:</Text>
              <Text style={styles.value}>{data.branch.name}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Papeleta (evento):</Text>
            <Text style={styles.value}>{data.eventId}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={styles.sectionTitle}>DETALLE DEL PAGO</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Método de pago:</Text>
            <Text style={styles.value}>{data.method}</Text>
          </View>
          {data.reference && (
            <View style={styles.row}>
              <Text style={styles.label}>Referencia / Nota:</Text>
              <Text style={styles.value}>{data.reference}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Recibido por:</Text>
            <Text style={styles.value}>{data.receivedBy}</Text>
          </View>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>MONTO TOTAL</Text>
          <Text style={styles.amountValue}>{formattedAmount}</Text>
        </View>

        <Text style={styles.footer}>
          Este documento es un comprobante interno de pago emitido por AMI.
          Para factura, contacte a su ejecutivo de cuenta en un plazo máximo de 72 horas.
        </Text>
      </Page>
    </Document>
  )
}