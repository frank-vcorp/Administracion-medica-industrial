/**
 * @fileoverview Generador mínimo de ZIP en modo STORE (sin compresión),
 *   compatible con el formato PKZIP usado por herramientas estándar
 *   (unzip, Info-ZIP, macOS Archive Utility, Windows Explorer, etc.).
 *
 *   Implementación inline sin dependencias externas para mantener el
 *   bundle reproducible y no añadir dependencias innecesarias (SPEC
 *   FEATURE-20260825-04: "Si no existe librería ZIP, usa una solución
 *   compatible con Next/Vercel sin añadir dependencia innecesaria").
 *
 *   Soporta archivos binarios arbitrarios y entradas con tamaño 0.
 *   El CRC-32 se computa inline siguiendo el polinomio IEEE 802.3.
 *
 *   Limitaciones (aceptadas para esta primera versión operativa):
 *     - Sólo modo STORE (sin compresión).
 *     - Sin cifrado, sin multi-disco, sin ZIP64.
 *     - Timestamps: hora de generación del archivo (zona local).
 *
 * @id IMPL-FEATURE-20260825-04
 * @backup context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md
 */

// ──────────────────────────────────────────────────────────────────────────
// CRC-32 (IEEE 802.3) — polinomio 0xEDB88320 (reflected).
// Tabla precomputada de 256 entradas; se construye una sola vez.
// ──────────────────────────────────────────────────────────────────────────
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

/** CRC-32 IEEE 802.3 (PKZIP) sobre los bytes dados. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// ──────────────────────────────────────────────────────────────────────────
// DOS time/date — conversión local para la cabecera del ZIP.
// ──────────────────────────────────────────────────────────────────────────

/** Pack Date+time DOS (2+2 bytes) — hora local del proceso. */
function dosDateTime(d: Date = new Date()): { time: number; date: number } {
  // DOS time: bits 0-4 = seconds/2, 5-10 = minute, 11-15 = hour
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((Math.floor(d.getSeconds() / 2)) & 0x1f)
  // DOS date: bits 0-4 = day, 5-8 = month, 9-15 = year-1980
  const date =
    ((((d.getFullYear() - 1980) & 0x7f) << 9)) |
    (((d.getMonth() + 1) & 0xf) << 5) |
    (d.getDate() & 0x1f)
  return { time, date }
}

// ──────────────────────────────────────────────────────────────────────────
// Escritura little-endian determinista.
// ──────────────────────────────────────────────────────────────────────────

function pushU16(out: number[], v: number): void {
  out.push(v & 0xff, (v >>> 8) & 0xff)
}

function pushU32(out: number[], v: number): void {
  out.push(
    v & 0xff,
    (v >>> 8) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 24) & 0xff,
  )
}

function encodeUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

// ──────────────────────────────────────────────────────────────────────────
// API pública.
// ──────────────────────────────────────────────────────────────────────────

export interface ZipEntry {
  /** Path dentro del ZIP (sin slash inicial; usar '/' como separador). */
  path: string
  /** Contenido binario. */
  data: Uint8Array
  /** Fecha de modificación opcional (default = ahora). */
  mtime?: Date
}

/**
 * Genera un archivo ZIP en modo STORE a partir de las entradas dadas.
 *
 * @param entries Lista de entradas (path + data binario).
 * @returns Buffer con el ZIP completo, listo para servir como `application/zip`.
 */
export function buildZip(entries: ReadonlyArray<ZipEntry>): Uint8Array {
  if (entries.length === 0) {
    throw new Error('buildZip: al menos una entrada es requerida')
  }
  // Validar paths: no vacíos, sin absolutos, sin '\'.
  const seen = new Set<string>()
  for (const e of entries) {
    if (!e.path || e.path.length === 0) {
      throw new Error('buildZip: path vacío')
    }
    if (e.path.includes('\\')) {
      throw new Error(`buildZip: path inválido (backslash): ${e.path}`)
    }
    if (e.path.startsWith('/')) {
      throw new Error(`buildZip: path absoluto no permitido: ${e.path}`)
    }
    if (seen.has(e.path)) {
      throw new Error(`buildZip: path duplicado: ${e.path}`)
    }
    seen.add(e.path)
  }

  const { time: dosTime, date: dosDate } = dosDateTime()

  // 1) Local file headers + data → bytes crudos.
  const localChunks: Uint8Array[] = []
  const cdChunks: Uint8Array[] = []
  let cursor = 0

  for (const e of entries) {
    const nameBytes = encodeUtf8(e.path)
    const crc = crc32(e.data)
    const size = e.data.length
    const useTime = e.mtime ? dosDateTime(e.mtime) : { time: dosTime, date: dosDate }

    // ── Local file header ────────────────────────────────────────────────
    const lfh: number[] = []
    pushU32(lfh, 0x04034b50) // signature
    pushU16(lfh, 20) // version needed
    pushU16(lfh, 0) // gp bit flag
    pushU16(lfh, 0) // method (STORE)
    pushU16(lfh, useTime.time)
    pushU16(lfh, useTime.date)
    pushU32(lfh, crc)
    pushU32(lfh, size) // compressed
    pushU32(lfh, size) // uncompressed
    pushU16(lfh, nameBytes.length)
    pushU16(lfh, 0) // extra field length
    // nombre
    for (let i = 0; i < nameBytes.length; i++) lfh.push(nameBytes[i])
    const lfhBytes = new Uint8Array(lfh)
    localChunks.push(lfhBytes)
    localChunks.push(e.data)
    const localHeaderLen = 30 + nameBytes.length
    const localOffset = cursor
    cursor += localHeaderLen + size

    // ── Central directory header ─────────────────────────────────────────
    const cd: number[] = []
    pushU32(cd, 0x02014b50) // signature
    pushU16(cd, 0x031e) // version made by (UNIX, 30)
    pushU16(cd, 20) // version needed
    pushU16(cd, 0) // gp bit flag
    pushU16(cd, 0) // method
    pushU16(cd, useTime.time)
    pushU16(cd, useTime.date)
    pushU32(cd, crc)
    pushU32(cd, size)
    pushU32(cd, size)
    pushU16(cd, nameBytes.length)
    pushU16(cd, 0) // extra
    pushU16(cd, 0) // comment
    pushU16(cd, 0) // disk start
    pushU16(cd, 0) // internal attrs
    pushU32(cd, 0) // external attrs
    pushU32(cd, localOffset)
    for (let i = 0; i < nameBytes.length; i++) cd.push(nameBytes[i])
    cdChunks.push(new Uint8Array(cd))
  }

  const cdStart = cursor
  // 2) Concatenar central directory.
  let cdLen = 0
  for (const c of cdChunks) cdLen += c.length
  const cdBytes = new Uint8Array(cdLen)
  let pos = 0
  for (const c of cdChunks) {
    cdBytes.set(c, pos)
    pos += c.length
  }

  // 3) End of central directory.
  const eocd: number[] = []
  pushU32(eocd, 0x06054b50)
  pushU16(eocd, 0) // disk
  pushU16(eocd, 0) // disk where cd starts
  pushU16(eocd, entries.length)
  pushU16(eocd, entries.length)
  pushU32(eocd, cdLen)
  pushU32(eocd, cdStart)
  pushU16(eocd, 0) // comment len

  // 4) Concatenar todo en un Uint8Array final.
  const totalLen = cursor + cdLen + eocd.length
  const out = new Uint8Array(totalLen)
  pos = 0
  for (const c of localChunks) {
    out.set(c, pos)
    pos += c.length
  }
  out.set(cdBytes, pos)
  pos += cdLen
  out.set(new Uint8Array(eocd), pos)
  return out
}

// ──────────────────────────────────────────────────────────────────────────
// Parseo mínimo: extraer entradas del archivo para tests.
// ──────────────────────────────────────────────────────────────────────────

export interface ParsedZipEntry {
  path: string
  data: Uint8Array
  crc32: number
}

/**
 * Parsea un ZIP y devuelve la lista de entradas. Sólo valida estructura
 * PKZIP y modo STORE; útil para tests V1 que verifican la integridad
 * del ZIP generado por `buildZip`. NO es un descompresor general: no
 * soporta compresión, ZIP64, cifrado ni multi-disco.
 */
export function parseZip(buf: Uint8Array): ParsedZipEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const entries: ParsedZipEntry[] = []

  // Buscar EOCD recorriendo desde el final (EOCD mínimo = 22 bytes).
  let eocdOffset = -1
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) {
    throw new Error('parseZip: EOCD no encontrado')
  }
  const cdEntries = dv.getUint16(eocdOffset + 10, true)
  const cdSize = dv.getUint32(eocdOffset + 12, true)
  const cdStart = dv.getUint32(eocdOffset + 16, true)
  if (cdSize < 0 || cdStart < 0 || cdStart + cdSize > buf.length) {
    throw new Error('parseZip: EOCD inconsistente')
  }
  if (cdEntries !== entries.length) {
    // Recorremos desde cdStart y validamos cuenta.
  }

  let p = cdStart
  for (let i = 0; i < cdEntries; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) {
      throw new Error(`parseZip: firma central dir inválida en idx ${i}`)
    }
    const method = dv.getUint16(p + 10, true)
    if (method !== 0) {
      throw new Error(`parseZip: método no-STORE en idx ${i}: ${method}`)
    }
    const crc = dv.getUint32(p + 16, true)
    const compSize = dv.getUint32(p + 20, true)
    const uncompSize = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const localOffset = dv.getUint32(p + 42, true)
    if (compSize !== uncompSize) {
      throw new Error(`parseZip: STORE no admite tamaños distintos (idx ${i})`)
    }
    // nombre
    const nameBytes = buf.slice(p + 46, p + 46 + nameLen)
    const path = new TextDecoder('utf-8').decode(nameBytes)
    // contenido (saltamos local file header)
    if (dv.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`parseZip: firma local header inválida para ${path}`)
    }
    const lNameLen = dv.getUint16(localOffset + 26, true)
    const lExtraLen = dv.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + lNameLen + lExtraLen
    const data = buf.slice(dataStart, dataStart + uncompSize)
    entries.push({ path, data, crc32: crc })
    p += 46 + nameLen + extraLen + commentLen
  }
  if (cdEntries !== entries.length) {
    throw new Error(
      `parseZip: cdEntries declarado ${cdEntries} vs leídos ${entries.length}`,
    )
  }
  return entries
}