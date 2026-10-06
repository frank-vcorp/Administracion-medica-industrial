import pg from 'pg'

const ROW_ID = 'default'

export type WaDbStatus = 'disconnected' | 'qr_pending' | 'connected' | 'error'

let pool: pg.Pool | null = null

function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return null
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 3 })
  }
  return pool
}

export async function syncWhatsAppRow(args: {
  status: WaDbStatus
  linkedPhone?: string | null
  lastError?: string | null
}): Promise<void> {
  const p = getPool()
  if (!p) return
  await p.query(
    `INSERT INTO "whatsapp_baileys_config" ("id", "status", "linkedPhone", "lastError", "updatedAt", "createdAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT ("id") DO UPDATE SET
       "status" = EXCLUDED."status",
       "linkedPhone" = COALESCE(EXCLUDED."linkedPhone", "whatsapp_baileys_config"."linkedPhone"),
       "lastError" = EXCLUDED."lastError",
       "updatedAt" = NOW()`,
    [ROW_ID, args.status, args.linkedPhone ?? null, args.lastError ?? null],
  )
}

export async function clearLinkedPhone(): Promise<void> {
  const p = getPool()
  if (!p) return
  await p.query(
    `UPDATE "whatsapp_baileys_config" SET "linkedPhone" = NULL, "updatedAt" = NOW() WHERE "id" = $1`,
    [ROW_ID],
  )
}
