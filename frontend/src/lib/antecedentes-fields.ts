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
  neurologico: CampoDescripcion[]
  digestivo: CampoDescripcion[]
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

/** Definición declarativa de las exposiciones booleanas (cada una con su descripción). */
export const HISTORIA_LABORAL_EXPOSICIONES: HistoriaLaboralExposicion[] = [
  { key: 'exposicion_quimica',    label: 'Química',                descKey: 'exposicion_quimica_especifique' },
  { key: 'exposicion_fisica',     label: 'Física',                 descKey: 'exposicion_fisica_especifique' },
  { key: 'exposicion_biologica',  label: 'Biológica',              descKey: 'exposicion_biologica_especifique' },
  { key: 'exposicion_ergonomica', label: 'Ergonómica',             descKey: 'exposicion_ergonomica_especifique' },
  { key: 'accidentes_trabajo',    label: 'Accidente de Trabajo',   descKey: 'accidentes_descripcion' },
  { key: 'enfermedades_trabajo',  label: 'Enfermedad de Trabajo',  descKey: 'enfermedades_descripcion' },
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
  { field: 'diabetes',      label: 'Diabetes',                help: 'Algún familiar con azúcar alta en sangre (diabetes).' },
  { field: 'has',           label: 'Hipertensión',            help: 'Algún familiar con presión arterial alta diagnosticada.' },
  { field: 'epilepsia',     label: 'Epilepsia',               help: 'Algún familiar con convulsiones o epilepsia diagnosticada.' },
  { field: 'cardiopatia',   label: 'Cardiopatía',             help: 'Algún familiar con enfermedades del corazón (infartos, arritmias, soplos, etc.).' },
  { field: 'renales',       label: 'Enfermedad renal',        help: 'Algún familiar con problemas del riñón, diálisis o trasplante.' },
  { field: 'asma',          label: 'Asma',                    help: 'Algún familiar con asma o bronquitis crónica recurrente.' },
  { field: 'cancer',        label: 'Cáncer',                  help: 'Algún familiar con cáncer de cualquier tipo.' },
  { field: 'mentales',      label: 'Trastornos mentales',     help: 'Algún familiar con depresión, ansiedad, esquizofrenia u otros trastornos psiquiátricos.' },
  { field: 'otras',         label: 'Otras',                   help: 'Otra enfermedad hereditaria o frecuente en su familia. Anote brevemente.' },
]

/** Campos Heredo-Familiares con catálogo ZIN de 8 opciones (incluye OTROS). */
export const HEREDOFAMILIARES_CATALOGO_FIELDS = HEREDOFAMILIARES_DESCRIPCIONES.filter(
  item => item.field !== 'mentales',
).map(item => item.field)

/** State key del texto libre cuando el select ZIN = OTROS (ej. `cancer_especifique`). */
export function heredoFamiliaresEspecifiqueKey(field: string): string {
  return `${field}_especifique`
}

/** Formato PDF/display: `OTROS` + detalle → `OTROS (TÍO PATERNO)`. */
export function formatHeredoFamiliaresValor(
  value: string | null | undefined,
  especifique: string | null | undefined,
): string {
  const v = (value ?? '').trim()
  if (!v) return ''
  const e = (especifique ?? '').trim()
  if (v === 'OTROS' && e) return `OTROS (${e})`
  return v
}

/** Lee un campo Heredo-Familiares con su especifique opcional desde snapshot/maestro. */
export function readHeredoFamiliaresDisplay(
  data: Record<string, unknown>,
  field: string,
): string {
  return formatHeredoFamiliaresValor(
    String(data[field] ?? ''),
    String(data[heredoFamiliaresEspecifiqueKey(field)] ?? ''),
  )
}

/** Estado vacío inicial para Heredo-Familiares (select + especifique por campo catálogo). */
export function emptyHeredoFamiliaresRecord(): Record<string, string> {
  const hf: Record<string, string> = { mentales: '' }
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
    { field: 'diabetes',       label: 'Diabetes',         help: 'Azúcar alta en sangre diagnosticada por un médico.' },
    { field: 'endocrinopatias',label: 'Endocrinopatías',  help: 'Otras enfermedades de tiroides, suprarrenales u hormonales.' },
    { field: 'asma',           label: 'Asma',             help: 'Asma persistente (crisis frecuentes, uso de inhalador).' },
  ],
  cardiopulmonar: [
    { field: 'cardiopatias', label: 'Cardiopatías',          help: 'Enfermedades del corazón (infarto, soplo, arritmia, insuficiencia).' },
    { field: 'bronquitis',   label: 'Bronquitis',            help: 'Bronquitis crónica o repetida (no la gripe común).' },
    { field: 'neumonias',    label: 'Neumonías',             help: 'Neumonía (infección pulmonar) que requirió tratamiento médico.' },
    { field: 'has',          label: 'Hipertensión Arterial', help: 'Presión arterial alta diagnosticada por un médico.' },
  ],
  neurologico: [
    { field: 'epilepsia',              label: 'Epilepsia',              help: 'Convulsiones o epilepsia diagnosticada.' },
    { field: 'migrana',                label: 'Migraña',                help: 'Dolores de cabeza fuertes y repetidos (jaqueca/migraña).' },
    { field: 'desmayos',               label: 'Desmayos',               help: 'Pérdidas de conocimiento o desmayos frecuentes.' },
    { field: 'traumatismos_craneales', label: 'Traumatismos craneales', help: 'Golpes fuertes en la cabeza con pérdida de conocimiento o atención médica.' },
  ],
  digestivo: [
    { field: 'gastritis',   label: 'Gastritis',           help: 'Inflamación del estómago con ardor frecuente, diagnosticada por un médico.' },
    { field: 'colitis',     label: 'Colitis',             help: 'Inflamación del colon (diarrea crónica, dolor abdominal recurrente).' },
    { field: 'hemorroides', label: 'Hemorroides',         help: 'Hemorroides (almorranas) que requirieron tratamiento.' },
    { field: 'hernias',     label: 'Hernias',             help: 'Hernias inguinales, abdominales o discales (en la espalda) operadas o no.' },
    { field: 'renales',     label: 'Enfermedades renales',help: 'Cálculos (piedras) en riñón, infecciones urinarias repetidas o enfermedad renal.' },
  ],
  otras: [
    { field: 'alergias',      label: 'Alergias',       help: 'Alergias a medicamentos, alimentos, polen, polvo, etc.' },
    { field: 'varices',       label: 'Varices',        help: 'Venas varicosas en piernas (venas dilatadas visibles).' },
    { field: 'ginecologicos', label: 'Ginecológicos',  help: 'Enfermedades ginecológicas tratadas (embarazos, quistes, etc.).' },
    { field: 'dermatitis',    label: 'Dermatitis',     help: 'Enfermedades de piel crónicas (eccema, psoriasis, dermatitis atópica).' },
    { field: 'psiquiatricas', label: 'Psiquiátricas',  help: 'Trastornos mentales diagnosticados (depresión, ansiedad, esquizofrenia, etc.).' },
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

/** Tratamiento médico actual (no patológicos). */
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
  return [
    ...PATOLOGICOS_DESCRIPCIONES.endocrino.map(c => c.field),
    ...PATOLOGICOS_DESCRIPCIONES.cardiopulmonar.map(c => c.field),
    ...PATOLOGICOS_DESCRIPCIONES.neurologico.map(c => c.field),
    ...PATOLOGICOS_DESCRIPCIONES.digestivo.map(c => c.field),
    ...PATOLOGICOS_DESCRIPCIONES.otras.map(c => c.field),
  ]
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
