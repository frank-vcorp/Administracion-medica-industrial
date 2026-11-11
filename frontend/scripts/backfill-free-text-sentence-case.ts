/**
 * SME-106 — Backfill único: modo oración en texto libre ya persistido.
 *
 *   npx tsx scripts/backfill-free-text-sentence-case.ts --dry-run
 *   npx tsx scripts/backfill-free-text-sentence-case.ts --execute
 *
 * Tablas / columnas tocadas (escalares):
 *   - workers: firstName, lastName
 *   - appointments: notes, identityExceptionComment, cancellationReason
 *   - medical_events: cancellationReason
 *   - event_tests: resultNotes; clinicalContext (Json)
 *   - medical_exams: eyeAcuityData, physicalExamData, somatometryData, vitalSignsData (Json)
 *   - study_records: validatorNotes; extractedData (Json)
 *   - clinical_histories: data (Json antecedentes / módulo 1)
 *   - satisfaction_surveys: comentario
 *   - medical_profiles: specialNotes
 *   - medical_verdicts: finalDiagnosis, recommendations
 *   - doctor_study_reviews: doctorDiagnosis, doctorNotes, doctorRecommendations, doctorFeedbackNote
 *   - prefilled_invitations: module1Data (Json)
 *
 * NO toca: emails, teléfonos, URLs, RFC, cédulas, códigos CIE, campos JSON con claves
 * de exclusión (ver migrate-sentence-case.ts).
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'
import {
  migrateFreeTextString,
  migrateJsonFreeText,
} from '../src/lib/text/migrate-sentence-case'

const FRONTEND_DIR = path.resolve(__dirname, '..')

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx <= 0) continue
    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function maybeString(
  value: string | null | undefined,
  field: string,
): string | null | undefined {
  if (value == null) return value
  return migrateFreeTextString(value, field)
}

function maybeJson(value: Prisma.JsonValue | null, field: string): Prisma.JsonValue | null {
  if (value === null) return null
  return migrateJsonFreeText(value, field) as Prisma.JsonValue
}

async function main(): Promise<void> {
  loadEnvFile(path.join(FRONTEND_DIR, '.env.local'))
  loadEnvFile(path.join(FRONTEND_DIR, '.env.production.local'))
  loadEnvFile(path.join(FRONTEND_DIR, '.env'))

  const execute = process.argv.includes('--execute') && !process.argv.includes('--dry-run')
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no definida.')
  }

  const prisma = new PrismaClient()
  const stats = {
    workers: 0,
    appointments: 0,
    medicalEvents: 0,
    eventTests: 0,
    medicalExams: 0,
    studyRecords: 0,
    clinicalHistories: 0,
    satisfactionSurveys: 0,
    medicalProfiles: 0,
    medicalVerdicts: 0,
    doctorStudyReviews: 0,
    prefilledInvitations: 0,
  }

  console.log('--- backfill-free-text-sentence-case (SME-106) ---')
  console.log(`Modo: ${execute ? 'EXECUTE' : 'DRY-RUN'}`)

  const workers = await prisma.worker.findMany({
    select: { id: true, firstName: true, lastName: true },
  })
  for (const w of workers) {
    const firstName = maybeString(w.firstName, 'firstName') ?? w.firstName
    const lastName = maybeString(w.lastName, 'lastName') ?? w.lastName
    if (firstName !== w.firstName || lastName !== w.lastName) {
      stats.workers++
      if (execute) {
        await prisma.worker.update({ where: { id: w.id }, data: { firstName, lastName } })
      }
    }
  }

  const appointments = await prisma.appointment.findMany({
    select: {
      id: true,
      notes: true,
      identityExceptionComment: true,
      cancellationReason: true,
    },
  })
  for (const a of appointments) {
    const data = {
      notes: maybeString(a.notes, 'notes'),
      identityExceptionComment: maybeString(a.identityExceptionComment, 'identityExceptionComment'),
      cancellationReason: maybeString(a.cancellationReason, 'cancellationReason'),
    }
    if (
      data.notes !== a.notes ||
      data.identityExceptionComment !== a.identityExceptionComment ||
      data.cancellationReason !== a.cancellationReason
    ) {
      stats.appointments++
      if (execute) await prisma.appointment.update({ where: { id: a.id }, data })
    }
  }

  const events = await prisma.medicalEvent.findMany({
    select: { id: true, cancellationReason: true },
  })
  for (const e of events) {
    const cancellationReason = maybeString(e.cancellationReason, 'cancellationReason')
    if (cancellationReason !== e.cancellationReason) {
      stats.medicalEvents++
      if (execute) {
        await prisma.medicalEvent.update({ where: { id: e.id }, data: { cancellationReason } })
      }
    }
  }

  const eventTests = await prisma.eventTest.findMany({
    select: { id: true, resultNotes: true, clinicalContext: true },
  })
  for (const t of eventTests) {
    const resultNotes = maybeString(t.resultNotes, 'resultNotes')
    const clinicalContext = maybeJson(t.clinicalContext, 'clinicalContext')
    if (resultNotes !== t.resultNotes || JSON.stringify(clinicalContext) !== JSON.stringify(t.clinicalContext)) {
      stats.eventTests++
      if (execute) {
        await prisma.eventTest.update({
          where: { id: t.id },
          data: { resultNotes, clinicalContext },
        })
      }
    }
  }

  const exams = await prisma.medicalExam.findMany({
    select: {
      id: true,
      eyeAcuityData: true,
      physicalExamData: true,
      somatometryData: true,
      vitalSignsData: true,
    },
  })
  for (const ex of exams) {
    const data = {
      eyeAcuityData: maybeJson(ex.eyeAcuityData, 'eyeAcuityData'),
      physicalExamData: maybeJson(ex.physicalExamData, 'physicalExamData'),
      somatometryData: maybeJson(ex.somatometryData, 'somatometryData'),
      vitalSignsData: maybeJson(ex.vitalSignsData, 'vitalSignsData'),
    }
    const changed = (Object.keys(data) as (keyof typeof data)[]).some(
      (k) => JSON.stringify(data[k]) !== JSON.stringify(ex[k]),
    )
    if (changed) {
      stats.medicalExams++
      if (execute) await prisma.medicalExam.update({ where: { id: ex.id }, data })
    }
  }

  const studies = await prisma.studyRecord.findMany({
    select: { id: true, validatorNotes: true, extractedData: true },
  })
  for (const s of studies) {
    const validatorNotes = maybeString(s.validatorNotes, 'validatorNotes')
    const extractedData = maybeJson(s.extractedData, 'extractedData')
    if (
      validatorNotes !== s.validatorNotes ||
      JSON.stringify(extractedData) !== JSON.stringify(s.extractedData)
    ) {
      stats.studyRecords++
      if (execute) {
        await prisma.studyRecord.update({
          where: { id: s.id },
          data: { validatorNotes, extractedData },
        })
      }
    }
  }

  const histories = await prisma.clinicalHistory.findMany({ select: { id: true, data: true } })
  for (const h of histories) {
    const data = migrateJsonFreeText(h.data, 'clinicalHistory.data') as Prisma.JsonValue
    if (JSON.stringify(data) !== JSON.stringify(h.data)) {
      stats.clinicalHistories++
      if (execute) await prisma.clinicalHistory.update({ where: { id: h.id }, data: { data } })
    }
  }

  const surveys = await prisma.satisfactionSurvey.findMany({
    select: { id: true, comentario: true },
  })
  for (const s of surveys) {
    const comentario = maybeString(s.comentario, 'comentario')
    if (comentario !== s.comentario) {
      stats.satisfactionSurveys++
      if (execute) await prisma.satisfactionSurvey.update({ where: { id: s.id }, data: { comentario } })
    }
  }

  const profiles = await prisma.medicalProfile.findMany({
    select: { id: true, specialNotes: true },
  })
  for (const p of profiles) {
    const specialNotes = maybeString(p.specialNotes, 'specialNotes')
    if (specialNotes !== p.specialNotes) {
      stats.medicalProfiles++
      if (execute) await prisma.medicalProfile.update({ where: { id: p.id }, data: { specialNotes } })
    }
  }

  const verdicts = await prisma.medicalVerdict.findMany({
    select: { id: true, finalDiagnosis: true, recommendations: true },
  })
  for (const v of verdicts) {
    const finalDiagnosis = maybeString(v.finalDiagnosis, 'finalDiagnosis') ?? v.finalDiagnosis
    const recommendations = maybeString(v.recommendations, 'recommendations')
    if (finalDiagnosis !== v.finalDiagnosis || recommendations !== v.recommendations) {
      stats.medicalVerdicts++
      if (execute) {
        await prisma.medicalVerdict.update({
          where: { id: v.id },
          data: { finalDiagnosis, recommendations },
        })
      }
    }
  }

  const reviews = await prisma.doctorStudyReview.findMany({
    select: {
      id: true,
      doctorDiagnosis: true,
      doctorNotes: true,
      doctorRecommendations: true,
      doctorFeedbackNote: true,
    },
  })
  for (const r of reviews) {
    const data = {
      doctorDiagnosis: maybeString(r.doctorDiagnosis, 'doctorDiagnosis'),
      doctorNotes: maybeString(r.doctorNotes, 'doctorNotes'),
      doctorRecommendations: maybeString(r.doctorRecommendations, 'doctorRecommendations'),
      doctorFeedbackNote: maybeString(r.doctorFeedbackNote, 'doctorFeedbackNote'),
    }
  const changed = Object.entries(data).some(
      ([k, val]) => val !== r[k as keyof typeof r],
    )
    if (changed) {
      stats.doctorStudyReviews++
      if (execute) await prisma.doctorStudyReview.update({ where: { id: r.id }, data })
    }
  }

  const prefills = await prisma.prefilledInvitation.findMany({
    select: { id: true, module1Data: true },
  })
  for (const p of prefills) {
    const module1Data = maybeJson(p.module1Data, 'module1Data')
    if (JSON.stringify(module1Data) !== JSON.stringify(p.module1Data)) {
      stats.prefilledInvitations++
      if (execute) {
        await prisma.prefilledInvitation.update({ where: { id: p.id }, data: { module1Data } })
      }
    }
  }

  console.log('Filas con cambios potenciales:', stats)
  if (!execute) {
    console.log('\nDry-run. Ejecuta con --execute para persistir.')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
