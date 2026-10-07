import { resolveWhatsAppGateway } from '@/lib/whatsapp-gateway-config'

type GatewayJson = {
  ok?: boolean
  error?: string
  status?: string
  linkedPhone?: string | null
  qrDataUrl?: string | null
  lastError?: string | null
}

export async function isWhatsAppGatewayConfigured(): Promise<boolean> {
  const gw = await resolveWhatsAppGateway()
  return Boolean(gw)
}

export async function callWhatsAppGateway(args: {
  path: string
  method: 'GET' | 'POST'
  role: string
  userId: string
  body?: Record<string, unknown>
}): Promise<{ ok: boolean; data?: GatewayJson; error?: string }> {
  const gw = await resolveWhatsAppGateway()
  if (!gw) {
    return {
      ok: false,
      error:
        'Indique la URL del gateway WhatsApp y el secret en esta pantalla (o variables WHATSAPP_GATEWAY_* en el servidor).',
    }
  }

  try {
    const res = await fetch(`${gw.baseUrl}${args.path}`, {
      method: args.method,
      headers: {
        Authorization: `Bearer ${gw.secret}`,
        'x-ami-role': args.role,
        'x-ami-userid': args.userId,
        ...(args.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: args.body ? JSON.stringify(args.body) : undefined,
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => ({}))) as GatewayJson
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error ?? `Gateway respondió ${res.status}`,
      }
    }
    return { ok: true, data: json }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red con el gateway WhatsApp',
    }
  }
}

export async function probeWhatsAppGatewayHealth(): Promise<{
  ok: boolean
  error?: string
}> {
  const gw = await resolveWhatsAppGateway()
  if (!gw) {
    return { ok: false, error: 'Gateway no configurado' }
  }
  try {
    const res = await fetch(`${gw.baseUrl}/health`, { cache: 'no-store' })
    if (!res.ok) {
      return { ok: false, error: `Health ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se alcanza el gateway',
    }
  }
}
