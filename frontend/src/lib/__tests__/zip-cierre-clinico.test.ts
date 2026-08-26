/**
 * @file Tests focales V1 para los helpers puros de `zip-cierre-clinico`.
 *
 * @id IMPL-FEATURE-20260825-04
 * @backup context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md
 *
 * Cubre:
 *   - `slugify`: case/acento/espacios → kebab-case seguro.
 *   - `folderName`: prefijo NN_ estable.
 *   - `buildStudyDictamenText`: secciones completas, placeholders
 *     `NO_DISPONIBLE` cuando faltan slot/IA/validatorNotes.
 *   - `buildManifest`: estructura estable, leyenda NO_DISPONIBLE,
 *     listado de studies, Event/universalId/workerName correctos.
 *   - `CLINICAL_ROLES`: SUPERADMIN/DOCTOR_GENERAL/DOCTOR_VALIDATOR.
 *
 * NO se prueba aquí el builder completo (que requiere Prisma + FS);
 * la ruta se prueba por separado en
 * `frontend/src/app/api/zip/clinical-closure/[eventId]/__tests__/route.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  buildManifest,
  buildStudyDictamenText,
  CLINICAL_ROLES,
  folderName,
  slugify,
} from '@/lib/zip-cierre-clinico'

describe('IMPL-FEATURE-20260825-04: zip-cierre-clinico — slugify', () => {
  it('convierte a kebab-case sin acentos', () => {
    expect(slugify('Audiometría Tonal')).toBe('audiometria-tonal')
  })

  it('colapsa separadores múltiples', () => {
    expect(slugify('Audiometría   Tonal  ---  LPS')).toBe(
      'audiometria-tonal-lps',
    )
  })

  it('recorta al máximo (default 60)', () => {
    const long = 'X'.repeat(120)
    expect(slugify(long).length).toBeLessThanOrEqual(60)
  })

  it('devuelve "item" si todo se elimina', () => {
    expect(slugify('---')).toBe('item')
  })

  it('mantiene números', () => {
    expect(slugify('Lab 1 — Química sanguínea')).toBe('lab-1-quimica-sanguinea')
  })
})

describe('IMPL-FEATURE-20260825-04: zip-cierre-clinico — folderName', () => {
  it('prefijado con índice NN_', () => {
    expect(folderName(1, 'Audiometría')).toBe('01_audiometria')
    expect(folderName(12, 'Espirometría')).toBe('12_espirometria')
  })

  it('orden estable y único', () => {
    const folders = [
      folderName(1, 'Audiometría'),
      folderName(2, 'Espirometría'),
      folderName(3, 'Laboratorio'),
    ]
    expect(new Set(folders).size).toBe(3)
  })
})

describe('IMPL-FEATURE-20260825-04: zip-cierre-clinico — CLINICAL_ROLES', () => {
  it('incluye SUPERADMIN/DOCTOR_GENERAL/DOCTOR_VALIDATOR', () => {
    expect(CLINICAL_ROLES.has('SUPERADMIN')).toBe(true)
    expect(CLINICAL_ROLES.has('DOCTOR_GENERAL')).toBe(true)
    expect(CLINICAL_ROLES.has('DOCTOR_VALIDATOR')).toBe(true)
  })

  it('excluye COMPANY_CLIENT y roles administrativos', () => {
    expect(CLINICAL_ROLES.has('COMPANY_CLIENT')).toBe(false)
    expect(CLINICAL_ROLES.has('RECEPTIONIST')).toBe(false)
    expect(CLINICAL_ROLES.has('CAPTURIST')).toBe(false)
    expect(CLINICAL_ROLES.has('ADMIN')).toBe(false)
  })
})

describe('IMPL-FEATURE-20260825-04: zip-cierre-clinico — buildStudyDictamenText', () => {
  it('incluye slot, IA y notas cuando están presentes', () => {
    const out = buildStudyDictamenText({
      serviceName: 'Audiometría Tonal',
      kind: 'STUDY',
      slot: 'Audiometría: Hipoacusia bilateral leve',
      aiPrediction: 'PATRÓN: NOISE-INDUCED',
      validatorNotes: 'Correlación clínica OK.',
    })
    expect(out).toMatch(/^# Dictamen — Audiometría Tonal/)
    expect(out).toMatch(/Tipo: Estudio paraclínico/)
    expect(out).toMatch(/Hipoacusia bilateral leve/)
    expect(out).toMatch(/PATRÓN: NOISE-INDUCED/)
    expect(out).toMatch(/Correlación clínica OK/)
  })

  it('declara NO_DISPONIBLE cuando slot está vacío', () => {
    const out = buildStudyDictamenText({
      serviceName: 'Espirometría',
      kind: 'STUDY',
      slot: null,
      aiPrediction: 'PATRÓN: NORMAL',
      validatorNotes: null,
    })
    expect(out).toMatch(/NO_DISPONIBLE/)
    expect(out).toMatch(/PATRÓN: NORMAL/) // IA sí presente
  })

  it('declara NO_DISPONIBLE cuando AI está ausente', () => {
    const out = buildStudyDictamenText({
      serviceName: 'Laboratorio',
      kind: 'LAB',
      slot: 'BHC normal',
      aiPrediction: null,
      validatorNotes: null,
    })
    expect(out).toMatch(/NO_DISPONIBLE/)
    expect(out).toMatch(/BHC normal/)
    expect(out).toMatch(/Tipo: Laboratorio/)
  })

  it('LAB usa etiqueta "Laboratorio" en Tipo', () => {
    const out = buildStudyDictamenText({
      serviceName: 'Química Sanguínea',
      kind: 'LAB',
      slot: null,
      aiPrediction: null,
      validatorNotes: null,
    })
    expect(out).toMatch(/Tipo: Laboratorio/)
  })

  it('incluye pie de página con ID de implementación', () => {
    const out = buildStudyDictamenText({
      serviceName: 'Audiometría',
      kind: 'STUDY',
      slot: null,
      aiPrediction: null,
      validatorNotes: null,
    })
    expect(out).toMatch(/IMPL-FEATURE-20260825-04/)
  })
})

describe('IMPL-FEATURE-20260825-04: zip-cierre-clinico — buildManifest', () => {
  it('incluye Event/universalId/workerName/fecha de generator', () => {
    const out = buildManifest({
      eventId: 'event-42',
      universalId: 'U-99',
      workerName: 'Juan Pérez',
      generatedAt: new Date('2026-08-25T20:00:00.000Z'),
      dictamenGeneralPath: '01_Dictamen_General/dictamen-general.pdf',
      studyEntries: [],
    })
    expect(out).toMatch(/Event ID:\s+event-42/)
    expect(out).toMatch(/Universal ID:\s+U-99/)
    expect(out).toMatch(/Trabajador:\s+Juan Pérez/)
    expect(out).toMatch(/2026-08-25T20:00:00\.000Z/)
    expect(out).toMatch(/01_Dictamen_General\/dictamen-general\.pdf/)
  })

  it('lista studies con carpeta/dictamen/fuente', () => {
    const out = buildManifest({
      eventId: 'event-1',
      universalId: 'U-1',
      workerName: 'X',
      generatedAt: new Date('2026-08-25T20:00:00.000Z'),
      dictamenGeneralPath: '01_Dictamen_General/dictamen-general.pdf',
      studyEntries: [
        {
          folder: '02_Audiometria',
          serviceName: 'Audiometría',
          dictamenPath: '02_Audiometria/dictamen-audiometria.txt',
          sourcePath: '02_Audiometria/fuente-audiometria.pdf',
        },
      ],
    })
    expect(out).toMatch(/02_Audiometria\//)
    expect(out).toMatch(/dictamen-audiometria\.txt/)
    expect(out).toMatch(/fuente-audiometria\.pdf/)
  })

  it('documenta la leyenda NO_DISPONIBLE', () => {
    const out = buildManifest({
      eventId: 'event-1',
      universalId: 'U-1',
      workerName: 'X',
      generatedAt: new Date('2026-08-25T20:00:00.000Z'),
      dictamenGeneralPath: 'x',
      studyEntries: [],
    })
    expect(out).toMatch(/NO_DISPONIBLE/)
    expect(out).toMatch(/no se inventó/)
  })

  it('NO incluye PII distinta de nombre del paciente (sin firma, sin cédula)', () => {
    const out = buildManifest({
      eventId: 'event-1',
      universalId: 'U-1',
      workerName: 'Juan Pérez',
      generatedAt: new Date('2026-08-25T20:00:00.000Z'),
      dictamenGeneralPath: 'x',
      studyEntries: [],
    })
    expect(out).not.toMatch(/C[eé]dula/i)
    expect(out).not.toMatch(/Firma/i)
    expect(out).not.toMatch(/12345678/)
  })
})