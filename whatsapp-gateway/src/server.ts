import express from 'express'
import { baileysManager } from './baileys-manager.js'

const app = express()
app.use(express.json({ limit: '32kb' }))

function requireAdmin(req: express.Request, res: express.Response): boolean {
  const secret = process.env.WHATSAPP_GATEWAY_SECRET?.trim()
  const auth = req.headers.authorization?.trim() ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!secret || bearer !== secret) {
    res.status(401).json({ ok: false, error: 'No autorizado' })
    return false
  }
  const role = (req.headers['x-ami-role'] as string | undefined)?.trim() ?? ''
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    res.status(403).json({ ok: false, error: 'Se requiere rol ADMIN o SUPERADMIN' })
    return false
  }
  return true
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ami-whatsapp-gateway' })
})

app.get('/v1/admin/status', (req, res) => {
  if (!requireAdmin(req, res)) return
  res.json({ ok: true, ...baileysManager.getSnapshot() })
})

app.post('/v1/admin/connect', async (req, res) => {
  if (!requireAdmin(req, res)) return
  try {
    const snapshot = await baileysManager.startPairing()
    res.json({ ok: true, ...snapshot })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Error al iniciar emparejamiento',
    })
  }
})

app.post('/v1/admin/disconnect', async (req, res) => {
  if (!requireAdmin(req, res)) return
  try {
    const snapshot = await baileysManager.disconnect()
    res.json({ ok: true, ...snapshot })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Error al cerrar sesión',
    })
  }
})

const port = Number(process.env.PORT ?? process.env.WHATSAPP_GATEWAY_PORT ?? 3100)

app.listen(port, () => {
  console.info(`[whatsapp-gateway] listening on ${port}`)
  void baileysManager.warmExistingSession()
})
