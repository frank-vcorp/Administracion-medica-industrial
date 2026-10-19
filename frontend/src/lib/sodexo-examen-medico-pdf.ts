/**
 * PDF Sodexo REG-SO-01 — relleno sobre plantilla AcroForm.
 *
 * **Solo salida:** la papeleta sigue siendo examen AMI (+ pestaña Extensión Sodexo).
 * Aquí se proyectan datos existentes al formato impreso; campos nuevos exclusivos
 * de Sodexo viven en `variant_extensions.SODEXO`, no en Antecedentes/ZIN.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'
import { SodexoExtensionSchema, type SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import { fillSodexoPatologicos } from '@/lib/sodexo-pdf-patologicos'
import { fillSodexoInmunizaciones } from '@/lib/sodexo-pdf-inmunizaciones'
import { fillSodexoEpp } from '@/lib/sodexo-pdf-epp'
import { fillSodexoMatrizRiesgos } from '@/lib/sodexo-pdf-matriz'
import { fillSodexoExamenFisicoNormals } from '@/lib/sodexo-pdf-examen-fisico-checks'
import { fillSodexoHistoriaOcupacionalTabla } from '@/lib/sodexo-pdf-ho'
import { fillSodexoEstilosVida } from '@/lib/sodexo-pdf-estilos-vida'
import { fillSodexoGineco } from '@/lib/sodexo-pdf-gineco'
import { fillSodexoPdfFromExtension } from '@/lib/sodexo-pdf-extension'
import { fillSodexoExtensionBlocks } from '@/lib/sodexo-pdf-extension-blocks'
import { fillSodexoVisiometriaFromExtension } from '@/lib/sodexo-pdf-visiometria-extension'
import {
  SODEXO_AHF_LEFT,
  SODEXO_AHF_LEFT_KEYS,
  SODEXO_AHF_RIGHT,
  SODEXO_AHF_RIGHT_KEYS,
  SODEXO_DIAGNOSTICOS_TEXT,
  SODEXO_ESCOLARIDAD_CHECKS,
  SODEXO_EXPLORACION_TEXT,
  SODEXO_RESTRICCIONES_TEXT,
  SODEXO_VISIOMETRIA_TEXT,
} from '@/lib/sodexo-pdf-mappings'

const TEMPLATE_CANDIDATES = [
  path.join(process.cwd(), 'resources/pdf/sodexo-examen-medico-template.pdf'),
  path.join(
    process.cwd(),
    '../context/datos AMI/informacion para revision/FORMATO EXAMEN MEDICO SODEXO.pdf',
  ),
  path.join(
    process.cwd(),
    '../context/informacion para revision/FORMATO EXAMEN MEDICO SODEXO.pdf',
  ),
]

type PdfForm = ReturnType<PDFDocument['getForm']>

function s(v: string | null | undefined): string {
  if (v == null) return ''
  return String(v).trim()
}

function setText(form: PdfForm, fieldName: string, value: string | null | undefined) {
  const text = s(value)
  if (!text) return
  try {
    const field = form.getTextField(fieldName)
    field.setText(text)
    try {
      field.setFontSize(7)
    } catch {
      // plantilla con fuente embebida
    }
  } catch {
    // Campo ausente en revisiones de plantilla
  }
}

function setCheck(form: PdfForm, fieldName: string, checked: boolean) {
  if (!checked) return
  try {
    form.getCheckBox(fieldName).check()
  } catch {
    // ignore
  }
}

function parseHf(display: string | null | undefined): {
  negado: boolean
  positivo: boolean
  parentesco: string
} {
  const raw = s(display)
  const u = raw.toUpperCase()
  if (!raw || u === 'NEGADOS' || u === 'NEGADO' || u === 'NO APLICA' || u === 'NO') {
    return { negado: true, positivo: false, parentesco: '' }
  }
  return { negado: false, positivo: true, parentesco: raw }
}

function applyHfRow(
  form: PdfForm,
  row: { text: string; checkNo: string; checkSi: string },
  display: string | null | undefined,
) {
  const { negado, positivo, parentesco } = parseHf(display)
  if (negado) setCheck(form, row.checkNo, true)
  if (positivo) {
    setCheck(form, row.checkSi, true)
    setText(form, row.text, parentesco)
  }
}

function parseSodexoExt(data: ExamenMedicoPDFData): SodexoExtensionData | null {
  const raw = data.variantExtensions?.SODEXO
  if (!raw) return null
  const parsed = SodexoExtensionSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

function splitDateParts(isoOrDisplay: string | null | undefined): {
  day: string
  month: string
  year: string
} {
  const t = s(isoOrDisplay)
  if (!t) return { day: '', month: '', year: '' }
  const m = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (m) {
    return { day: m[1], month: m[2], year: m[3].length === 2 ? `20${m[3]}` : m[3] }
  }
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) {
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      year: String(d.getFullYear()),
    }
  }
  return { day: '', month: '', year: '' }
}

function resolveTipoExamenCheckbox(
  ext: SodexoExtensionData | null,
  pacienteTipo: string | null | undefined,
): 'PREINGRESO' | 'PERIODICA' | 'RETIRO' | 'REINGRESO' | null {
  const fromExt = ext?.tipo_examen
  if (fromExt) return fromExt
  const lower = s(pacienteTipo).toLowerCase()
  if (lower.includes('pre')) return 'PREINGRESO'
  if (lower.includes('peri')) return 'PERIODICA'
  if (lower.includes('retiro')) return 'RETIRO'
  if (lower.includes('reing')) return 'REINGRESO'
  return null
}

function mapSexCheckboxes(sexo: string | null | undefined): {
  femenino: boolean
  masculino: boolean
} {
  const u = s(sexo).toUpperCase()
  if (u === 'F' || u.includes('FEM')) return { femenino: true, masculino: false }
  if (u === 'M' || u.includes('MASC')) return { femenino: false, masculino: true }
  return { femenino: false, masculino: false }
}

function mapEstadoCivilCheckboxes(estado: string | null | undefined): {
  soltero: boolean
  casado: boolean
  union: boolean
  viudo: boolean
} {
  const u = s(estado).toUpperCase()
  return {
    soltero: u.includes('SOLTER') || u === 'S',
    casado: u.includes('CASAD') || u === 'C',
    union: u.includes('UNION') || u.includes('LIBRE') || u === 'UL',
    viudo: u.includes('VIUD') || u === 'V',
  }
}

function mapEscolaridadChecks(escolaridad: string | null | undefined) {
  const u = s(escolaridad).toUpperCase()
  return {
    basica: u.includes('BASIC') || u.includes('PRIMAR'),
    media: u.includes('MEDIA') || u.includes('SECUND') || u.includes('PREPARATOR'),
    tecnica: u.includes('TECNIC') || u.includes('TÉCNIC'),
    universidad: u.includes('UNIVERS') || u.includes('LICEN'),
    postgrado: u.includes('POST') || u.includes('MAESTR') || u.includes('DOCTOR'),
  }
}

function mapApnpNegadoSi(value: string | null | undefined): 'no' | 'si' | null {
  const u = s(value).toUpperCase()
  if (!u) return null
  if (u === 'NEGADO' || u === 'NO' || u.startsWith('NO ')) return 'no'
  if (u === 'SI' || u.startsWith('SI')) return 'si'
  return 'si'
}

function splitAddress(direccion: string | null | undefined): {
  calle: string
  colonia: string
  ciudad: string
} {
  const t = s(direccion)
  if (!t) return { calle: '', colonia: '', ciudad: '' }
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 3) {
    return { calle: parts[0], colonia: parts[1], ciudad: parts.slice(2).join(', ') }
  }
  if (parts.length === 2) {
    return { calle: parts[0], colonia: '', ciudad: parts[1] }
  }
  return { calle: t, colonia: '', ciudad: '' }
}

async function loadTemplateBytes(): Promise<Buffer> {
  for (const candidate of TEMPLATE_CANDIDATES) {
    try {
      return await readFile(candidate)
    } catch {
      continue
    }
  }
  throw new Error(
    'Plantilla Sodexo no encontrada (resources/pdf/sodexo-examen-medico-template.pdf)',
  )
}

async function embedSignature(
  doc: PDFDocument,
  dataUrlOrPath: string,
  pageIndex: number,
  rect: { x: number; y: number; width: number; height: number },
) {
  const src = s(dataUrlOrPath)
  if (!src) return
  let bytes: Uint8Array | null = null
  if (src.startsWith('data:image')) {
    const b64 = src.split(',')[1]
    if (!b64) return
    bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
  } else if (src.startsWith('http://') || src.startsWith('https://')) {
    const res = await fetch(src)
    if (!res.ok) return
    bytes = new Uint8Array(await res.arrayBuffer())
  } else {
    try {
      bytes = new Uint8Array(await readFile(src))
    } catch {
      return
    }
  }
  const page = doc.getPages()[pageIndex]
  if (!page) return
  try {
    const image = src.includes('png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    page.drawImage(image, rect)
  } catch {
    try {
      const image = await doc.embedPng(bytes)
      page.drawImage(image, rect)
    } catch {
      // sin firma
    }
  }
}

function ahfValue(
  data: ExamenMedicoPDFData,
  key: string,
): string | null | undefined {
  const ahf = data.ahf
  if (key === '_tbc') return 'NEGADOS'
  if (key === '_reuma') return ahf.renales ?? 'NEGADOS'
  if (key === '_digestivos') return 'NEGADOS'
  if (key === 'hipertension') {
    const parts = [ahf.hipertension, ahf.cardiopatia].filter((x) => s(x) && !parseHf(x).negado)
    if (parts.length === 0) return ahf.hipertension ?? ahf.cardiopatia
    return parts.join('; ')
  }
  return (ahf as Record<string, string | null | undefined>)[key]
}

function fillHeredofamiliar(form: PdfForm, data: ExamenMedicoPDFData) {
  SODEXO_AHF_LEFT.forEach((row, i) => {
    const key = SODEXO_AHF_LEFT_KEYS[i]
    applyHfRow(form, row, ahfValue(data, key))
  })
  SODEXO_AHF_RIGHT.forEach((row, i) => {
    const key = SODEXO_AHF_RIGHT_KEYS[i]
    applyHfRow(form, row, ahfValue(data, key))
  })
}

function fillApnpTabaquismo(form: PdfForm, data: ExamenMedicoPDFData) {
  const tab = mapApnpNegadoSi(data.apnp.tabaco)
  if (tab === 'no') {
    setCheck(form, 'Check Box545', true)
  } else if (tab === 'si') {
    setCheck(form, 'Check Box546', true)
  }
  const alc = mapApnpNegadoSi(data.apnp.alcohol)
  if (alc === 'no') setCheck(form, 'Check Box550', true)
  else if (alc === 'si') setCheck(form, 'Check Box551', true)
  setText(form, 'Tipo de droga', data.apnp.drogas)
  setText(form, 'Ocasional', data.apnp.ejercicio)
}

/**
 * Genera el buffer PDF Sodexo a partir de la plantilla oficial y los datos
 * del examen médico ya consolidados en `ExamenMedicoPDFData`.
 */
export async function renderSodexoExamenMedicoPdf(
  data: ExamenMedicoPDFData,
): Promise<Buffer> {
  const templateBytes = await loadTemplateBytes()
  const doc = await PDFDocument.load(templateBytes)
  const form = doc.getForm()
  const ext = parseSodexoExt(data)
  const p = data.paciente

  setText(form, 'Texto9', 'CEM PRADO')
  setText(form, 'Texto10', p.puesto)

  const attention = splitDateParts(
    data.patientIdentification?.attentionDate ?? formatDateOnly(data.signedAt),
  )
  setText(form, 'Texto72', attention.day)
  setText(form, 'Texto73', attention.month)
  setText(form, 'Texto74', attention.year)

  const tipo = resolveTipoExamenCheckbox(ext, p.tipoExamen)
  setCheck(form, 'Check Box5', tipo === 'PREINGRESO')
  setCheck(form, 'Check Box4', tipo === 'PERIODICA')
  setCheck(form, 'Check Box6', tipo === 'RETIRO')
  setCheck(form, 'Check Box7', tipo === 'REINGRESO')

  setText(form, 'Nombre', p.nombreCompleto === '—' ? '' : p.nombreCompleto)
  setText(form, 'Fecha de nacimiento', p.fechaNacimiento)
  setText(form, 'Edad', p.edad?.replace(/\s*años?/i, '') ?? '')
  setText(form, 'Identidad de Genero', p.identidadGenero)
  const addr = splitAddress(p.direccion)
  setText(form, 'Calle o Av', addr.calle)
  setText(form, 'Colonia', addr.colonia)
  setText(form, 'CiudadMunicipio', addr.ciudad)

  const sex = mapSexCheckboxes(p.sexo)
  setCheck(form, 'Check Box8', sex.femenino)
  setCheck(form, 'Check Box9', sex.masculino)

  const ec = mapEstadoCivilCheckboxes(p.estadoCivil)
  setCheck(form, 'Check Box10', ec.soltero)
  setCheck(form, 'Check Box11', ec.casado)
  setCheck(form, 'Check Box12', ec.union)
  setCheck(form, 'Check Box13', ec.viudo)

  const esc = mapEscolaridadChecks(p.escolaridad)
  setCheck(form, SODEXO_ESCOLARIDAD_CHECKS.basica, esc.basica)
  setCheck(form, SODEXO_ESCOLARIDAD_CHECKS.media, esc.media)
  setCheck(form, SODEXO_ESCOLARIDAD_CHECKS.tecnica, esc.tecnica)
  setCheck(form, SODEXO_ESCOLARIDAD_CHECKS.universidad, esc.universidad)
  setCheck(form, SODEXO_ESCOLARIDAD_CHECKS.postgrado, esc.postgrado)

  if (ext) {
    setText(form, 'Contacto de Emergencia', ext.contacto_emergencia)
    setText(form, 'Tel de Emergencia', ext.telefono_emergencia)
    setText(form, 'Cargo', ext.actividades_cargo)
    setText(form, 'Fecha de ingreso', ext.fecha_ingreso_actividades)
    setText(form, 'Antigüedad', ext.antiguedad_actividades)
    setText(form, 'Cual', ext.tipo_actividad)
    setText(form, 'Texto26', ext.declaracion_protesta_nombre)
    setText(form, 'Texto27', ext.declaracion_protesta_nombre)
    setText(form, 'Texto28', ext.matriz_riesgos_observaciones)
  }

  fillSodexoMatrizRiesgos(form, ext, p.riesgosTrabajo)
  fillSodexoPdfFromExtension(form, ext)
  fillSodexoExtensionBlocks(form, ext)

  fillSodexoEpp(form, ext)

  fillSodexoHistoriaOcupacionalTabla(form, {
    ext,
    empresaActual: p.empresa,
    areaActual: p.area,
    puestoActual: p.puesto,
    narrativa: p.historiaOcupacional,
    riesgos: p.riesgosTrabajo,
  })

  fillHeredofamiliar(form, data)

  const patoExtras = fillSodexoPatologicos(form, data.patologicos)
  const aclaracion = [
    ext?.aclaracion_historia_personal,
    data.app,
    patoExtras,
  ]
    .filter(Boolean)
    .join('\n')
  setText(form, 'Texto529', aclaracion)
  fillSodexoInmunizaciones(
    form,
    data.modulo1 ?? {},
    data.inmunizaciones,
  )
  fillSodexoGineco(
    form,
    data.modulo1 ?? {},
    p.sexo,
    (data.patologicos as Record<string, unknown> | undefined)?.ginecologicos,
  )
  if (data.historiaGineco) {
    setText(form, 'Método de planificación', data.historiaGineco)
    setText(form, 'Ultima Citología', data.historiaGineco)
  }

  fillApnpTabaquismo(form, data)
  fillSodexoEstilosVida(form, data.apnp, ext?.estilos_vida_sodexo)

  const som = data.somatometria
  setText(form, 'Peso', som.peso)
  setText(form, 'Estatura', som.talla)
  setText(form, 'IMC', som.imc)
  setText(form, 'Pulso', som.fc)
  setText(form, 'FR', som.fr)
  setText(form, 'undefined', som.ta)
  if (som.temperatura) {
    setText(form, 'Texto577', `${som.temperatura} °C`)
  }

  const av = data.agudezaVisual
  setText(form, SODEXO_VISIOMETRIA_TEXT.lejanaOD, av.visionLejanaOD)
  setText(form, SODEXO_VISIOMETRIA_TEXT.lejanaOI, av.visionLejanaOI)
  setText(form, SODEXO_VISIOMETRIA_TEXT.lejanaCorregidaOD, av.lejanaCorregidaOD)
  setText(form, SODEXO_VISIOMETRIA_TEXT.lejanaCorregidaOI, av.lejanaCorregidaOI)
  setText(form, SODEXO_VISIOMETRIA_TEXT.cercanaOD, av.visionCercanaOD)
  setText(form, SODEXO_VISIOMETRIA_TEXT.cercanaOI, av.visionCercanaOI)
  setText(form, SODEXO_VISIOMETRIA_TEXT.cercanaCorregidaOD, av.cercanaCorregidaOD)
  setText(form, SODEXO_VISIOMETRIA_TEXT.cercanaCorregidaOI, av.cercanaCorregidaOI)
  setText(form, SODEXO_VISIOMETRIA_TEXT.observaciones, av.campimetria ?? av.ishihara)
  fillSodexoVisiometriaFromExtension(form, ext)

  const ex = data.exploracion
  setText(form, SODEXO_EXPLORACION_TEXT.neurologico, ex.neurologico)
  setText(form, SODEXO_EXPLORACION_TEXT.cabeza, ex.cabeza)
  setText(form, SODEXO_EXPLORACION_TEXT.piel_y_faneras, ex.piel_y_faneras)
  setText(form, SODEXO_EXPLORACION_TEXT.genitourinario, ex.genitourinario)
  setText(form, SODEXO_EXPLORACION_TEXT.ojos, ex.ojos)
  setText(
    form,
    SODEXO_EXPLORACION_TEXT.boca_faringe,
    [ex.boca_estado, ex.faringe, data.summary?.salud_bucal].filter(Boolean).join(' · '),
  )
  setText(form, SODEXO_EXPLORACION_TEXT.cuello, ex.cuello)
  setText(form, SODEXO_EXPLORACION_TEXT.torax, ex.torax)
  setText(
    form,
    SODEXO_EXPLORACION_TEXT.corazon_pulmones,
    [ex.corazon, ex.campos_pulmonares].filter(Boolean).join(' · '),
  )
  setText(form, SODEXO_EXPLORACION_TEXT.abdomen, ex.abdomen)
  setText(form, SODEXO_EXPLORACION_TEXT.oidos_cad, ex.oidos_cad)
  setText(form, SODEXO_EXPLORACION_TEXT.oidos_cai, ex.oidos_cai)
  setText(form, SODEXO_EXPLORACION_TEXT.nariz, ex.nariz)
  setText(form, SODEXO_EXPLORACION_TEXT.columna_vertebral, ex.columna_vertebral)
  setText(form, SODEXO_EXPLORACION_TEXT.ms_inferiores, ex.ms_inferiores)
  setText(form, SODEXO_EXPLORACION_TEXT.ms_superiores, ex.ms_superiores)
  setText(form, SODEXO_EXPLORACION_TEXT.salud_bucal, data.summary?.salud_bucal)

  fillSodexoExamenFisicoNormals(form, ex as Record<string, string | null | undefined>)

  const dxLines = splitLines(data.impresionDiagnostica, SODEXO_DIAGNOSTICOS_TEXT.length)
  SODEXO_DIAGNOSTICOS_TEXT.forEach((field, i) => setText(form, field, dxLines[i]))

  const restricciones = splitLines(data.restricciones, SODEXO_RESTRICCIONES_TEXT.length)
  SODEXO_RESTRICCIONES_TEXT.forEach((field, i) => setText(form, field, restricciones[i]))

  const reco = (data.recomendaciones ?? []).slice(0, 5)
  const obsParts = [
    reco.length ? `RECOMENDACIONES:\n${reco.map((r, i) => `${i + 1}. ${r}`).join('\n')}` : '',
    data.observacionesFinales ? `OBSERVACIONES: ${data.observacionesFinales}` : '',
    data.notaCondicionamiento ? `CONDICIONAMIENTO: ${data.notaCondicionamiento}` : '',
    data.aptitud ? `APTITUD: ${data.aptitud}` : '',
    data.slots?.audiometria ? `AUDIOMETRÍA: ${data.slots.audiometria}` : '',
    data.slots?.espirometria ? `ESPIROMETRÍA: ${data.slots.espirometria}` : '',
    data.slots?.laboratorios ? `LABORATORIOS: ${data.slots.laboratorios}` : '',
    data.slots?.radiografia ? `RADIOGRAFÍA: ${data.slots.radiografia}` : '',
    `Médico: ${data.medico.fullName} · Cédula: ${data.medico.professionalLicense}`,
  ].filter(Boolean)

  setText(
    form,
    'Observaciones generales y seguimiento SALUD OCUPACIONAL SODEXO MÉXICO 4',
    obsParts.join('\n\n'),
  )

  await embedSignature(doc, data.medico.signatureImageUrl, 3, {
    x: 380,
    y: 120,
    width: 140,
    height: 48,
  })

  try {
    form.updateFieldAppearances()
  } catch {
    // fuentes legacy
  }

  return Buffer.from(await doc.save())
}

function formatDateOnly(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function splitLines(text: string | null | undefined, max: number): string[] {
  const t = s(text)
  if (!t) return []
  const parts = t.split(/\n+|;\s*/).map((x) => x.trim()).filter(Boolean)
  if (parts.length <= max) return parts
  return parts.slice(0, max)
}
