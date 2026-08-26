/**
 * @file Tests focales V1 para el helper `zip-store` (escritor/parser
 *   ZIP STORE + CRC-32).
 *
 * @id IMPL-FEATURE-20260825-04
 * @backup context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md
 *
 * Cubre:
 *   - CRC-32 IEEE 802.3 contra vectores conocidos.
 *   - `buildZip` round-trip: el ZIP generado se parsea de vuelta
 *     con `parseZip` y los bytes coinciden.
 *   - Validación de paths: rechazo de path vacío, absolutos,
 *     backslash y duplicados.
 *   - Integridad: CRC-32 del header local/CD coincide con el CRC-32
 *     calculado sobre los datos.
 *   - Soporte para entradas binarias con bytes no-UTF-8.
 *   - Soporte para entradas vacías (data.length === 0).
 */
import { describe, it, expect } from 'vitest'
import { buildZip, crc32, parseZip, type ZipEntry } from '@/lib/zip-store'

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

describe('IMPL-FEATURE-20260825-04: zip-store — CRC-32 IEEE 802.3', () => {
  it('CRC-32 de string vacío = 0', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
  })

  it('CRC-32 de "a" = 0xE8B7BE43 (vector PKZIP canónico)', () => {
    // Vector canónico PKZIP Appendix para la cadena "a".
    expect(crc32(utf8('a'))).toBe(0xe8b7be43)
  })

  it('CRC-32 de "123456789" = 0xCBF43926 (vector PKZIP canónico)', () => {
    // Vector canónico PKZIP para la cadena "123456789" — referencia
    // histórica del algoritmo CRC-32.
    expect(crc32(utf8('123456789'))).toBe(0xcbf43926)
  })

  it('CRC-32 es determinista', () => {
    const data = utf8('Hola mundo — IMPL-FEATURE-20260825-04')
    expect(crc32(data)).toBe(crc32(data))
  })
})

describe('IMPL-FEATURE-20260825-04: zip-store — buildZip / parseZip round-trip', () => {
  it('round-trip: una sola entrada', () => {
    const entries: ZipEntry[] = [
      { path: 'manifest.txt', data: utf8('Hola ZIP') },
    ]
    const zip = buildZip(entries)
    const parsed = parseZip(zip)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].path).toBe('manifest.txt')
    expect(new TextDecoder().decode(parsed[0].data)).toBe('Hola ZIP')
  })

  it('round-trip: múltiples entradas (preserva orden y contenido)', () => {
    const entries: ZipEntry[] = [
      { path: 'a.txt', data: utf8('A') },
      { path: 'b.txt', data: utf8('B') },
      { path: 'sub/c.txt', data: utf8('C') },
      { path: 'sub/d.bin', data: new Uint8Array([0, 1, 2, 3, 255, 254]) },
    ]
    const zip = buildZip(entries)
    const parsed = parseZip(zip)
    expect(parsed.map((e) => e.path)).toEqual([
      'a.txt',
      'b.txt',
      'sub/c.txt',
      'sub/d.bin',
    ])
    expect(new TextDecoder().decode(parsed[0].data)).toBe('A')
    expect(new TextDecoder().decode(parsed[1].data)).toBe('B')
    expect(new TextDecoder().decode(parsed[2].data)).toBe('C')
    expect(Array.from(parsed[3].data)).toEqual([0, 1, 2, 3, 255, 254])
  })

  it('round-trip: entrada vacía (data.length === 0)', () => {
    const entries: ZipEntry[] = [{ path: 'empty.bin', data: new Uint8Array(0) }]
    const zip = buildZip(entries)
    const parsed = parseZip(zip)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].data.length).toBe(0)
  })

  it('round-trip: integridad CRC-32 entre header y datos', () => {
    const data = utf8('123456789')
    const zip = buildZip([{ path: 'check.txt', data }])
    const parsed = parseZip(zip)
    expect(parsed[0].crc32).toBe(0xcbf43926) // matches computed CRC
  })

  it('round-trip: firma PKZIP válida (EOCD 0x06054b50 detectable)', () => {
    const zip = buildZip([{ path: 'x.txt', data: utf8('x') }])
    // El último byte del EOCD es siempre el comment-length = 0.
    // Las 4 firmas (LFH=4, CD+4, EOCD+4) deben estar presentes.
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    // Primer LFH
    expect(dv.getUint32(0, true)).toBe(0x04034b50)
    // EOCD al final
    const eocd = zip.length - 22
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50)
  })
})

describe('IMPL-FEATURE-20260825-04: zip-store — validación de paths', () => {
  it('rechaza array vacío', () => {
    expect(() => buildZip([])).toThrow(/al menos una entrada/)
  })

  it('rechaza path vacío', () => {
    expect(() =>
      buildZip([{ path: '', data: utf8('x') }]),
    ).toThrow(/path vacío/)
  })

  it('rechaza path absoluto', () => {
    expect(() =>
      buildZip([{ path: '/etc/passwd', data: utf8('x') }]),
    ).toThrow(/absoluto/)
  })

  it('rechaza path con backslash', () => {
    expect(() =>
      buildZip([{ path: 'a\\b.txt', data: utf8('x') }]),
    ).toThrow(/backslash/)
  })

  it('rechaza path duplicado', () => {
    expect(() =>
      buildZip([
        { path: 'dup.txt', data: utf8('1') },
        { path: 'dup.txt', data: utf8('2') },
      ]),
    ).toThrow(/duplicado/)
  })
})

describe('IMPL-FEATURE-20260825-04: zip-store — estructura compatible con unzip-like', () => {
  it('el ZIP respeta orden y offsets para extracción secuencial', () => {
    // Caso de uso: el médico descarga y abre con `unzip` o visor
    // integrado. El ZIP debe extraer entradas en orden determinista.
    const entries: ZipEntry[] = Array.from({ length: 50 }, (_, i) => ({
      path: `file-${String(i).padStart(3, '0')}.txt`,
      data: utf8(`contenido #${i}`),
    }))
    const zip = buildZip(entries)
    const parsed = parseZip(zip)
    expect(parsed.map((e) => e.path)).toEqual(
      entries.map((e) => e.path),
    )
    expect(parsed).toHaveLength(50)
  })
})