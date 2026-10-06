# AMI WhatsApp Gateway (Baileys)

Servicio Node persistente para vincular WhatsApp Web (QR) y envíos futuros desde AMI.

## Railway (servicio aparte)

1. Nuevo servicio desde este directorio (`Root Directory`: `whatsapp-gateway`).
2. Montar volumen en `/data/wa-auth` para conservar la sesión.
3. Variables:
   - `DATABASE_URL` (misma Postgres que el frontend)
   - `WHATSAPP_GATEWAY_SECRET` (mismo valor que en Vercel/Railway frontend)
   - `PORT` (Railway lo asigna)

4. URL pública del servicio → `WHATSAPP_GATEWAY_URL` en el frontend.

## API (admin)

- `GET /v1/admin/status`
- `POST /v1/admin/connect` — genera QR
- `POST /v1/admin/disconnect`

Headers: `Authorization: Bearer <secret>`, `x-ami-role: ADMIN|SUPERADMIN`
