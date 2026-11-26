import { describe, expect, it } from 'vitest'
import {
  buildRayosXAttachmentsContext,
  formatRayosXProjectionsSummary,
  inferRayosXProjectionLabel,
  isRayosXAttachmentsContext,
  isSafeUploadedFileUrl,
  parseRayosXAttachments,
  RAYOS_X_ATTACHMENTS_SCHEMA_VERSION,
  RAYOS_X_MAX_FILES,
} from '@/lib/clinical/rayos-x-attachments'

describe('rayos-x-attachments helpers', () => {
  it('infiere proyección única inequívoca y omite nombres combinados o vacíos', () => {
    expect(inferRayosXProjectionLabel('1795674293-RX_COLUMNA_LAT_IMAGEN.jpg')).toBe('LAT')
    expect(inferRayosXProjectionLabel('cervical_ap.png')).toBe('AP')
    expect(inferRayosXProjectionLabel('torax-pa-2026.pdf')).toBe('PA')
    expect(inferRayosXProjectionLabel('lumbar_oblicua.jpg')).toBe('Oblicua')
    expect(inferRayosXProjectionLabel('rx_cervical_ap_y_lat.pdf')).toBeNull()
    expect(inferRayosXProjectionLabel('placa_01.jpg')).toBeNull()
  })

  it('valida URLs seguras del almacenamiento de archivos', () => {
    expect(isSafeUploadedFileUrl('/api/files/rayos-x/123/ap.jpg')).toBe(true)
    expect(isSafeUploadedFileUrl('/uploads/1795-rx.png')).toBe(true)
    expect(isSafeUploadedFileUrl('/api/files/../secret')).toBe(false)
    expect(isSafeUploadedFileUrl('https://evil.example/x.jpg')).toBe(false)
    expect(isSafeUploadedFileUrl('/api/files/')).toBe(false)
  })

  it('parsea contexto v1 deduplicado y hace fallback al fileUrl único legacy', () => {
    const legacy = parseRayosXAttachments(null, '/uploads/1795674293-RX_COLUMNA_LAT_IMAGEN.jpg')
    expect(legacy).toEqual([
      {
        url: '/uploads/1795674293-RX_COLUMNA_LAT_IMAGEN.jpg',
        fileName: '1795674293-RX_COLUMNA_LAT_IMAGEN.jpg',
        projectionLabel: 'LAT',
      },
    ])

    const ctx = buildRayosXAttachmentsContext([
      { url: '/api/files/ap.jpg', fileName: 'cervical_ap.jpg', projectionLabel: 'AP' },
      { url: '/api/files/lat.jpg', fileName: 'cervical_lat.jpg', projectionLabel: 'LAT' },
      { url: '/api/files/lat.jpg', fileName: 'dup.jpg', projectionLabel: 'LAT' },
    ])
    expect(ctx?.schemaVersion).toBe(RAYOS_X_ATTACHMENTS_SCHEMA_VERSION)
    expect(ctx?.files).toHaveLength(2)
    expect(isRayosXAttachmentsContext(ctx)).toBe(true)
    expect(isRayosXAttachmentsContext({ schemaVersion: 'espirometria-questionnaire-v1' })).toBe(false)

    const parsed = parseRayosXAttachments(ctx, '/uploads/legacy.jpg')
    expect(parsed.map((p) => p.url)).toEqual(['/api/files/ap.jpg', '/api/files/lat.jpg'])
    expect(formatRayosXProjectionsSummary(parsed)).toBe('AP, LAT')
  })

  it('limita el máximo de placas a RAYOS_X_MAX_FILES (6)', () => {
    const many = Array.from({ length: 8 }, (_, idx) => ({
      url: `/api/files/rx-${idx}.jpg`,
      fileName: `rx-${idx}.jpg`,
      projectionLabel: idx === 0 ? 'AP' : null,
    }))
    const built = buildRayosXAttachmentsContext(many)
    expect(built?.files).toHaveLength(RAYOS_X_MAX_FILES)
  })
})
