/**
 * @file Builder compartido del dictamen general consolidado AMI.
 *
 *   Este módulo es el puente entre el ZIP de cierre clínico
 *   (`zip-cierre-clinico.ts`), la action de re-emisión
 *   (`signature.actions.tsx:reemitSignedDictamen`) y cualquier otro
 *   consumidor que necesite el dictamen general consolidado por
 *   `appointmentId + workerId` en formato AMI (4 bloques).
 *
 *   **REGLA DE ORO (IMPL-20260826-08 / FND-20260826-03 / DEC-20260826-01
 *   / BR-20260826-01 / BR-20260826-02):**
 *   - NO inventar datos: todos los campos provienen del snapshot
 *     persistido en Prisma (`MedicalEvent`, `MedicalExam`,
 *     `MedicalVerdict`, `EventTest`, `LabRecord`).
 *   - El consolidado selecciona Events hermanos vía
 *     `findSiblingEventsInAtencion` (mismo helper que el ZIP y la
 *     re-emisión).
 *   - Si el consolidado sólo contiene el Event actual (caso
 *     pre-migración 1:1), el renderer del AMI sigue funcionando sin
 *     mostrar el bloque "Hallazgos de la Atención" (defensa en
 *     profundidad).
 *
 *   @id IMPL-20260826-08 (FIX pantalla PDF antiguo, FND-20260826-03)
 *   @finding discovery/FINDINGS.md FND-20260826-03
 *   @decision discovery/DECISIONS.md DEC-20260826-01
 *   @businessRule discovery/BUSINESS-RULES.md BR-20260826-01
 *   @businessRule discovery/BUSINESS-RULES.md BR-20260826-02
 *
 *   ## Defensa contra fugas entre pacientes (BR-20260826-02)
 *
 *   El helper pasa `workerId` en la consulta de Events hermanos
 *   (`findSiblingEventsInAtencion`) para que NO se mezclen Events de
 *   otros pacientes que compartan cita.
 */

import type { PrismaClient } from '@prisma/client'
import { findSiblingEventsInAtencion, type AtencionResolution } from '@/lib/event-atencion'
import { buildExamenMedicoPdfData, type BuildExamenMedicoPdfInput } from '@/lib/examen-medico-pdf'

/**
 * IMPL-20260826-08: helper de extracción segura de strings. Devuelve
 * `null` si el valor es null/undefined/string vacío.
 *
 * NO reemplaza con defaults. La función NO inventa datos.
 */
function s(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const t = value.trim()
    return t.length === 0 ? null : t
  }
  if (typeof value === 'number') {
    const n = Number.isFinite(value) ? String(value) : null
    return n
  }
  return null
}

export interface ConsolidadoAmiResult {
  /** Data shape lista para `buildExamenMedicoPdfData(...)` + `consolidatedEvents`. */
  data: BuildExamenMedicoPdfInput
  /** Resultado del helper de sibling events (para manifest/log). */
  atencionResolution: AtencionResolution
  /** `MedicalVerdict` actual (puede ser `null` si aún no se emitió). */
  verdict: {
    id: string
    finalDiagnosis: string
    recommendations: string | null
    signedAt: Date | null
    signatureHash: string | null
    pdfUrl: string | null
  } | null
}

/**
 * Construye el payload del dictamen general consolidado para el
 * formato AMI vigente (`ExamenMedicoValidatedPDF`). Resuelve:
 *   - El Event actual + su `MedicalExam` + su `MedicalVerdict` + sus
 *     `EventTest` + sus `LabRecord` + su Validador.
 *   - Los Events hermanos del mismo `appointmentId + workerId`
 *     (post-migración IMPL-20260826-07 N:1) — sólo para construir el
 *     bloque `consolidatedEvents` que el renderer pinta como
 *     "Hallazgos de la Atención/Cita".
 *
 *   Si el Event no tiene cita (walk-in) o no tiene Verdict, lanza un
 * `Error` con mensaje específico. NO inventa datos.
 *
 *   **Importante**: este builder NO genera el PDF — sólo el payload
 *   para el renderer. La generación del buffer se hace en el call-site
 *   (`generateExamenMedicoValidatedPdf`).
 *
 * @param eventId  ID del `MedicalEvent`.
 * @param prisma   Cliente Prisma inyectable (testeable).
 * @returns Estructura con `data` lista para el renderer, `atencionResolution` y `verdict`.
 * @throws Error si el Event no existe, no tiene Verdict o no tiene Validador.
 */
export async function buildDictamenGeneralAmiConsolidado(
  eventId: string,
  prisma: PrismaClient,
): Promise<ConsolidadoAmiResult> {
  // 1) Cargar Event completo con Verdict + Exam + Studies + Labs + Worker + Branch + Validador.
  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    include: {
      worker: {
        select: {
          firstName: true,
          lastName: true,
          universalId: true,
          dob: true,
          nationalId: true,
          company: { select: { name: true } },
        },
      },
      branch: {
        select: { name: true, address: true },
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
          signatureHash: true,
          pdfUrl: true,
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
    throw new Error(`Event no encontrado: ${eventId}`)
  }

  if (!event.verdict) {
    throw new Error(`No hay dictamen emitido para este Event.`)
  }

  if (!event.verdict.validator?.fullName) {
    throw new Error(`El médico firmante no tiene identidad registrada.`)
  }

  // 2) Resolver Events hermanos (BR-20260826-01 + BR-20260826-02).
  const atencionResolution = await findSiblingEventsInAtencion(event.id, prisma)
  const siblingIds = atencionResolution.eventIds.filter((id) => id !== event.id)

  // 3) Si hay siblings, cargar sus Studies + Labs para consolidar hallazgos.
  const siblingEventsRaw =
    siblingIds.length > 0
      ? await prisma.medicalEvent.findMany({
          where: { id: { in: siblingIds } },
          select: {
            id: true,
            studies: { select: { serviceName: true, extractedData: true } },
            labs: { select: { serviceName: true, extractedData: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
      : []

  // 4) Construir el consolidado (bloque para el renderer AMI).
  const derivedEventShortId = (id: string): string =>
    id.split('-')[0]?.toUpperCase() ?? ''

  const consolidatedEvents: BuildExamenMedicoPdfInput['consolidatedEvents'] = [
    {
      eventId: event.id,
      eventShortId: derivedEventShortId(event.id),
      isCurrent: true,
      studies: (event.studies ?? []).map((s) => ({
        serviceName: s.serviceName,
        extractedData: s.extractedData ?? null,
      })),
      labs: (event.labs ?? []).map((l) => ({
        serviceName: l.serviceName,
        extractedData: l.extractedData ?? null,
      })),
    },
    ...siblingEventsRaw.map((sib) => ({
      eventId: sib.id,
      eventShortId: derivedEventShortId(sib.id),
      isCurrent: false,
      studies: (sib.studies ?? []).map((st) => ({
        serviceName: st.serviceName,
        extractedData: st.extractedData ?? null,
      })),
      labs: (sib.labs ?? []).map((lb) => ({
        serviceName: lb.serviceName,
        extractedData: lb.extractedData ?? null,
      })),
    })),
  ]

  // 5) Extraer campos del `physicalExamData` (no se inventan defaults).
  const physicalExamData =
    (event.exam?.physicalExamData as Record<string, unknown> | null) ?? {}
  const eyeAcuity = (event.exam?.eyeAcuityData as Record<string, unknown> | null) ?? {}
  const somatometry = (event.exam?.somatometryData as Record<string, unknown> | null) ?? {}
  const vitalSigns = (event.exam?.vitalSignsData as Record<string, unknown> | null) ?? {}
  const dp = (physicalExamData.datos_personales as Record<string, unknown> | null) ?? {}
  const ahf = (physicalExamData.antecedentes_heredofamiliares as Record<string, unknown> | null) ?? {}
  const apnp = (physicalExamData.antecedentes_personales_no_patologicos as Record<string, unknown> | null) ?? {}

  const aptitud = s(physicalExamData.aptitud)
  const ta = s(physicalExamData.ta ?? vitalSigns.ta) ?? s(physicalExamData.tension_arterial ?? vitalSigns.tension_arterial)
  const appTexto =
    s(physicalExamData.app) ||
    s(physicalExamData.antecedentes_personales_patologicos) ||
    s(physicalExamData.app_texto) ||
    null

  // 6) Construir el payload AMI (BuildExamenMedicoPdfInput).
  const validator = event.verdict.validator

  const data: BuildExamenMedicoPdfInput = {
    folio: event.verdict.id,
    signedAt: event.verdict.signedAt ?? new Date(),
    status: 'SIGNED',
    worker: {
      firstName: event.worker.firstName ?? '',
      lastName: event.worker.lastName ?? '',
      universalId: event.worker.universalId ?? '',
      dob: event.worker.dob ?? null,
      sexo: s(physicalExamData.sexo ?? dp.sexo),
      identidadGenero: s(physicalExamData.identidad_genero ?? dp.identidad_genero),
      empresa: event.worker.company?.name ?? null,
      puesto: s(dp.puesto_actual),
      area: s(dp.area_departamento),
      tipoExamen: s(physicalExamData.tipo_examen),
      direccion: s(dp.direccion),
      estadoCivil: s(dp.estado_civil),
      escolaridad: s(dp.escolaridad),
      tipoSanguineo: s(apnp.grupo_y_rh),
    },
    ahf: {
      diabetes: s(ahf.diabetes),
      hipertension: s(ahf.has ?? ahf.hipertension),
      epilepsia: s(ahf.epilepsia),
      cardiopatia: s(ahf.cardiopatia),
      renales: s(ahf.renales),
      asma: s(ahf.asma),
      cancer: s(ahf.cancer),
      mentales: s(ahf.mentales),
      otras: s(ahf.otras) || s(ahf.otras_especifique)
        ? `${s(ahf.otras) ?? ''}${s(ahf.otras_especifique) ? ` (${s(ahf.otras_especifique)})` : ''}`
        : null,
    },
    apnp: {
      alcohol: s(apnp.alcohol),
      tabaco: s(apnp.tabaco),
      drogas: s(apnp.drogas_estimulantes),
      ejercicio: s(apnp.ejercicio),
      alimentacion: s(apnp.alimentacion),
      tatuajes: s(apnp.tatuajes),
    },
    historiaOcupacional: {
      empresa: event.worker.company?.name ?? null,
      puesto: s(dp.puesto_actual),
      area: s(dp.area_departamento),
      narrativa: null,
      riesgos: null,
      epp: null,
    },
    app: { texto: appTexto },
    historiaGineco: null,
    inmunizaciones: null,
    somatometria: {
      peso: s(somatometry.peso_kg ?? vitalSigns.peso_kg),
      talla: s(somatometry.talla_m ?? vitalSigns.talla_m),
      imc: s(somatometry.imc ?? vitalSigns.imc),
      cintura: s(somatometry.perimetro_cintura ?? vitalSigns.perimetro_cintura),
      cadera: s(somatometry.perimetro_cadera ?? vitalSigns.perimetro_cadera),
      ta,
      fc: s(somatometry.fc_min ?? vitalSigns.fc_min),
      fr: s(somatometry.fr_min ?? vitalSigns.fr_min),
      temperatura: s(somatometry.temperatura ?? vitalSigns.temperatura),
    },
    agudezaVisual: {
      visionLejanaOD: s(eyeAcuity.vision_lejana_od),
      visionLejanaOI: s(eyeAcuity.vision_lejana_oi),
      visionCercanaOD: s(eyeAcuity.vision_cercana_od),
      visionCercanaOI: s(eyeAcuity.vision_cercana_oi),
      lejanaCorregidaOD: s(eyeAcuity.lejana_corregida_od),
      lejanaCorregidaOI: s(eyeAcuity.lejana_corregida_oi),
      cercanaCorregidaOD: s(eyeAcuity.cercana_corregida_od),
      cercanaCorregidaOI: s(eyeAcuity.cercana_corregida_oi),
      reflejos: s(eyeAcuity.reflejos),
      ishihara: s(eyeAcuity.test_ishihara),
      campimetria: s(eyeAcuity.campimetria),
    },
    exploracion: {
      neurologico: s(physicalExamData.neurologico) ?? '',
      cabeza: s(physicalExamData.cabeza) ?? '',
      piel_y_faneras: s(physicalExamData.piel_y_faneras) ?? '',
      oidos_cad: s(physicalExamData.oidos_cad) ?? '',
      oidos_cai: s(physicalExamData.oidos_cai) ?? '',
      ojos: s(physicalExamData.ojos) ?? '',
      boca_estado: s(physicalExamData.boca_estado) ?? '',
      boca_alineacion: s(physicalExamData.boca_alineacion) ?? '',
      nariz: s(physicalExamData.nariz) ?? '',
      faringe: s(physicalExamData.faringe) ?? '',
      cuello: s(physicalExamData.cuello) ?? '',
      torax: s(physicalExamData.torax) ?? '',
      corazon: s(physicalExamData.corazon) ?? '',
      campos_pulmonares: s(physicalExamData.campos_pulmonares) ?? '',
      abdomen: s(physicalExamData.abdomen) ?? '',
      genitourinario: s(physicalExamData.genitourinario) ?? '',
      columna_vertebral: s(physicalExamData.columna_vertebral) ?? '',
      test_adam: s(physicalExamData.test_adam) ?? '',
      ms_superiores: s(physicalExamData.ms_superiores) ?? '',
      fuerza_muscular_daniels_sup: s(physicalExamData.fuerza_muscular_daniels_sup) ?? '',
      ms_inferiores: s(physicalExamData.ms_inferiores) ?? '',
      fuerza_muscular_daniels_inf: s(physicalExamData.fuerza_muscular_daniels_inf) ?? '',
      circulacion_venosa: s(physicalExamData.circulacion_venosa) ?? '',
      arco_de_movilidad: s(physicalExamData.arco_de_movilidad) ?? '',
      tono_muscular: s(physicalExamData.tono_muscular) ?? '',
      coordinacion: s(physicalExamData.coordinacion) ?? '',
      test_romberg: s(physicalExamData.test_romberg) ?? '',
      signo_bragard: s(physicalExamData.signo_bragard) ?? '',
      prueba_finkelstein: s(physicalExamData.prueba_finkelstein) ?? '',
      signo_tinel: s(physicalExamData.signo_tinel) ?? '',
      prueba_phanel: s(physicalExamData.prueba_phanel) ?? '',
      prueba_lasegue: s(physicalExamData.prueba_lasegue) ?? '',
      presencia_quiste_sinovial: s(physicalExamData.presencia_quiste_sinovial) ?? '',
    },
    impresionDiagnostica: s(event.verdict.finalDiagnosis) ?? '',
    aptitud: aptitud ?? '',
    restricciones: s(physicalExamData.restricciones) ?? '',
    observacionesFinales: s(physicalExamData.observaciones_finales) ?? '',
    notaCondicionamiento: null,
    medico: {
      fullName: validator.fullName,
      professionalLicense: validator.professionalLicense ?? '',
      signatureImageUrl: validator.signatureImageUrl ?? '',
    },
    slots: {
      audiometria: s(physicalExamData.audiometria_texto),
      espirometria: s(physicalExamData.espirometria_texto),
      laboratorios: s(physicalExamData.laboratorios_texto),
      radiografia: s(physicalExamData.radiografia_texto),
      examenMedico: s(physicalExamData.examen_medico_texto),
    },
    ia: null,
    logoDataUrl: null,
    consolidatedEvents,
  }

  return {
    data,
    atencionResolution,
    verdict: {
      id: event.verdict.id,
      finalDiagnosis: event.verdict.finalDiagnosis,
      recommendations: event.verdict.recommendations ?? null,
      signedAt: event.verdict.signedAt ?? null,
      signatureHash: event.verdict.signatureHash ?? null,
      pdfUrl: event.verdict.pdfUrl ?? null,
    },
  }
}

/**
 * Helper puro (testeable sin Prisma): determina si la resolución de
 * atención tiene más de un Event consolidado (es decir, hay
 * consolidación real).
 */
export function hasConsolidation(atencionResolution: AtencionResolution): boolean {
  return atencionResolution.eventIds.length > 1
}
