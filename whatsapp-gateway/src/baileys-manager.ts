import path from 'node:path'
import { mkdirSync } from 'node:fs'
import QRCode from 'qrcode'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import { clearLinkedPhone, syncWhatsAppRow, type WaDbStatus } from './db-sync.js'

export type GatewayRuntimeStatus = {
  status: WaDbStatus
  linkedPhone: string | null
  qrDataUrl: string | null
  lastError: string | null
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })

class BaileysManager {
  private sock: WASocket | null = null
  private starting = false
  private qrRaw: string | null = null
  private qrDataUrl: string | null = null
  private status: WaDbStatus = 'disconnected'
  private linkedPhone: string | null = null
  private lastError: string | null = null

  getSnapshot(): GatewayRuntimeStatus {
    return {
      status: this.status,
      linkedPhone: this.linkedPhone,
      qrDataUrl: this.qrDataUrl,
      lastError: this.lastError,
    }
  }

  private authDir(): string {
    const dir = process.env.WHATSAPP_AUTH_DIR?.trim() || path.join(process.cwd(), 'data', 'wa-auth')
    mkdirSync(dir, { recursive: true })
    return dir
  }

  private formatPhone(jid: string | undefined): string | null {
    if (!jid) return null
    const num = jid.split(':')[0]?.split('@')[0]
    return num ? `+${num.replace(/\D/g, '')}` : null
  }

  async startPairing(): Promise<GatewayRuntimeStatus> {
    if (this.status === 'connected' && this.sock) {
      return this.getSnapshot()
    }
    if (this.starting) {
      return this.getSnapshot()
    }
    this.starting = true
    this.lastError = null
    this.qrRaw = null
    this.qrDataUrl = null
    this.status = 'qr_pending'
    await syncWhatsAppRow({ status: 'qr_pending', lastError: null })

    try {
      await this.openSocket()
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err)
      this.status = 'error'
      await syncWhatsAppRow({ status: 'error', lastError: this.lastError })
    } finally {
      this.starting = false
    }
    return this.getSnapshot()
  }

  private async openSocket(): Promise<void> {
    if (this.sock) {
      try {
        this.sock.end(undefined)
      } catch {
        /* ignore */
      }
      this.sock = null
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir())
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    })
    this.sock = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        this.qrRaw = qr
        this.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 })
        this.status = 'qr_pending'
        await syncWhatsAppRow({ status: 'qr_pending' })
      }

      if (connection === 'open') {
        this.qrRaw = null
        this.qrDataUrl = null
        this.status = 'connected'
        this.linkedPhone = this.formatPhone(sock.user?.id)
        this.lastError = null
        await syncWhatsAppRow({
          status: 'connected',
          linkedPhone: this.linkedPhone,
          lastError: null,
        })
      }

      if (connection === 'close') {
        const code = (
          lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
        )?.output?.statusCode
        const loggedOut = code === DisconnectReason.loggedOut
        this.status = loggedOut ? 'disconnected' : 'error'
        this.qrDataUrl = null
        this.qrRaw = null
        if (loggedOut) {
          this.linkedPhone = null
          await clearLinkedPhone()
        }
        this.lastError = loggedOut
          ? null
          : `Conexión cerrada (${code ?? 'desconocido'})`
        await syncWhatsAppRow({
          status: this.status,
          linkedPhone: loggedOut ? null : this.linkedPhone,
          lastError: this.lastError,
        })
        this.sock = null

        if (!loggedOut && code !== DisconnectReason.loggedOut) {
          setTimeout(() => {
            void this.startPairing()
          }, 3000)
        }
      }
    })
  }

  async disconnect(): Promise<GatewayRuntimeStatus> {
    if (this.sock) {
      try {
        await this.sock.logout()
      } catch {
        try {
          this.sock.end(undefined)
        } catch {
          /* ignore */
        }
      }
      this.sock = null
    }
    this.status = 'disconnected'
    this.linkedPhone = null
    this.qrDataUrl = null
    this.qrRaw = null
    this.lastError = null
    await syncWhatsAppRow({
      status: 'disconnected',
      linkedPhone: null,
      lastError: null,
    })
    await clearLinkedPhone()
    return this.getSnapshot()
  }

  async sendText(toPhone: string, text: string): Promise<void> {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error('WhatsApp no conectado. Escanee el QR en Configuración.')
    }
    const digits = toPhone.replace(/\D/g, '')
    if (digits.length < 10) {
      throw new Error('Teléfono destino inválido')
    }
    const body = text.trim().slice(0, 4000)
    if (!body) {
      throw new Error('Mensaje vacío')
    }
    const jid = `${digits}@s.whatsapp.net`
    await this.sock.sendMessage(jid, { text: body })
  }

  /** Restaura sesión existente al arrancar el gateway (sin QR). */
  async warmExistingSession(): Promise<void> {
    const { state } = await useMultiFileAuthState(this.authDir())
    if (!state.creds?.registered) return
    if (this.sock) return
    await this.openSocket()
  }
}

export const baileysManager = new BaileysManager()
