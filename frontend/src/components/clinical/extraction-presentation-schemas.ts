/**
 * @fileoverview Esquemas de presentación clínica por tipo de estudio.
 * Configura cómo se mapea extractedData hacia secciones legibles para médico.
 * @id IMPL-20260518-13
 * @backup context/checkpoints/CHK_IMPL-20260518-13-RENDERER-CLINICO.md
 */

// --- Tipos de secciones ---

export type KeyValueSection = {
  kind: "keyValue"
  title: string
  /** Claves a leer del objeto raíz o del subobjeto indicado por sourceKey */
  fields: string[]
  /** Si se especifica, se busca primero en extractedData[sourceKey] */
  sourceKey?: string
}

export type TableSection = {
  kind: "table"
  title: string
  /** Clave en extractedData que contiene el array de objetos-fila */
  source: string
  /** Columnas: key = campo en cada fila, label = cabecera visual */
  columns: { key: string; label: string }[]
}

export type BadgesSection = {
  kind: "badges"
  title: string
  fields: string[]
  sourceKey?: string
}

export type NoteSection = {
  kind: "note"
  title: string
  /** Campo de texto plano en extractedData */
  source: string
}

export type ClinicalPresentationSection =
  | KeyValueSection
  | TableSection
  | BadgesSection
  | NoteSection

export type StudyPresentationSchema = {
  studyType: string
  sections: ClinicalPresentationSection[]
}

// --- Configuración: Espirometría ---

const espirometriaSchema: StudyPresentationSchema = {
  studyType: "Espirometria",
  sections: [
    {
      kind: "keyValue",
      title: "Resumen principal",
      fields: ["fvc", "fev1", "fev1_fvc", "fvc_pct_pred", "fev1_pct_pred"],
    },
    {
      kind: "keyValue",
      title: "Datos del paciente",
      sourceKey: "paciente",
      fields: [
        "nombre_completo", "nombre", "sexo", "edad",
        "talla", "peso", "imc", "motivo", "procedencia",
      ],
    },
    {
      kind: "keyValue",
      title: "Datos del estudio",
      sourceKey: "estudio",
      fields: [
        "referencia", "fecha", "hora",
        "tipo_reporte", "equipo_modelo", "version_software",
      ],
    },
    {
      kind: "keyValue",
      title: "Condiciones técnicas",
      sourceKey: "condiciones",
      fields: [
        "tecnico", "transductor", "temperatura", "humedad", "presion",
        "ecuacion_referencia", "factor_etnico", "factor_btps",
      ],
    },
    {
      kind: "keyValue",
      title: "Calidad técnica del estudio",
      sourceKey: "calidad",
      fields: [
        "repetibilidad_ats_fvc", "repetibilidad_ats_fev1",
        "repetibilidad_fvc", "repetibilidad_fev1",
        "notas", "completitud",
      ],
    },
    {
      kind: "table",
      title: "Parámetros espirométricos",
      source: "parametros",
      columns: [
        { key: "label", label: "Parámetro" },
        { key: "unidad", label: "Unidad" },
        { key: "m1", label: "M1" },
        { key: "m2", label: "M2" },
        { key: "m3", label: "M3" },
        { key: "ref", label: "REF" },
        { key: "lln", label: "LLN" },
        { key: "pref_m1", label: "%REF M1" },
        { key: "pref_m2", label: "%REF M2" },
        { key: "pref_m3", label: "%REF M3" },
      ],
    },
    {
      kind: "keyValue",
      title: "Gráficas e indicadores",
      sourceKey: "graficas",
      fields: [
        "curva_flujo_volumen", "curva_volumen_tiempo",
        "maniobras_graficadas", "observaciones",
      ],
    },
  ],
}

// --- Registro central ---

export const STUDY_PRESENTATION_SCHEMAS: Record<string, StudyPresentationSchema> = {
  Espirometria: espirometriaSchema,
}

export function getStudySchema(studyType: string | null | undefined): StudyPresentationSchema | null {
  if (!studyType) return null
  return STUDY_PRESENTATION_SCHEMAS[studyType] ?? null
}
