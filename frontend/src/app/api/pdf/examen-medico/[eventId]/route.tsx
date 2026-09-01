/**
 * @fileoverview Endpoint autenticado para descargar el PDF consolidado de
 *   Examen Médico (AMI, 4 secciones) asociado a un `MedicalEvent`.
 *
 * @id IMPL-FEATURE-20260825-03
 * @backup context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md
 * @adr context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md
 * @qa context/reviews/QA-20260825-03-FEATURE-20260825-03.md (P1-1, P2-3, P3-1)
 * @finding discovery/FINDINGS.md FND-20260825-18
 *
 * Comportamiento:
 *  - Sesión activa OBLIGATORIA (paridad con `/api/pdf/espirometry` y
 *    `/api/pdf/audiometry`).
 *  - Autorización por OBJETO (IDOR fix + AC-10 / FND-20260825-18):
 *      · SUPERADMIN: cualquier Event.
 *      · DOCTOR_GENERAL / DOCTOR_VALIDATOR: cualquier Event (acceso clínico
 *        interno — la papeleta es la unidad de trabajo del médico).
 *      · COMPANY_CLIENT: **403** — el portal corporativo NO recibe el PDF
 *        clínico consolidado (PII clínica: AHF, APNP toxicomanías, APP,
 *        GO, exploración, firma). El portal corporativo sigue recibiendo
 *        el dictamen reducido por la ruta legacy `/api/pdf/[eventId]`
 *        (también autenticada ahora — ver P1-2).
 *      · Cualquier otro rol: 403.
 *  - Si NO existe `MedicalVerdict` firmado devuelve 404 ("Dictamen aún no
 *    emitido").
 *  - Si `physicalExamData.aptitud` está vacía devuelve 409 (P2-3: gate
 *    ADR R6 reforzado — el dictamen debe incluir aptitud canónica del
 *    médico).
 *  - Fast-path sirviendo desde disco (`MedicalVerdict.pdfUrl`) + path de
 *    regeneración en línea. Si la regeneración persiste el archivo en
 *    disco, `pdfUrl` se cablea en `MedicalVerdict` para acelerar la
 *    próxima descarga (P3-1).
 *  - Filename: `ExamenMedico-<universalId>.pdf` (paridad con
 *    `Dictamen-<universalId>.pdf` y `Espirometria-<universalId>.pdf`).
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import {
  generateExamenMedicoValidatedPdf,
  buildExamenMedicoPdfData,
  resolveAmiLogoDataUrl,
} from '@/lib/examen-medico-pdf'
import {
  buildHistoriaReproductivaModulo1Text,
  buildInmunizacionesFromPhysicalExam,
} from '@/lib/clinical/modulo1-text'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

const CLINICAL_ROLES = new Set<string>([
  'SUPERADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // AC-9 / ADR-R7 / FND-20260825-18: sesión obligatoria + scope por objeto.
  // El PDF consolidado de Examen Médico (4 secciones AMI con historial
  // clínico completo: AHF, APNP toxicomanías, APP, GO, exploración,
  // firma, recomendaciones) es PII clínica y NO debe exponerse al portal
  // corporativo. `COMPANY_CLIENT` se queda en el dictamen reducido que ya
  // sirve la ruta `/api/pdf/[eventId]` (legacy, ahora también
  // autenticada — ver fix P1-2). El check se hace ANTES del lookup para
  // no enumerar Eventos a roles no autorizados (paridad con
  // QA-20260825-01 P2-C).
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('No autenticado', { status: 401 })
  }
  const role = session.user.role
  const isSuperAdmin = role === 'SUPERADMIN'
  const isClinical = CLINICAL_ROLES.has(role)

  const { eventId } = await params
  if (!eventId) {
    return new NextResponse('eventId requerido', { status: 400 })
  }

  // AC-10 (FND-20260825-18, P1-1): el portal corporativo NO recibe
  // historia clínica. Sólo roles clínicos (SUPERADMIN/DOCTOR_*).
  if (!isClinical) {
    return new NextResponse(
      'Sin permisos para descargar el PDF clínico del examen médico.',
      { status: 403 }
    )
  }

  // ── Resolver Event + Verdict + Exam + perfil del paciente ───────────────
  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      worker: {
        select: {
          firstName: true,
          lastName: true,
          universalId: true,
          dob: true,
          companyId: true,
          company: { select: { name: true } },
          clinicalHistory: {
            select: { data: true },
          },
        },
      },
      exam: {
        select: {
          physicalExamData: true,
          eyeAcuityData: true,
          somatometryData: true,
          vitalSignsData: true,
        },
      },
      verdict: {
        select: {
          id: true,
          finalDiagnosis: true,
          recommendations: true,
          signedAt: true,
          pdfUrl: true,
          signatureHash: true,
          validator: {
            select: {
              id: true,
              fullName: true,
              professionalLicense: true,
              signatureImageUrl: true,
            },
          },
        },
      },
      studies: {
        select: {
          serviceName: true,
          aiPrediction: true,
          extractedData: true,
        },
      },
      labs: {
        select: {
          serviceName: true,
          aiPrediction: true,
          extractedData: true,
        },
      },
    },
  })

  if (!event) {
    return new NextResponse('Recurso no disponible', { status: 404 })
  }

  // ADR-R4/R6: el PDF requiere dictamen firmado con aptitud explícita del
  // médico. Sin verdict NO se genera.
  if (!event.verdict) {
    return new NextResponse(
      'El dictamen aún no ha sido emitido.',
      { status: 404 }
    )
  }

  // AC-6 + ADR-R4/R6: aptitud válida NO vacía. Sin esto NO se genera el
  // PDF clínico (el dictamen persistido debe incluir aptitud canónica).
  // Si falta, el médico aún no completó la revisión → 409 Conflict.
  const aptitudSnapshot = str(
    (event.exam?.physicalExamData as Record<string, unknown> | null)?.aptitud
  )
  if (!aptitudSnapshot) {
    return new NextResponse(
      'El dictamen no tiene aptitud registrada. El médico debe completar la aptitud antes de generar el PDF clínico.',
      { status: 409 }
    )
  }

  // Fast-path: si el PDF fue persistido en disco, servir desde ahí.
  const filename = `ExamenMedico-${event.worker.universalId}.pdf`
  if (event.verdict.pdfUrl) {
    try {
      const filePath = path.join(REPO_UPLOAD_DIR, event.verdict.pdfUrl)
      const buffer = await readFile(filePath)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'private, max-age=300',
        },
      })
    } catch (fsErr) {
      console.warn(
        '[IMPL-FEATURE-20260825-03] No se pudo leer PDF persistido, regenerando en línea:',
        fsErr,
      )
      // caer al path de regeneración
    }
  }

  // ── Regeneración en línea desde los snapshots congelados ───────────────
  try {
    const physicalExamData =
      (event.exam?.physicalExamData as Record<string, unknown> | null) ?? {}
    const eyeAcuity =
      (event.exam?.eyeAcuityData as Record<string, unknown> | null) ?? {}
    const somatometry =
      (event.exam?.somatometryData as Record<string, unknown> | null) ?? {}
    const vitalSigns =
      (event.exam?.vitalSignsData as Record<string, unknown> | null) ?? {}
    const clinicalHistoryData =
      (event.worker.clinicalHistory?.data as Record<string, unknown> | null) ??
      {}

    const dp =
      (clinicalHistoryData.datos_personales as Record<string, unknown>) ?? {}
    const hl =
      (clinicalHistoryData.historia_laboral as Record<string, unknown>) ?? {}
    const ahf =
      (clinicalHistoryData.heredo_familiares as Record<string, unknown>) ?? {}
    const apnp =
      (clinicalHistoryData.no_patologicos as Record<string, unknown>) ?? {}

    // APP: texto consolidado de los slots por prueba (mismo fallback que
    // `buildVerdictFromExam`).
    const appParts: string[] = []
    const slotsTexts = [
      ['Examen médico', str(physicalExamData.examen_medico_texto)],
      ['Audiometría', str(physicalExamData.audiometria_texto)],
      ['Espirometría', str(physicalExamData.espirometria_texto)],
      ['Laboratorios', str(physicalExamData.laboratorios_texto)],
      ['Radiografía', str(physicalExamData.radiografia_texto)],
    ] as const
    for (const [label, val] of slotsTexts) {
      if (val) appParts.push(`${label}: ${val}`)
    }
    const appTexto = appParts.length > 0
      ? appParts.join('. ')
      : str(physicalExamData.impresion_diagnostica) // DA-1 legacy fallback

    // TA (tensión arterial) — construir a partir de somatometry + vitalSigns.
    const taSist = numOrNull(somatometry.ta_sistolica ?? vitalSigns.ta_sistolica)
    const taDiast = numOrNull(somatometry.ta_diastolica ?? vitalSigns.ta_diastolica)
    const ta = taSist !== null && taDiast !== null ? `${taSist}/${taDiast}` : null

    // IA results — sólo para alimentar las recomendaciones auto-pobladas.
    const audioIa = pickIaByName(event.studies, [
      'audiometria',
      'audiometría',
      'audiometry',
    ])
    const espiroIa = pickIaByName(event.studies, [
      'espirometria',
      'espirometría',
      'spirometry',
    ])
    const labsIa = event.labs?.[0] ?? null
    const radioIa = pickIaByName(event.studies, [
      'radiografia',
      'radiografía',
      'rx',
      'rayos x',
    ])

    // Logo AMI (cacheado en memoria).
    const logoDataUrl = await resolveAmiLogoDataUrl()

    // Identidad del médico: el snapshot congelado vive en el validador
    // actual del Verdict (User). Si por algún motivo falta la cédula o la
    // firma, NO se genera el PDF (gate §R6).
    const validator = event.verdict.validator
    if (
      !validator ||
      !validator.fullName ||
      !validator.professionalLicense ||
      !validator.signatureImageUrl
    ) {
      return new NextResponse(
        'El médico firmante no tiene identidad congelada completa (cédula/firma). El PDF no puede regenerarse. Completa el perfil médico y vuelve a firmar.',
        { status: 410 }
      )
    }

    // Recomendaciones: el snapshot persistido por el médico
    // (`MedicalVerdict.recommendations`) tiene prioridad sobre el
    // auto-poblamiento. El auto-poblamiento sirve como base si el médico
    // no escribió nada (DA-7).
    const recomendacionesPersisted = str(event.verdict.recommendations)

    const data = buildExamenMedicoPdfData({
      folio: event.verdict.id,
      signedAt: event.verdict.signedAt,
      status: 'SIGNED',
      worker: {
        firstName: event.worker.firstName ?? '',
        lastName: event.worker.lastName ?? '',
        universalId: event.worker.universalId ?? '',
        dob: event.worker.dob ?? null,
        sexo: str(physicalExamData.sexo ?? dp.sexo),
        identidadGenero: str(physicalExamData.identidad_genero ?? dp.identidad_genero),
        empresa: event.worker.company?.name ?? null,
        puesto: str(dp.puesto_actual),
        area: str(dp.area_departamento),
        tipoExamen: str(physicalExamData.tipo_examen),
        direccion: str(dp.direccion),
        estadoCivil: str(dp.estado_civil),
        escolaridad: str(dp.escolaridad),
        tipoSanguineo: str(apnp.grupo_y_rh),
      },
      ahf: {
        diabetes: str(ahf.diabetes),
        hipertension: str(ahf.has ?? ahf.hipertension),
        epilepsia: str(ahf.epilepsia),
        cardiopatia: str(ahf.cardiopatia),
        renales: str(ahf.renales),
        asma: str(ahf.asma),
        cancer: str(ahf.cancer),
        mentales: str(ahf.mentales),
        otras:
          str(ahf.otras) || str(ahf.otras_especifique)
            ? `${str(ahf.otras)}${str(ahf.otras_especifique) ? ` (${str(ahf.otras_especifique)})` : ''}`
            : null,
      },
      apnp: {
        alcohol: str(apnp.alcohol),
        tabaco: str(apnp.tabaco),
        drogas: str(apnp.drogas_estimulantes),
        ejercicio: str(apnp.ejercicio),
        alimentacion: str(apnp.alimentacion),
        tatuajes: str(apnp.tatuajes),
      },
      historiaOcupacional: {
        empresa: event.worker.company?.name ?? null,
        puesto: str(dp.puesto_actual),
        area: str(dp.area_departamento),
        narrativa:
          [
            hl.empresa_anterior_1 && `Anterior 1: ${str(hl.empresa_anterior_1)} (${str(hl.puesto_anterior_1)}, ${str(hl.tiempo_anterior_1)})`,
            hl.empresa_anterior_2 && `Anterior 2: ${str(hl.empresa_anterior_2)} (${str(hl.puesto_anterior_2)}, ${str(hl.tiempo_anterior_2)})`,
            hl.exposicion_quimica && `Exposición química: ${str(hl.exposicion_quimica_especifique) || 'Sí'}`,
            hl.exposicion_fisica && `Exposición física: ${str(hl.exposicion_fisica_especifique) || 'Sí'}`,
            hl.exposicion_biologica && `Exposición biológica: ${str(hl.exposicion_biologica_especifique) || 'Sí'}`,
            hl.exposicion_ergonomica && `Exposición ergonómica: ${str(hl.exposicion_ergonomica_especifique) || 'Sí'}`,
          ]
            .filter(Boolean)
            .join('. ') || null,
        riesgos:
          [
            hl.accidentes_trabajo && `Accidentes laborales: ${str(hl.accidentes_descripcion) || 'Sí'}`,
            hl.enfermedades_trabajo && `Enfermedades laborales: ${str(hl.enfermedades_descripcion) || 'Sí'}`,
          ]
            .filter(Boolean)
            .join('. ') || null,
        epp: null,
      },
      app: {
        texto: appTexto,
      },
      historiaGineco: buildHistoriaReproductivaModulo1Text(physicalExamData),
      inmunizaciones: buildInmunizacionesFromPhysicalExam(physicalExamData),
      somatometria: {
        peso: numOrStr(somatometry.peso_kg ?? vitalSigns.peso_kg),
        talla: numOrStr(somatometry.talla_m ?? vitalSigns.talla_m),
        imc: numOrStr(somatometry.imc ?? vitalSigns.imc),
        cintura: numOrStr(somatometry.perimetro_cintura ?? vitalSigns.perimetro_cintura),
        cadera: numOrStr(somatometry.perimetro_cadera ?? vitalSigns.perimetro_cadera),
        ta,
        fc: numOrStr(somatometry.fc_min ?? vitalSigns.fc_min),
        fr: numOrStr(somatometry.fr_min ?? vitalSigns.fr_min),
        temperatura: numOrStr(somatometry.temperatura ?? vitalSigns.temperatura),
      },
      agudezaVisual: {
        visionLejanaOD: str(eyeAcuity.vision_lejana_od),
        visionLejanaOI: str(eyeAcuity.vision_lejana_oi),
        visionCercanaOD: str(eyeAcuity.vision_cercana_od),
        visionCercanaOI: str(eyeAcuity.vision_cercana_oi),
        lejanaCorregidaOD: str(eyeAcuity.lejana_corregida_od),
        lejanaCorregidaOI: str(eyeAcuity.lejana_corregida_oi),
        cercanaCorregidaOD: str(eyeAcuity.cercana_corregida_od),
        cercanaCorregidaOI: str(eyeAcuity.cercana_corregida_oi),
        reflejos: str(eyeAcuity.reflejos),
        ishihara: str(eyeAcuity.test_ishihara),
        campimetria: str(eyeAcuity.campimetria),
      },
      exploracion: {
        neurologico: str(physicalExamData.neurologico),
        cabeza: str(physicalExamData.cabeza),
        piel_y_faneras: str(physicalExamData.piel_y_faneras),
        oidos_cad: str(physicalExamData.oidos_cad),
        oidos_cai: str(physicalExamData.oidos_cai),
        ojos: str(physicalExamData.ojos),
        boca_estado: str(physicalExamData.boca_estado),
        boca_alineacion: str(physicalExamData.boca_alineacion),
        nariz: str(physicalExamData.nariz),
        faringe: str(physicalExamData.faringe),
        cuello: str(physicalExamData.cuello),
        torax: str(physicalExamData.torax),
        corazon: str(physicalExamData.corazon),
        campos_pulmonares: str(physicalExamData.campos_pulmonares),
        abdomen: str(physicalExamData.abdomen),
        genitourinario: str(physicalExamData.genitourinario),
        columna_vertebral: str(physicalExamData.columna_vertebral),
        test_adam: str(physicalExamData.test_adam),
        ms_superiores: str(physicalExamData.ms_superiores),
        fuerza_muscular_daniels_sup: str(physicalExamData.fuerza_muscular_daniels_sup),
        ms_inferiores: str(physicalExamData.ms_inferiores),
        fuerza_muscular_daniels_inf: str(physicalExamData.fuerza_muscular_daniels_inf),
        circulacion_venosa: str(physicalExamData.circulacion_venosa),
        arco_de_movilidad: str(physicalExamData.arco_de_movilidad),
        tono_muscular: str(physicalExamData.tono_muscular),
        coordinacion: str(physicalExamData.coordinacion),
        test_romberg: str(physicalExamData.test_romberg),
        signo_bragard: str(physicalExamData.signo_bragard),
        prueba_finkelstein: str(physicalExamData.prueba_finkelstein),
        signo_tinel: str(physicalExamData.signo_tinel),
        prueba_phanel: str(physicalExamData.prueba_phanel),
        prueba_lasegue: str(physicalExamData.prueba_lasegue),
        presencia_quiste_sinovial: str(physicalExamData.presencia_quiste_sinovial),
      },
      impresionDiagnostica: str(event.verdict.finalDiagnosis),
      aptitud: str(physicalExamData.aptitud),
      restricciones: str(physicalExamData.restricciones),
      observacionesFinales: str(physicalExamData.observaciones_finales),
      notaCondicionamiento: buildComacionamientoText(
        audioIa,
        espiroIa,
        radioIa,
        labsIa,
        physicalExamData
      ),
      medico: {
        fullName: validator.fullName,
        professionalLicense: validator.professionalLicense,
        signatureImageUrl: validator.signatureImageUrl,
      },
      slots: {
        audiometria: str(physicalExamData.audiometria_texto),
        espirometria: str(physicalExamData.espirometria_texto),
        laboratorios: str(physicalExamData.laboratorios_texto),
        radiografia: str(physicalExamData.radiografia_texto),
        examenMedico: str(physicalExamData.examen_medico_texto),
      },
      ia: {
        audiometriaClasificacion:
          pickIaField(audioIa, ['clasificacion', 'classification']) ??
          str(audioIa?.aiPrediction) ??
          null,
        espirometriaPatron:
          pickIaField(espiroIa, ['patron', 'pattern']) ??
          str(espiroIa?.aiPrediction) ??
          null,
        radiografiaHallazgo:
          pickIaField(radioIa, ['hallazgo', 'finding']) ??
          str(radioIa?.aiPrediction) ??
          null,
        laboratorioOutOfRange:
          pickIaFieldBool(labsIa, ['out_of_range', 'outOfRange']) ??
          null,
      },
      logoDataUrl,
    })

    // Override de recomendaciones: persistidas por el médico tienen
    // prioridad sobre el auto-poblamiento (DA-7).
    let finalRecomendaciones = data.recomendaciones
    if (recomendacionesPersisted) {
      finalRecomendaciones = recomendacionesPersisted
        .split(/\s*\d+\.\-\s+/)
        .map(r => r.trim())
        .filter(r => r.length > 0)
      data.recomendaciones = finalRecomendaciones
    }

    const result = await generateExamenMedicoValidatedPdf({
      data,
      eventId: event.id,
    })

    // P3-1 (QA-20260825-03): cablear el fast-path. Si la persistencia en
    // disco fue exitosa y `verdict.pdfUrl` aún está vacío, lo escribimos
    // para que la próxima descarga use el fast-path. Paridad con la ruta
    // `/api/pdf/espirometry/[reviewId]` (QA-20260825-01 P3-E).
    if (result.url && !event.verdict.pdfUrl) {
      try {
        await prisma.medicalVerdict.update({
          where: { eventId: event.id },
          data: { pdfUrl: result.url },
        })
      } catch (persistErr) {
        console.warn(
          '[IMPL-FEATURE-20260825-03] No se pudo persistir pdfUrl en MedicalVerdict:',
          persistErr
        )
      }
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    console.error(
      '[IMPL-FEATURE-20260825-03] Error generando PDF en línea:',
      err
    )
    return new NextResponse(
      'Error al regenerar el PDF validado del examen médico.',
      { status: 500 }
    )
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers internos (no exportados — el route es el único callsite)
// ──────────────────────────────────────────────────────────────────────────

/** String seguro: null/undefined → ''. */
function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/** Numérico o null. Acepta string numérica válida. */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Numérico como string ('' si no numérico). */
function numOrStr(v: unknown): string {
  const n = numOrNull(v)
  return n === null ? '' : String(n)
}

/** Busca un `StudyRecord` por nombre (case-insensitive, incluye acentos). */
function pickIaByName(
  studies: ReadonlyArray<{ serviceName: string; aiPrediction: string | null; extractedData: unknown }>,
  candidates: ReadonlyArray<string>
): { aiPrediction: string | null; extractedData: unknown } | null {
  if (!studies || studies.length === 0) return null
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const s of studies) {
    const target = norm(s.serviceName)
    if (candidates.some(c => target.includes(norm(c)))) {
      return { aiPrediction: s.aiPrediction, extractedData: s.extractedData }
    }
  }
  return null
}

/** Lee una key del `extractedData` IA (object). */
function pickIaField(
  ia: { aiPrediction: string | null; extractedData: unknown } | null,
  keys: ReadonlyArray<string>
): string | null {
  if (!ia || !ia.extractedData || typeof ia.extractedData !== 'object') {
    return null
  }
  const obj = ia.extractedData as Record<string, unknown>
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  // Búsqueda anidada 1 nivel.
  for (const k of Object.keys(obj)) {
    const sub = obj[k]
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      for (const kk of keys) {
        const v = (sub as Record<string, unknown>)[kk]
        if (typeof v === 'string' && v.trim().length > 0) return v.trim()
      }
    }
  }
  return null
}

/** Lee una key booleana del `extractedData` IA. */
function pickIaFieldBool(
  ia: { aiPrediction: string | null; extractedData: unknown } | null,
  keys: ReadonlyArray<string>
): boolean | null {
  if (!ia || !ia.extractedData || typeof ia.extractedData !== 'object') {
    return null
  }
  const obj = ia.extractedData as Record<string, unknown>
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'boolean') return v
  }
  return null
}

/**
 * Construye la nota de condicionamiento por estudios paraclínicos.
 * Aparece cuando la aptitud está condicionada por resultados de
 * estudios pendientes/alterados. Conservador: NO afirma nada que no
 * sea visible en los snapshots.
 */
function buildComacionamientoText(
  audioIa: { aiPrediction: string | null; extractedData: unknown } | null,
  espiroIa: { aiPrediction: string | null; extractedData: unknown } | null,
  radioIa: { aiPrediction: string | null; extractedData: unknown } | null,
  labsIa: { aiPrediction: string | null; extractedData: unknown } | null,
  ped: Record<string, unknown>
): string | null {
  const aptitud = str(ped.aptitud).toUpperCase()
  const pendiente =
    aptitud === 'PENDIENTE DE RESULTADOS' ||
    aptitud === 'APTO CONDICIONADO' ||
    aptitud === 'APTO CON RESTRICCIONES'
  if (!pendiente) return null

  const reasons: string[] = []
  if (audioIa?.aiPrediction) reasons.push('Audiometría con hallazgos pendientes de correlación clínica.')
  if (espiroIa?.aiPrediction) reasons.push('Espirometría con hallazgos pendientes de correlación clínica.')
  if (radioIa?.aiPrediction) reasons.push('Radiografía con hallazgos pendientes de correlación clínica.')
  if (labsIa?.aiPrediction) reasons.push('Laboratorios con hallazgos fuera de rango pendientes de correlación clínica.')
  if (!str(ped.examen_medico_texto)) reasons.push('Texto diagnóstico del examen físico pendiente.')

  return reasons.length > 0 ? reasons.join(' ') : null
}