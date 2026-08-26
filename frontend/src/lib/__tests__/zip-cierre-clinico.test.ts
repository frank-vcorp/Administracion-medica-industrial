/**
 * @file Tests focales V1 para los helpers puros de `zip-cierre-clinico`.
 *
 * @id IMPL-FEATURE-20260825-04
 * @id IMPL-20260826-05 (FIX fuente vía backend `/api/files`, no FS Vercel)
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
 *   - `resolveBackendFileUrl` (FIX IMPL-20260826-05): mapea
 *     `/api/files/...`, `/uploads/...` y paths relativos a URL absoluta
 *     del backend; rechaza URLs con esquema (defensa SSRF) y path
 *     traversal.
 *   - `tryReadSourceFromBackend` (FIX IMPL-20260826-05): lee bytes vía
 *     `fetch`, devuelve `null` ante 4xx/5xx/red. Sustituye la versión
 *     anterior basada en filesystem.
 *
 * NO se prueba aquí el builder completo (que requiere Prisma);
 * la ruta se prueba por separado en
 * `frontend/src/app/api/zip/clinical-closure/[eventId]/__tests__/route.test.ts`.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  buildManifest,
  buildStudyDictamenText,
  CLINICAL_ROLES,
  folderName,
  resolveBackendFileUrl,
  slugify,
  tryReadSourceFromBackend,
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

// ────────────────────────────────────────────────────────────────────────
// IMPL-20260826-05: FIX fuente ZIP vía backend `/api/files`, no FS Vercel.
// ────────────────────────────────────────────────────────────────────────
describe('IMPL-20260826-05: resolveBackendFileUrl', () => {
  const BASE = 'https://api.medicaindustrial.com'

  it('mapea /api/files/<key> a URL absoluta', () => {
    expect(resolveBackendFileUrl('/api/files/foo.pdf', BASE))
      .toBe('https://api.medicaindustrial.com/api/files/foo.pdf')
  })

  it('mapea /uploads/<key> (legacy) a /api/files/<key>', () => {
    expect(resolveBackendFileUrl('/uploads/foo.pdf', BASE))
      .toBe('https://api.medicaindustrial.com/api/files/foo.pdf')
  })

  it('mapea un basename/key relativo a /api/files/<key>', () => {
    expect(resolveBackendFileUrl('foo.pdf', BASE))
      .toBe('https://api.medicaindustrial.com/api/files/foo.pdf')
  })

  it('preserva subcarpetas dentro de /api/files/<subdir>/<key>', () => {
    expect(resolveBackendFileUrl('/api/files/companies/public/x/c.pdf', BASE))
      .toBe(
        'https://api.medicaindustrial.com/api/files/companies/public/x/c.pdf',
      )
  })

  it('preserva subcarpetas dentro de paths relativos', () => {
    expect(resolveBackendFileUrl('espirometry-pdfs/review-1.pdf', BASE))
      .toBe(
        'https://api.medicaindustrial.com/api/files/espirometry-pdfs/review-1.pdf',
      )
  })

  it('normaliza trailing slash en baseUrl', () => {
    expect(resolveBackendFileUrl('/api/files/foo.pdf', BASE + '/'))
      .toBe('https://api.medicaindustrial.com/api/files/foo.pdf')
    expect(resolveBackendFileUrl('/api/files/foo.pdf', BASE + '///'))
      .toBe('https://api.medicaindustrial.com/api/files/foo.pdf')
  })

  // ── Defensa SSRF: rechaza URLs absolutas con esquema ──────────────────
  it('RECHAZA URLs absolutas http://, https://, s3://, etc. (defensa SSRF)', () => {
    expect(resolveBackendFileUrl('https://bucket.s3.amazonaws.com/foo.pdf', BASE))
      .toBeNull()
    expect(resolveBackendFileUrl('http://localhost:8000/api/files/foo.pdf', BASE))
      .toBeNull()
    expect(resolveBackendFileUrl('s3://bucket/foo.pdf', BASE))
      .toBeNull()
    expect(resolveBackendFileUrl('file:///etc/passwd', BASE))
      .toBeNull()
    expect(resolveBackendFileUrl('ftp://evil.com/x', BASE))
      .toBeNull()
  })

  // ── Defensa path traversal ────────────────────────────────────────────
  it('RECHAZA paths con traversal ".."', () => {
    expect(resolveBackendFileUrl('../etc/passwd', BASE)).toBeNull()
    expect(resolveBackendFileUrl('/api/files/../etc/passwd', BASE)).toBeNull()
    expect(resolveBackendFileUrl('/uploads/../etc/passwd', BASE)).toBeNull()
  })

  it('RECHAZA inputs vacíos / no-string', () => {
    expect(resolveBackendFileUrl(null, BASE)).toBeNull()
    expect(resolveBackendFileUrl(undefined, BASE)).toBeNull()
    expect(resolveBackendFileUrl('', BASE)).toBeNull()
    expect(resolveBackendFileUrl('   ', BASE)).toBeNull()
  })

  it('RECHAZA paths absolutos no reconocidos (defensa)', () => {
    expect(resolveBackendFileUrl('/etc/passwd', BASE)).toBeNull()
    expect(resolveBackendFileUrl('/random/path', BASE)).toBeNull()
  })
})

describe('IMPL-20260826-05: tryReadSourceFromBackend', () => {
  const BASE = 'https://api.medicaindustrial.com'

  it('descarga bytes cuando el backend responde 200', async () => {
    const fakeBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeBytes.buffer),
    })
    const result = await tryReadSourceFromBackend(
      '/api/files/audiometria.pdf',
      BASE,
      fetchMock,
    )
    expect(result).not.toBeNull()
    expect(Array.from(result!)).toEqual([0x25, 0x50, 0x44, 0x46])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Verificamos que llamó a la URL absoluta correcta.
    expect(fetchMock.mock.calls[0][0])
      .toBe('https://api.medicaindustrial.com/api/files/audiometria.pdf')
  })

  it('envía cache: "no-store" para evitar caché obsoleta del CDN', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
    await tryReadSourceFromBackend(
      '/api/files/x.pdf',
      BASE,
      fetchMock,
    )
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.cache).toBe('no-store')
  })

  it('devuelve null cuando el backend responde 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })
    const result = await tryReadSourceFromBackend(
      '/api/files/missing.pdf',
      BASE,
      fetchMock,
    )
    expect(result).toBeNull()
  })

  it('devuelve null cuando el backend responde 5xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    })
    const result = await tryReadSourceFromBackend(
      '/api/files/x.pdf',
      BASE,
      fetchMock,
    )
    expect(result).toBeNull()
  })

  it('devuelve null cuando la red falla (fetch throw)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await tryReadSourceFromBackend(
      '/api/files/x.pdf',
      BASE,
      fetchMock,
    )
    expect(result).toBeNull()
  })

  it('NO intenta fetch si fileUrl es inválido (defensa SSRF)', async () => {
    const fetchMock = vi.fn()
    const result = await tryReadSourceFromBackend(
      'https://bucket.s3.amazonaws.com/foo.pdf',
      BASE,
      fetchMock,
    )
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('NO intenta fetch si fileUrl es null/undefined', async () => {
    const fetchMock = vi.fn()
    expect(await tryReadSourceFromBackend(null, BASE, fetchMock)).toBeNull()
    expect(await tryReadSourceFromBackend(undefined, BASE, fetchMock)).toBeNull()
    expect(await tryReadSourceFromBackend('', BASE, fetchMock)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('convierte /uploads/<key> legacy antes de fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
    await tryReadSourceFromBackend(
      '/uploads/legacy/foo.pdf',
      BASE,
      fetchMock,
    )
    expect(fetchMock.mock.calls[0][0])
      .toBe('https://api.medicaindustrial.com/api/files/legacy/foo.pdf')
  })

  it('acepta keys relativas con subcarpetas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
    await tryReadSourceFromBackend(
      'espirometry-pdfs/review-1.pdf',
      BASE,
      fetchMock,
    )
    expect(fetchMock.mock.calls[0][0])
      .toBe(
        'https://api.medicaindustrial.com/api/files/espirometry-pdfs/review-1.pdf',
      )
  })
})