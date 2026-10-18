import path from 'node:path'
import { mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import QRCode from 'qrcode'
import makeWASocket, {
  Browsers,
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

const RECOVERABLE_DISCONNECT = new Set<number>([
  DisconnectReason.connectionClosed,
  DisconnectReason.connectionLost,
  DisconnectReason.timedOut,
  DisconnectReason.restartRequired,
])

class BaileysManager {
  private sock: WASocket | null = null
  private starting = false
  private pairingActive = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
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

  /**
   * Borra archivos de sesión dentro del directorio de auth.
   * En Railway el volumen monta `/data/wa-auth`: no se puede `rmdir` el punto de montaje (EBUSY).
   */
  private async clearAuthStorage(): Promise<void> {
    const dir = this.authDir()
    const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        for (const name of readdirSync(dir)) {
          const full = path.join(dir, name)
          const st = statSync(full)
          if (st.isDirectory()) {
            rmSync(full, { recursive: true, force: true })
          } else {
            unlinkSync(full)
          }
        }
        return
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT') return
        if ((code === 'EBUSY' || code === 'EPERM') && attempt < 5) {
          await pause(200 * (attempt + 1))
          continue
        }
        logger.warn({ err, attempt }, 'No se pudo limpiar credenciales WhatsApp')
        return
      }
    }
  }

  private async destroySocket(): Promise<void> {
    const sock = this.sock
    this.sock = null
    if (!sock) return
    try {
      sock.end(undefined)
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 250))
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private scheduleReconnect(options?: { resetSession?: boolean }, delayMs = 2000): void {
    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.startPairing(options)
    }, delayMs)
  }

  private formatPhone(jid: string | undefined): string | null {
    if (!jid) return null
    const num = jid.split(':')[0]?.split('@')[0]
    return num ? `+${num.replace(/\D/g, '')}` : null
  }

  private async waitForQr(timeoutMs: number): Promise<void> {
    if (this.qrDataUrl) return
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (this.qrDataUrl) return
      if (this.status === 'connected') return
      if (this.status === 'error' && this.lastError) return
      if (this.status === 'disconnected' && !this.pairingActive) return
      await new Promise((r) => setTimeout(r, 250))
    }
    if (!this.qrDataUrl && this.status !== 'connected') {
      this.lastError = 'No se recibió QR de WhatsApp. Pulse Actualizar QR o revise los logs del gateway.'
      await syncWhatsAppRow({ status: 'qr_pending', lastError: this.lastError })
    }
  }

  async startPairing(options?: { resetSession?: boolean }): Promise<GatewayRuntimeStatus> {
    if (this.status === 'connected' && this.sock) {
      return this.getSnapshot()
    }
    if (this.starting) {
      if (options?.resetSession) {
        await this.waitForQr(30_000)
      }
      return this.getSnapshot()
    }

    this.clearReconnectTimer()
    this.starting = true
    this.pairingActive = true
    this.lastError = null
    this.qrRaw = null
    this.qrDataUrl = null
    this.status = 'qr_pending'
    await syncWhatsAppRow({ status: 'qr_pending', lastError: null })

    if (options?.resetSession) {
      await this.destroySocket()
      await this.clearAuthStorage()
      const { state: cleared } = await useMultiFileAuthState(this.authDir())
      if (cleared.creds?.registered) {
        logger.warn('Credenciales aún registradas tras limpiar; segundo intento')
        await this.clearAuthStorage()
      }
    }

    try {
      await this.openSocket()
      if (options?.resetSession) {
        await this.waitForQr(35_000)
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err)
      this.status = 'error'
      this.pairingActive = false
      await syncWhatsAppRow({ status: 'error', lastError: this.lastError })
    } finally {
      this.starting = false
    }
    return this.getSnapshot()
  }

  private async openSocket(): Promise<void> {
    await this.destroySocket()

    let { state, saveCreds } = await useMultiFileAuthState(this.authDir())
    if (this.pairingActive && state.creds?.registered) {
      logger.warn('Sesión registrada durante emparejamiento; limpiando credenciales')
      await this.clearAuthStorage()
      ;({ state, saveCreds } = await useMultiFileAuthState(this.authDir()))
    }
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.windows('Chrome'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
    })
    this.sock = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      if (this.sock !== sock) {
        return
      }

      const { connection, lastDisconnect, qr } = update

      if (qr) {
        this.qrRaw = qr
        try {
          this.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 })
        } catch (err) {
          logger.error({ err }, 'No se pudo renderizar QR')
          this.lastError = 'Error al generar imagen del QR'
        }
        this.status = 'qr_pending'
        this.lastError = null
        await syncWhatsAppRow({ status: 'qr_pending', lastError: null })
        logger.info('QR WhatsApp listo para escanear')
      }

      if (connection === 'open') {
        this.pairingActive = false
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
        logger.info({ phone: this.linkedPhone }, 'WhatsApp conectado')
      }

      if (connection === 'close') {
        const code = (
          lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
        )?.output?.statusCode
        const loggedOut = code === DisconnectReason.loggedOut
        const forbidden = code === DisconnectReason.forbidden
        const badSession = code === DisconnectReason.badSession
        const recoverable = code !== undefined && RECOVERABLE_DISCONNECT.has(code)

        logger.warn({ code, recoverable, pairingActive: this.pairingActive }, 'WhatsApp connection closed')

        this.sock = null

        if (loggedOut || forbidden) {
          this.qrDataUrl = null
          this.qrRaw = null
          if (loggedOut) {
            this.linkedPhone = null
            await clearLinkedPhone()
            await this.clearAuthStorage()
          }
          if (forbidden) {
            this.pairingActive = false
            this.status = 'disconnected'
            this.lastError =
              'WhatsApp rechazó la sesión (403). Desvincule y vuelva a escanear el QR.'
            await syncWhatsAppRow({
              status: this.status,
              linkedPhone: this.linkedPhone,
              lastError: this.lastError,
            })
            return
          }

          if (this.pairingActive) {
            this.status = 'qr_pending'
            this.lastError = null
            await syncWhatsAppRow({ status: 'qr_pending', lastError: null })
            this.scheduleReconnect({ resetSession: true }, 800)
            return
          }

          this.pairingActive = false
          this.status = 'disconnected'
          this.lastError = null
          await syncWhatsAppRow({
            status: this.status,
            linkedPhone: null,
            lastError: null,
          })
          return
        }

        if (badSession) {
          await this.clearAuthStorage()
          this.status = 'qr_pending'
          this.scheduleReconnect({ resetSession: true }, 1500)
          return
        }

        if (recoverable) {
          if (this.pairingActive || this.status === 'qr_pending') {
            this.status = 'qr_pending'
          }
          this.scheduleReconnect(undefined, code === DisconnectReason.restartRequired ? 500 : 2000)
          return
        }

        this.pairingActive = false
        this.status = 'error'
        this.qrDataUrl = null
        this.qrRaw = null
        this.lastError = `Conexión cerrada (${code ?? 'desconocido'})`
        await syncWhatsAppRow({
          status: this.status,
          linkedPhone: this.linkedPhone,
          lastError: this.lastError,
        })
      }
    })
  }

  async disconnect(): Promise<GatewayRuntimeStatus> {
    this.clearReconnectTimer()
    this.pairingActive = false
    if (this.sock) {
      try {
        await this.sock.logout()
      } catch {
        /* ignore */
      }
    }
    await this.destroySocket()
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
    await this.clearAuthStorage()
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
    if (this.starting || this.pairingActive || this.sock) return
    const { state } = await useMultiFileAuthState(this.authDir())
    if (!state.creds?.registered) return
    await this.openSocket()
  }
}

export const baileysManager = new BaileysManager()
