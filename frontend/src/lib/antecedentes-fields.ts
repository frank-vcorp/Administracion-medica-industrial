/**
 * @file Diccionarios canónicos de las 5 secciones declarativas de Antecedentes.
 * Compartido por `AntecedentesForm.tsx` (editor maestro longitudinal) y
 * `AntecedentesCaptura.tsx` (editor snapshot por cita en Examen Médico).
 *
 * @id IMPL-20260809-01
 * @spec ARCH-20260809-01 — outer-tab "Antecedentes" en Examen Médico
 * @ref  SPEC §9 — Helper compartido `antecedentes-fields.ts`
 *
 * **Regla:** este helper es la única fuente de verdad de los listados de
 * campos/descripciones. Ambos editores importan desde aquí para evitar drift.
 * Si añades un campo a Patológicos/No Patológicos/Heredo-Familiares,
 * agrégalo aquí Y en el schema Zod correspondiente de
 * `frontend/src/schemas/clinical/history.schema.ts`.
 */

export interface CampoDescripcion {
  field: string
  label: string
  help: string
}

/** Agrupación canónica de los Patológicos — coincide con el JSX del AntecedentesForm. */
export interface GrupoPatologicos {
  endocrino: CampoDescripcion[]
  cardiopulmonar: CampoDescripcion[]
  infecciosas: CampoDescripcion[]
  neurologico: CampoDescripcion[]
  digestivo: CampoDescripcion[]
  musculoesqueletico: CampoDescripcion[]
  otras: CampoDescripcion[]
}

/** Item de No Patológicos: una sustancia/hábito + sub-campos desplegables. */
export interface NoPatologicoItem {
  key: string
  label: string
  help: string
  /** Sub-campos `[stateKey, labelVisible]` que se muestran cuando el toggle SI está activo. */
  subs: [string, string][]
}

/** Tipo de input por campo declarativo de Datos Personales. */
export type DatosPersonalesInputKind = 'text' | 'number' | 'select-turno' | 'select-estado-civil'

/** Definición declarativa de los campos de Datos Personales. */
export interface DatosPersonalesCampo {
  field: string
  label: string
  kind: DatosPersonalesInputKind
}

/** Definición declarativa de los sub-campos booleanos de Historia Laboral. */
export interface HistoriaLaboralExposicion {
  /** stateKey booleano (ej: `exposicion_quimica`). */
  key: string
  label: string
  /** Pregunta en formularios Sí/No (portal, etc.). */
  questionLabel?: string
  /** stateKey del input de texto que aparece cuando el booleano es true. */
  descKey: string
}

/** Definición declarativa de los empleos anteriores (1 y 2). */
export const HISTORIA_LABORAL_EMPLEOS_ANTERIORES_FIELDS: [string, string][] = [
  ['empresa_anterior_1', 'Empresa 1'],
  ['puesto_anterior_1', 'Puesto 1'],
  ['tiempo_anterior_1', 'Tiempo 1'],
  ['empresa_anterior_2', 'Empresa 2'],
  ['puesto_anterior_2', 'Puesto 2'],
  ['tiempo_anterior_2', 'Tiempo 2'],
]

/**
 * Referencia de factores de riesgo (medicina industrial / NOM).
 * Cada ítem describe la categoría y ejemplos típicos; el trabajador detalla
 * en el campo "Especifique" al marcar Sí.
 */
export const FACTORES_RIESGO_LABORAL_REFERENCIA: ReadonlyArray<{
  categoria: string
  ejemplos: string
}> = [
  {
    categoria: 'Físicos',
    ejemplos:
      'presiones anormales, radiación, iluminación, vibraciones, temperatura, ruido',
  },
  {
    categoria: 'Químicos',
    ejemplos: 'gases, sustancias, solventes',
  },
  {
    categoria: 'Biológicos',
    ejemplos: 'agentes patógenos, sustancias animales',
  },
  {
    categoria: 'Psicosociales',
    ejemplos: 'estrés laboral, carga mental, atención al público',
  },
  {
    categoria: 'Ergonómicos',
    ejemplos: 'posturas inadecuadas, movimiento repetitivo, levantamiento de carga',
  },
]

/** Exposición a agentes en el puesto (minuta 28-oct: separar de riesgos/accidentes). */
export const HISTORIA_LABORAL_EXPOSICION_AGENTES: HistoriaLaboralExposicion[] = [
  {
    key: 'exposicion_fisica',
    label: 'Riesgos físicos',
    questionLabel:
      '¿Ha estado expuesto a riesgos físicos (ruido, vibración, temperatura, radiación, iluminación, presión)?',
    descKey: 'exposicion_fisica_especifique',
  },
  {
    key: 'exposicion_quimica',
    label: 'Riesgos químicos',
    questionLabel: '¿Ha estado expuesto a riesgos químicos (gases, sustancias, solventes)?',
    descKey: 'exposicion_quimica_especifique',
  },
  {
    key: 'exposicion_biologica',
    label: 'Riesgos biológicos',
    questionLabel: '¿Ha estado expuesto a riesgos biológicos (patógenos, sustancias animales)?',
    descKey: 'exposicion_biologica_especifique',
  },
  {
    key: 'exposicion_psicosocial',
    label: 'Riesgos psicosociales',
    questionLabel: '¿Ha estado expuesto a factores psicosociales (estrés laboral, carga mental, atención al público)?',
    descKey: 'exposicion_psicosocial_especifique',
  },
  {
    key: 'exposicion_ergonomica',
    label: 'Riesgos ergonómicos',
    questionLabel:
      '¿Ha estado expuesto a riesgos ergonómicos (posturas, movimientos repetitivos, levantamiento de carga)?',
    descKey: 'exposicion_ergonomica_especifique',
  },
]

/** Accidente laboral y enfermedad profesional (apartado distinto de exposición). */
export const HISTORIA_LABORAL_RIESGOS_TRABAJO: HistoriaLaboralExposicion[] = [
  { key: 'accidentes_trabajo',   label: 'Accidente laboral',     descKey: 'accidentes_descripcion' },
  { key: 'enfermedades_trabajo', label: 'Enfermedad profesional', descKey: 'enfermedades_descripcion' },
]

/** Iteración completa (persistencia / payload); mantener orden legacy. */
export const HISTORIA_LABORAL_EXPOSICIONES: HistoriaLaboralExposicion[] = [
  ...HISTORIA_LABORAL_EXPOSICION_AGENTES,
  ...HISTORIA_LABORAL_RIESGOS_TRABAJO,
]

/** Opciones de turno (select). */
export const TURNO_OPTIONS = ['MATUTINO', 'VESPERTINO', 'NOCTURNO', 'MIXTO'] as const

/** Opciones de estado civil (select). */
export const ESTADO_CIVIL_OPTIONS = [
  'SOLTERO',
  'CASADO',
  'UNION_LIBRE',
  'DIVORCIADO',
  'VIUDO',
  'OTRO',
] as const

/** Definición declarativa de los campos de Datos Personales. */
export const DATOS_PERSONALES_CAMPOS: DatosPersonalesCampo[] = [
  { field: 'puesto_actual',      label: 'Puesto Actual',       kind: 'text' },
  { field: 'area_departamento',  label: 'Área / Departamento', kind: 'text' },
  { field: 'escolaridad',        label: 'Escolaridad',         kind: 'text' },
  { field: 'antiguedad_anios',   label: 'Antigüedad (años)',   kind: 'number' },
  { field: 'antiguedad_meses',   label: 'Antigüedad (meses)',  kind: 'number' },
  { field: 'numero_hijos',       label: 'Número de Hijos',     kind: 'number' },
  { field: 'turno',              label: 'Turno',               kind: 'select-turno' },
  { field: 'estado_civil',       label: 'Estado Civil',        kind: 'select-estado-civil' },
]

/** Opciones de alimentación (select). */
export const ALIMENTACION_OPTIONS = ['BUENA', 'REGULAR', 'MALA'] as const

/** Opciones SI/NEGADO usadas por booleanos declarativos (Patológicos / No Patológicos). */
export const SI_NEGADO = ['NEGADO', 'SI'] as const

/**
 * Antecedentes Heredo-Familiares: cada enfermedad tiene un input de texto
 * donde se anota la relación familiar (ej: "PADRE", "ABUELO MATERNO").
 * Coincide con `HeredoFamiliaresSchema` en `schemas/clinical/history.schema.ts`.
 */
export const HEREDOFAMILIARES_DESCRIPCIONES: CampoDescripcion[] = [
  { field: 'diabetes',      label: 'Diabetes (en familia)',   help: 'Algún familiar con azúcar alta en sangre (diabetes). No es diabetes del trabajador — eso va en Personales (APP).' },
  { field: 'has',           label: 'Hipertensión',            help: 'Algún familiar con presión arterial alta diagnosticada.' },
  { field: 'epilepsia',     label: 'Epilepsia',               help: 'Algún familiar con convulsiones o epilepsia diagnosticada.' },
  { field: 'cardiopatia',   label: 'Cardiopatía',             help: 'Algún familiar con enfermedades del corazón (infartos, arritmias, soplos, etc.).' },
  { field: 'renales',       label: 'Enfermedad renal',        help: 'Algún familiar con problemas del riñón, diálisis o trasplante.' },
  { field: 'asma',          label: 'Asma (en familia)',       help: 'Algún familiar con asma o bronquitis crónica recurrente.' },
  { field: 'cancer',        label: 'Cáncer (en familia)',     help: 'Algún familiar con cáncer de cualquier tipo.' },
  { field: 'mentales',      label: 'Trastornos mentales',     help: 'Algún familiar con depresión, ansiedad, esquizofrenia u otros trastornos psiquiátricos.' },
]

/** Campos Heredo-Familiares con catálogo ZIN (sin «Otros» — O9-31). */
export const HEREDOFAMILIARES_CATALOGO_FIELDS = HEREDOFAMILIARES_DESCRIPCIONES.filter(
  item => item.field !== 'mentales',
).map(item => item.field)

/** State key del texto libre opcional (p. ej. `mentales_especifique` cuando SI). */
export function heredoFamiliaresEspecifiqueKey(field: string): string {
  return `${field}_especifique`
}

/** Valores legacy del select cerrado de `mentales` (NEGADO/SI/NO APLICA). */
export const HEREDOFAMILIARES_MENTALES_LEGACY = ['NEGADO', 'SI', 'NO APLICA'] as const

/** Texto del campo abierto «Trastornos mentales» (AHF) para edición en UI. */
export function readMentalesCampoAbierto(data: Record<string, unknown>): string {
  const esp = String(data.mentales_especifique ?? '').trim()
  if (esp) return esp
  const raw = String(data.mentales ?? '').trim()
  if (raw === 'SI' || raw === 'NEGADO' || raw === '') return ''
  if (raw === 'NO APLICA') return 'NO APLICA'
  return raw
}

/** Persistencia al editar «Trastornos mentales» como campo abierto (compat legacy). */
export function writeMentalesCampoAbierto(text: string): {
  mentales: string
  mentales_especifique: string
} {
  const t = text.trim()
  if (!t) return { mentales: 'NEGADO', mentales_especifique: '' }
  if (t.toUpperCase() === 'NO APLICA') return { mentales: 'NO APLICA', mentales_especifique: '' }
  return { mentales: t, mentales_especifique: '' }
}

/** PDF / display para `mentales` (legacy SI+especifique o texto libre). */
export function formatMentalesDisplay(data: Record<string, unknown>): string {
  const raw = String(data.mentales ?? '').trim()
  const esp = String(data.mentales_especifique ?? '').trim()
  if (raw === 'SI' && esp) return `SI (${esp})`
  if (esp) return esp
  if (raw === 'SI') return 'SI'
  if (raw === 'NO APLICA') return 'NO APLICA'
  if (raw === 'NEGADO' || !raw) return 'NEGADO'
  return raw
}

/** Formato PDF/display para heredo-familiares (multiselect o mentales SI). */
export function formatHeredoFamiliaresValor(
  value: string | null | undefined,
  especifique: string | null | undefined,
): string {
  const v = (value ?? '').trim()
  if (!v) return ''
  const e = (especifique ?? '').trim()
  if (v === 'SI' && e) return `SI (${e})`
  if (v.includes(',')) {
    return v
      .split(',')
      .map((part) => {
        const p = part.trim()
        if (p === 'OTROS' && e) return `OTROS (${e})`
        return p
      })
      .join(', ')
  }
  if (v === 'OTROS' && e) return `OTROS (${e})`
  return v
}

/** Lee un campo Heredo-Familiares con su especifique opcional desde snapshot/maestro. */
export function readHeredoFamiliaresDisplay(
  data: Record<string, unknown>,
  field: string,
): string {
  if (field === 'mentales') return formatMentalesDisplay(data)
  return formatHeredoFamiliaresValor(
    String(data[field] ?? ''),
    String(data[heredoFamiliaresEspecifiqueKey(field)] ?? ''),
  )
}

/** Estado vacío inicial para Heredo-Familiares (select + especifique por campo catálogo). */
export function emptyHeredoFamiliaresRecord(): Record<string, string> {
  const hf: Record<string, string> = { mentales: '', mentales_especifique: '' }
  for (const field of HEREDOFAMILIARES_CATALOGO_FIELDS) {
    hf[field] = ''
    hf[heredoFamiliaresEspecifiqueKey(field)] = ''
  }
  return hf
}

/**
 * Antecedentes Personales Patológicos agrupados por sistema.
 * `subs` es vacío porque cada campo es un único select SI/NEGADO.
 * Coincide con `PatologicosSchema` en `schemas/clinical/history.schema.ts`.
 */
export const PATOLOGICOS_DESCRIPCIONES: GrupoPatologicos = {
  endocrino: [
    { field: 'diabetes',       label: 'Diabetes (paciente)', help: 'Azúcar alta en sangre del trabajador, diagnosticada por un médico. Distinto de diabetes en Familiares (AHF).' },
    { field: 'endocrinopatias',label: 'Endocrinopatías',  help: 'Otras enfermedades de tiroides, suprarrenales u hormonales.' },
    { field: 'asma',           label: 'Asma (paciente)',  help: 'Asma del trabajador (crisis frecuentes, inhalador). Distinto de asma en Familiares (AHF).' },
  ],
  cardiopulmonar: [
    { field: 'cardiopatias', label: 'Cardiopatías',          help: 'Enfermedades del corazón (infarto, soplo, arritmia, insuficiencia).' },
    { field: 'bronquitis',   label: 'Bronquitis',            help: 'Bronquitis crónica o repetida (no la gripe común).' },
    { field: 'neumonias',    label: 'Neumonías',             help: 'Neumonía (infección pulmonar) que requirió tratamiento médico.' },
    { field: 'tuberculosis', label: 'Tuberculosis',          help: 'Tuberculosis diagnosticada o tratada.' },
    { field: 'has',          label: 'Hipertensión Arterial', help: 'Presión arterial alta diagnosticada por un médico.' },
  ],
  infecciosas: [
    { field: 'tifoidea',         label: 'Tifoidea',           help: 'Fiebre tifoidea u otra enteritis tifoide.' },
    { field: 'hepatitis',        label: 'Hepatitis',          help: 'Hepatitis viral u otra hepatitis diagnosticada.' },
    { field: 'exantematicas',    label: 'Exantemáticas',      help: 'Varicela, sarampión u otras exantemáticas.' },
    { field: 'parotiditis',      label: 'Parotiditis',        help: 'Paperas u otra parotiditis.' },
    { field: 'enf_trans_sexual', label: 'Enf. trans. sexual', help: 'Infecciones de transmisión sexual diagnosticadas.' },
  ],
  neurologico: [
    { field: 'epilepsia',              label: 'Epilepsia',              help: 'Convulsiones o epilepsia diagnosticada.' },
    { field: 'migrana',                label: 'Migraña',                help: 'Dolores de cabeza fuertes y repetidos (jaqueca/migraña).' },
    { field: 'vertigo',                label: 'Vértigo',                help: 'Mareos o vértigo recurrente.' },
    { field: 'desmayos',               label: 'Desmayos',               help: 'Pérdidas de conocimiento o desmayos frecuentes.' },
    { field: 'traumatismos_craneales', label: 'Traumatismos',           help: 'Traumatismos con atención médica (incl. craneales).' },
  ],
  digestivo: [
    { field: 'gastritis',   label: 'Gastritis',           help: 'Inflamación del estómago con ardor frecuente, diagnosticada por un médico.' },
    { field: 'colitis',     label: 'Colitis',             help: 'Inflamación del colon (diarrea crónica, dolor abdominal recurrente).' },
    { field: 'hemorroides', label: 'Hemorroides',         help: 'Hemorroides (almorranas) que requirieron tratamiento.' },
    { field: 'hernias',     label: 'Hernias',             help: 'Hernias inguinales, abdominales o discales (en la espalda) operadas o no.' },
    { field: 'renales',     label: 'Enfermedades renales',help: 'Cálculos (piedras) en riñón, infecciones urinarias repetidas o enfermedad renal.' },
  ],
  musculoesqueletico: [
    { field: 'cancer',           label: 'Cáncer',                 help: 'Cáncer de cualquier tipo diagnosticado o tratado.' },
    { field: 'fracturas',        label: 'Fracturas',              help: 'Fracturas óseas previas.' },
    { field: 'cirugias',         label: 'Cirugías',               help: 'Cirugías mayores previas.' },
    { field: 'transfusiones',    label: 'Transfusiones',          help: 'Transfusiones sanguíneas previas.' },
    { field: 'pat_c_vertebral',  label: 'Pat. columna vertebral', help: 'Patología de columna vertebral diagnosticada.' },
  ],
  otras: [
    { field: 'alergias',      label: 'Alergias',       help: 'Alergias a medicamentos, alimentos, polen, polvo, etc.' },
    { field: 'varices',       label: 'Varices',        help: 'Venas varicosas en piernas (venas dilatadas visibles).' },
    { field: 'ginecologicos', label: 'Ginecológicos',  help: 'Enfermedades ginecológicas tratadas (embarazos, quistes, etc.).' },
    { field: 'dermatitis',    label: 'Dermatitis',     help: 'Enfermedades de piel crónicas (eccema, psoriasis, dermatitis atópica).' },
    { field: 'psiquiatricas', label: 'Psiquiátricas',  help: 'Trastornos mentales diagnosticados (depresión, ansiedad, esquizofrenia, etc.).' },
    {
      field: 'otras',
      label: 'Otras enfermedades',
      help: 'Enfermedad no listada arriba: indique el nombre al marcar SÍ.',
    },
  ],
}

/** Texto para PDF: toggle SI/NEGADO + campo libre condicional en no_patologicos. */
export function readSiEspecifiqueDisplay(
  noPatologicos: Record<string, unknown> | null | undefined,
  toggleKey: string,
  especifiqueKey: string,
): string {
  const np = noPatologicos ?? {}
  const estado = String(np[toggleKey] ?? '').trim()
  if (estado === 'SI') {
    const detalle = String(np[especifiqueKey] ?? '').trim()
    return detalle ? `SI — ${detalle}` : 'SI'
  }
  return estado || 'NEGADO'
}

/** Texto para PDF / dictamen desde no_patologicos.tatuajes + tatuajes_especifique. */
export function readTatuajesDisplay(
  noPatologicos: Record<string, unknown> | null | undefined,
): string {
  return readSiEspecifiqueDisplay(noPatologicos, 'tatuajes', 'tatuajes_especifique')
}

/** UI/PDF — campo `tratamiento_medico_actual` (clave legacy en BD). */
export const SUPLEMENTOS_COMPLEMENTOS_LABEL = 'Suplementos y Complementos'

export const SUPLEMENTOS_COMPLEMENTOS_HELP =
  'Vitaminas, minerales, productos herbolarios u otros complementos que consuma de forma regular (no medicamentos recetados).'

export const SUPLEMENTOS_COMPLEMENTOS_ESPECIFIQUE_PLACEHOLDER =
  'ej: multivitamínico, vitamina D, omega-3, proteína'

/** Tratamiento médico actual (no patológicos) — display/PDF. */
export function readTratamientoMedicoActualDisplay(
  noPatologicos: Record<string, unknown> | null | undefined,
): string {
  return readSiEspecifiqueDisplay(
    noPatologicos,
    'tratamiento_medico_actual',
    'tratamiento_medico_actual_especifique',
  )
}

/**
 * Antecedentes Personales No Patológicos / Toxicomanías.
 * Cada item tiene un toggle SI/NEGADO y, si es SI, se muestran sub-campos.
 * Coincide con `NoPatologicosSchema` en `schemas/clinical/history.schema.ts`.
 */
export const NO_PATOLOGICOS_DESCRIPCIONES: NoPatologicoItem[] = [
  {
    key: 'alcohol',
    label: 'Alcohol',
    help: 'Bebidas con alcohol (cerveza, vino, licor) consumidas con regularidad, no de forma ocasional.',
    subs: [
      ['alcohol_edad_comienzo', 'Edad inicio'],
      ['alcohol_frecuencia', 'Frecuencia'],
      ['alcohol_suspendido', 'Suspendido'],
      ['alcohol_tiempo_suspendido', 'Tiempo suspendido'],
    ],
  },
  {
    key: 'tabaco',
    label: 'Tabaco',
    help: 'Cigarrillos, puros, pipa o vapeo. Incluye fumadores activos y ex-fumadores.',
    subs: [
      ['tabaco_edad_comienzo', 'Edad inicio'],
      ['tabaco_frecuencia', 'Frecuencia'],
      ['tabaco_cigarros_dia', 'Cigarros/día'],
      ['tabaco_suspendido', 'Suspendido'],
      ['tabaco_tiempo_suspendido', 'Tiempo suspendido'],
    ],
  },
  {
    key: 'drogas_estimulantes',
    label: 'Drogas/Estimulantes',
    help: 'Sustancias psicoactivas recreativas (marihuana, cocaína, estimulantes, etc.). Confidencial.',
    subs: [
      ['drogas_especifique', 'Especifique'],
      ['drogas_frecuencia', 'Frecuencia'],
      ['drogas_ultimo_consumo', 'Último consumo'],
    ],
  },
  {
    key: 'ejercicio',
    label: 'Ejercicio',
    help: 'Actividad física o deporte practicado con regularidad (caminar, correr, fútbol, gym, etc.).',
    subs: [
      ['ejercicio_especifique', 'Tipo'],
      ['ejercicio_frecuencia', 'Frecuencia'],
    ],
  },
]

/**
 * Lista plana de TODOS los `field` del grupo Patológicos.
 * Útil para inicializar un state con defaults `NEGADO` y para verificar
 * cobertura de tests.
 */
export function getPatologicosAllFields(): string[] {
  const g = PATOLOGICOS_DESCRIPCIONES
  return [
    ...g.endocrino.map(c => c.field),
    ...g.cardiopulmonar.map(c => c.field),
    ...g.infecciosas.map(c => c.field),
    ...g.neurologico.map(c => c.field),
    ...g.digestivo.map(c => c.field),
    ...g.musculoesqueletico.map(c => c.field),
    ...g.otras.map(c => c.field),
  ]
}

/** Orden de grupos patológicos en UI (Examen Médico + Historial). */
export const PATOLOGICOS_GROUP_ORDER: readonly (keyof GrupoPatologicos)[] = [
  'endocrino',
  'cardiopulmonar',
  'infecciosas',
  'neurologico',
  'digestivo',
  'musculoesqueletico',
  'otras',
] as const

export const PATOLOGICOS_GROUP_TITLES: Record<keyof GrupoPatologicos, string> = {
  endocrino: 'Enfermedades endocrino-metabólicas',
  cardiopulmonar: 'Sistema cardiopulmonar',
  infecciosas: 'Enfermedades infecciosas',
  neurologico: 'Sistema neurológico',
  digestivo: 'Sistema digestivo y genitourinario',
  musculoesqueletico: 'Cáncer, traumatismos y procedimientos',
  otras: 'Otras condiciones',
}

/** Lista plana de todos los `field` (incluye `key` y todos los `subs`) de No Patológicos. */
export function getNoPatologicosAllFields(): string[] {
  const result: string[] = []
  for (const item of NO_PATOLOGICOS_DESCRIPCIONES) {
    result.push(item.key)
    for (const [sk] of item.subs) result.push(sk)
  }
  // Campos planos adicionales definidos en NoPatologicosSchema que no son subs:
  result.push(
    'alimentacion',
    'tratamiento_medico_actual',
    'tratamiento_medico_actual_especifique',
    'grupo_y_rh',
    'tatuajes',
    'tatuajes_especifique',
  )
  return result
}
