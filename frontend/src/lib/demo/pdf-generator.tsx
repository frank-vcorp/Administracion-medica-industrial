'use client';

// Generador de PDF para el demo de reportes masivos UMM.
// Usa @react-pdf/renderer (ya en package.json). Produce:
// - Página 1: Portada "Diagnóstico Situacional"
// - Páginas 2+: Concentrado tabular

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

import type { DemoProject, DemoWorker } from './demo-types';
import {
  calcularDistribuciones,
  calcularEspirometriaDistribucion,
  calcularEscoliosisDistribucion,
  calcularHbcPorRango,
  calcularTraumaAcusticoPorArea,
} from './demo-conteos';

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#0f172a' },
  // Portada
  portadaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#1e293b',
    paddingBottom: 12,
    marginBottom: 24,
  },
  portadaTitulo: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  portadaSubtitulo: { fontSize: 10, color: '#64748b', marginTop: 4 },
  portadaFecha: { fontSize: 10, color: '#475569', textAlign: 'right' },
  portadaSeccion: { marginBottom: 18 },
  portadaSeccionTitulo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    padding: 6,
    marginBottom: 8,
  },
  portadaRow: { flexDirection: 'row', marginBottom: 4 },
  portadaBullet: { width: 12, fontSize: 10 },
  portadaTexto: { flex: 1, fontSize: 10, color: '#1e293b' },
  portadaLabel: { width: 90, fontSize: 10, fontWeight: 'bold', color: '#334155' },
  portadaGrid: { flexDirection: 'row', gap: 8 },
  portadaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#f8fafc',
  },
  portadaCardNumero: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  portadaCardLabel: { fontSize: 8, color: '#475569', marginTop: 2 },
  // Tabla concentrado
  tablaTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 4,
  },
  tablaHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 8,
  },
  tablaHeaderCell: {
    padding: 4,
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 7,
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  tablaFila: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tablaFilaAlt: { backgroundColor: '#f8fafc' },
  tablaCell: { padding: 3, fontSize: 7, borderRightWidth: 1, borderRightColor: '#e2e8f0' },
  tablaCellBold: { fontWeight: 'bold', fontSize: 7 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
});

// Definición de columnas para la tabla concentrado (ancho en puntos).
const COLUMNAS: { key: string; label: string; width: number }[] = [
  { key: 'folio', label: 'FOLIO', width: 35 },
  { key: 'nombre', label: 'NOMBRE', width: 95 },
  { key: 'sexo', label: 'SEXO', width: 38 },
  { key: 'area', label: 'AREA', width: 55 },
  { key: 'antiguedad', label: 'ANTIG.', width: 45 },
  { key: 'agudezaVisual', label: 'AG. VISUAL', width: 60 },
  { key: 'dx', label: 'DX AUDIO', width: 50 },
  { key: 'hbc', label: '% HBC', width: 30 },
  { key: 'espirometria', label: 'ESPIRO', width: 50 },
  { key: 'tabaquismo', label: 'TAB.', width: 35 },
  { key: 'escoliosis', label: 'ESCOL.', width: 30 },
  { key: 'lordosis', label: 'LORD.', width: 30 },
  { key: 'basculacion', label: 'BASC.', width: 30 },
  { key: 'ecg', label: 'ECG', width: 65 },
];

function filaAplanada(w: DemoWorker): Record<string, string> {
  return {
    folio: w.folio,
    nombre: w.nombre,
    sexo: w.sexo === 'MASCULINO' ? 'M' : 'F',
    area: w.area,
    antiguedad: w.antiguedad,
    agudezaVisual: w.campimetria.agudezaVisual,
    dx: w.audiometria.dx,
    hbc: w.audiometria.hbc !== null ? String(w.audiometria.hbc) : 'N/A',
    espirometria: w.espirometria.patron,
    tabaquismo: w.espirometria.tabaquismo,
    escoliosis: w.rxColumna.escoliosis !== null ? `${w.rxColumna.escoliosis}°` : 'N/A',
    lordosis: w.rxColumna.lordosis !== null ? `${w.rxColumna.lordosis}°` : 'N/A',
    basculacion:
      w.rxColumna.basculacion !== null ? `${w.rxColumna.basculacion} cm` : 'N/A',
    ecg: w.ecg.impresion,
  };
}

function Portada({ project }: { project: DemoProject }) {
  const dist = calcularDistribuciones(project);
  const hbc = calcularHbcPorRango(project);
  const espiro = calcularEspirometriaDistribucion(project);
  const escolio = calcularEscoliosisDistribucion(project);
  const trauma = calcularTraumaAcusticoPorArea(project);

  const examenMedico = project.trabajadores.length;
  const audiometrias = project.trabajadores.filter(
    (w) => w.audiometria.dx !== 'N/A',
  ).length;
  const espirometrias = project.trabajadores.filter(
    (w) => w.espirometria.patron !== 'N/A',
  ).length;
  const rxColumna = project.trabajadores.filter(
    (w) => w.rxColumna.impresion !== 'N/A',
  ).length;
  const rxColumnaNa = project.trabajadores.length - rxColumna;
  const laboratorios = project.trabajadores.length;

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.portadaHeader}>
        <View>
          <Text style={styles.portadaTitulo}>DIAGN&Oacute;STICO SITUACIONAL</Text>
          <Text style={styles.portadaSubtitulo}>
            M&oacute;dulo de Reportes Masivos UMM &mdash; Administraci&oacute;n M&eacute;dica Industrial
          </Text>
        </View>
        <View>
          <Text style={styles.portadaFecha}>Fecha: {project.fecha}</Text>
          <Text style={styles.portadaFecha}>Demo navegable</Text>
        </View>
      </View>

      <View style={styles.portadaSeccion}>
        <Text style={styles.portadaSeccionTitulo}>DATOS DE LA EMPRESA</Text>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaLabel}>Empresa:</Text>
          <Text style={styles.portadaTexto}>{project.empresa}</Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaLabel}>Raz&oacute;n social:</Text>
          <Text style={styles.portadaTexto}>{project.empresaLegal}</Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaLabel}>Trabajadores evaluados:</Text>
          <Text style={styles.portadaTexto}>{project.trabajadores.length}</Text>
        </View>
      </View>

      <View style={styles.portadaSeccion}>
        <Text style={styles.portadaSeccionTitulo}>CONTEOS POR ESTUDIO</Text>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>{examenMedico} Examen M&eacute;dico</Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>{audiometrias} Audiometr&iacute;as</Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>{espirometrias} Espirometr&iacute;as</Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>
            {rxColumna} Radiograf&iacute;as de Columna ({rxColumnaNa} N/A)
          </Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>{laboratorios} Laboratorios</Text>
        </View>
      </View>

      <View style={styles.portadaSeccion}>
        <Text style={styles.portadaSeccionTitulo}>PIR&Aacute;MIDE DE EDAD</Text>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>18-30 a&ntilde;os: {dist.edad18a30} trabajadores</Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>31-45 a&ntilde;os: {dist.edad31a45} trabajadores</Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>46+ a&ntilde;os: {dist.edad46mas} trabajadores</Text>
        </View>
      </View>

      <View style={styles.portadaSeccion}>
        <Text style={styles.portadaSeccionTitulo}>DISTRIBUCI&Oacute;N POR SEXO</Text>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>Masculino: {dist.masculino}</Text>
        </View>
        <View style={styles.portadaRow}>
          <Text style={styles.portadaBullet}>&bull;</Text>
          <Text style={styles.portadaTexto}>Femenino: {dist.femenino}</Text>
        </View>
      </View>

      <View style={styles.portadaSeccion}>
        <Text style={styles.portadaSeccionTitulo}>INDICADORES CLAVE</Text>
        <View style={styles.portadaGrid}>
          <View style={styles.portadaCard}>
            <Text style={styles.portadaCardNumero}>{hbc.normal}</Text>
            <Text style={styles.portadaCardLabel}>Audiometr&iacute;as Normales (%HBC &lt;10%)</Text>
          </View>
          <View style={styles.portadaCard}>
            <Text style={styles.portadaCardNumero}>{hbc.alto + hbc.muyAlto}</Text>
            <Text style={styles.portadaCardLabel}>Audiometr&iacute;as con HBC elevado</Text>
          </View>
          <View style={styles.portadaCard}>
            <Text style={styles.portadaCardNumero}>{escolio.normal}</Text>
            <Text style={styles.portadaCardLabel}>Escoliosis Normal</Text>
          </View>
          <View style={styles.portadaCard}>
            <Text style={styles.portadaCardNumero}>{escolio.leve + escolio.moderada + escolio.grave}</Text>
            <Text style={styles.portadaCardLabel}>Escoliosis alterada</Text>
          </View>
        </View>
      </View>

      <View style={styles.portadaSeccion}>
        <Text style={styles.portadaSeccionTitulo}>TRAUMA AC&Uacute;STICO POR &Aacute;REA</Text>
        {trauma.length === 0 ? (
          <Text style={styles.portadaTexto}>Sin casos de trauma ac&uacute;stico detectados.</Text>
        ) : (
          trauma.map((t) => (
            <View key={t.area} style={styles.portadaRow}>
              <Text style={styles.portadaBullet}>&bull;</Text>
              <Text style={styles.portadaTexto}>
                {t.area}: {t.conteo} caso{t.conteo === 1 ? '' : 's'}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.portadaSeccion}>
        <Text style={styles.portadaSeccionTitulo}>ESPIROMETR&Iacute;AS (PATR&Oacute;N)</Text>
        {espiro.map((e) => (
          <View key={e.patron} style={styles.portadaRow}>
            <Text style={styles.portadaBullet}>&bull;</Text>
            <Text style={styles.portadaTexto}>
              {e.patron}: {e.conteo}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
        `Portada · Página ${pageNumber} de ${totalPages} · DEMO AMI Reportes Masivos UMM`
      )} fixed />
    </Page>
  );
}

function TablaConcentrado({ project }: { project: DemoProject }) {
  const filas = project.trabajadores.map(filaAplanada);

  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.tablaTitulo}>
        CONCENTRADO GENERAL &mdash; {project.empresa}
      </Text>

      <View style={styles.tablaHeader} fixed>
        {COLUMNAS.map((c) => (
          <Text key={c.key} style={{ ...styles.tablaHeaderCell, width: c.width }}>
            {c.label}
          </Text>
        ))}
      </View>

      {filas.map((fila, idx) => (
        <View
          key={fila.folio}
          style={[styles.tablaFila, idx % 2 === 1 ? styles.tablaFilaAlt : {}]}
          wrap={false}
        >
          {COLUMNAS.map((c) => (
            <Text
              key={c.key}
              style={{
                ...styles.tablaCell,
                ...(c.key === 'folio' || c.key === 'nombre' ? styles.tablaCellBold : {}),
                width: c.width,
              }}
            >
              {fila[c.key]}
            </Text>
          ))}
        </View>
      ))}

      <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
        `Concentrado · Página ${pageNumber} de ${totalPages} · DEMO AMI Reportes Masivos UMM`
      )} fixed />
    </Page>
  );
}

/**
 * Componente Document del PDF.
 * Página 1: Portada "Diagnóstico Situacional".
 * Página 2 en adelante: Tabla concentrado (puede ocupar varias páginas).
 */
export function DemoReportPDF({ project }: { project: DemoProject }) {
  return (
    <Document
      title={`Reporte Masivo - ${project.empresa}`}
      author="AMI Demo"
      subject="Diagnóstico Situacional"
    >
      <Portada project={project} />
      <TablaConcentrado project={project} />
    </Document>
  );
}

/**
 * Genera el PDF en cliente y devuelve el ArrayBuffer.
 * Usa `pdf(<Doc>).toBuffer()` que es soportado en navegador.
 */
export async function generarPdf(project: DemoProject): Promise<ArrayBuffer> {
  const instance = pdf(<DemoReportPDF project={project} />);
  const blob = await instance.toBlob();
  return await blob.arrayBuffer();
}

/**
 * Convierte el ArrayBuffer del PDF a un data URI para descarga directa.
 */
export function pdfArrayBufferToDataUri(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  const base64 = btoa(binary);
  return `data:application/pdf;base64,${base64}`;
}
