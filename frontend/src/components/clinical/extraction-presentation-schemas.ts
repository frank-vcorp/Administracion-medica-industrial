/**
 * @fileoverview Esquemas de presentación clínica por tipo de estudio.
 * Configura cómo se mapea extractedData hacia secciones legibles para médico.
 * @id IMPL-20260518-13
 * @backup context/checkpoints/CHK_IMPL-20260518-13-RENDERER-CLINICO.md
 * @extends IMPL-20260518-14 — Audiometría (tabla bilateral por frecuencia)
 * @backup context/checkpoints/CHK_IMPL-20260518-14-RENDERER-CLINICO-AUDIOMETRIA.md
 * @realigned IMPL-20260603-01
 * @backup context/SPECs/SPEC_ARCH-20260603-05-REALINEACION-RENDERER-ESPIROMETRIA-PAYLOAD-REAL.md
 */

// --- Tipos de secciones ---

export type KeyValueSection = {
  kind: "keyValue"
  title: string
  /** Claves a leer del objeto raíz o del subobjeto indicado por sourceKey */
  fields: string[]
  /** Si se especifica, se busca primero en extractedData[sourceKey]. Soporta rutas tipo a.b.c */
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

/**
 * Tabla comparativa bilateral por frecuencia (p.ej. Audiometría).
 * Fusiona dos mapas oído_derecho / oído_izquierdo por clave de frecuencia.
 * @id IMPL-20260518-14
 */
export type BilateralFrequencyTableSection = {
  kind: "bilateralFrequency"
  title: string
  /** Clave/ruta en extractedData para el mapa oído derecho (freq → valor) */
  rightKey: string
  /** Clave/ruta en extractedData para el mapa oído izquierdo (freq → valor) */
  leftKey: string
  /** Orden preferido de frecuencias (Hz). Las adicionales se añaden al final. */
  preferredOrder?: number[]
}

export type ClinicalPresentationSection =
  | KeyValueSection
  | TableSection
  | BadgesSection
  | NoteSection
  | BilateralFrequencyTableSection

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
      fields: ["fvc", "fev1", "fev1_fvc_ratio", "fvc_percent_predicho", "fev1_percent_predicho"],
    },
    {
      kind: "keyValue",
      title: "Datos del paciente",
      sourceKey: "paciente",
      fields: [
        "nombre_completo", "sexo", "edad_anios", "talla_cm",
        "peso_kg", "imc", "motivo", "procedencia", "fuma",
      ],
    },
    {
      kind: "keyValue",
      title: "Datos del estudio",
      sourceKey: "estudio",
      fields: [
        "referencia", "fecha_estudio", "hora_estudio",
        "tipo_reporte", "equipo_modelo", "version_software",
      ],
    },
    {
      kind: "keyValue",
      title: "Condiciones técnicas",
      sourceKey: "condiciones",
      fields: [
        "tecnico", "transductor", "temperatura_c", "humedad_pct", "presion_mmhg",
        "referencia_ecuacion", "factor_etnico", "factor_btps",
      ],
    },
    {
      kind: "keyValue",
      title: "Calidad técnica del estudio",
      sourceKey: "calidad",
      fields: [
        "repetibilidad_ats_ers_fvc", "repetibilidad_ats_ers_fev1",
        "es_interpretable", "completitud_documental", "notas_calidad",
      ],
    },
    {
      kind: "table",
      title: "Parámetros espirométricos",
      source: "parametros",
      columns: [
        { key: "label", label: "Parámetro" },
        { key: "unit", label: "Unidad" },
        { key: "m1_value", label: "M1" },
        { key: "m2_value", label: "M2" },
        { key: "m3_value", label: "M3" },
        { key: "ref_value", label: "REF" },
        { key: "lln_value", label: "LLN" },
        { key: "m1_pct_ref", label: "%REF M1" },
        { key: "m2_pct_ref", label: "%REF M2" },
        { key: "m3_pct_ref", label: "%REF M3" },
      ],
    },
    {
      kind: "keyValue",
      title: "Gráficas e indicadores",
      sourceKey: "graficas",
      fields: [
        "curva_flujo_volumen_presente", "curva_volumen_tiempo_presente",
        "maniobras_graficadas", "observaciones_grafica",
      ],
    },
  ],
}

// --- Configuración: Audiometría ---
// @id IMPL-20260518-14
// @realigned IMPL-20260519-02 — payload real: va/vo/pta_visible/paciente_detalle
// @backup context/SPECs/SPEC_ARCH-20260519-02-REALINEACION-RENDERER-AUDIOMETRIA-PAYLOAD-REAL.md

const audiometriaSchema: StudyPresentationSchema = {
  studyType: "Audiometria",
  sections: [
    {
      kind: "keyValue",
      title: "Paciente",
      sourceKey: "paciente_detalle",
      fields: [
        "nombre_completo",
        "identificacion",
        "sexo",
        "edad_anios",
        "fecha_nacimiento",
        "notas",
        "empresa",
        "puesto",
      ],
    },
    {
      kind: "keyValue",
      title: "Estudio",
      sourceKey: "estudio",
      fields: [
        "fecha_estudio",
        "hora_estudio",
        "tipo_reporte",
        "equipo_modelo",
        "transductor",
        "ultima_calibracion",
        "equipo_numero_serie",
        "numero_serie_sistema",
      ],
    },
    {
      kind: "keyValue",
      title: "Resumen técnico",
      fields: ["completitud_documental"],
    },
    {
      kind: "note",
      title: "Notas de calidad",
      source: "notas_calidad.descripcion",
    },
    {
      kind: "keyValue",
      title: "PTA Oído Derecho",
      sourceKey: "oido_derecho",
      fields: ["pta_visible"],
    },
    {
      kind: "keyValue",
      title: "PTA Oído Izquierdo",
      sourceKey: "oido_izquierdo",
      fields: ["pta_visible"],
    },
    {
      kind: "keyValue",
      title: "Condiciones",
      sourceKey: "condiciones",
      fields: ["cabina", "equipo", "tecnico", "observaciones", "PTA_general"],
    },
    {
      kind: "bilateralFrequency",
      title: "Vía aérea por frecuencia",
      rightKey: "oido_derecho.va",
      leftKey: "oido_izquierdo.va",
      // IMPL-20260519-04 — orden clínico completo del formato real
      preferredOrder: [125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000],
    },
    {
      kind: "bilateralFrequency",
      title: "Vía ósea por frecuencia",
      rightKey: "oido_derecho.vo",
      leftKey: "oido_izquierdo.vo",
      preferredOrder: [125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000],
    },
    {
      kind: "bilateralFrequency",
      title: "Separación por frecuencia",
      rightKey: "oido_derecho.separacion",
      leftKey: "oido_izquierdo.separacion",
      preferredOrder: [125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000],
    },
    {
      kind: "keyValue",
      title: "Campos fuente del formato",
      sourceKey: "campos_fuente",
      fields: ["faringe", "cad", "cai", "mtd", "mti"],
    },
  ],
}

// --- Registro central ---

export const STUDY_PRESENTATION_SCHEMAS: Record<string, StudyPresentationSchema> = {
  Espirometria: espirometriaSchema,
  Audiometria: audiometriaSchema,
}

export function getStudySchema(studyType: string | null | undefined): StudyPresentationSchema | null {
  if (!studyType) return null
  return STUDY_PRESENTATION_SCHEMAS[studyType] ?? null
}
