# SPEC: Envío de Recibo por WhatsApp Web

**ID:** ARCH-20260630-02
**Fecha:** 2026-06-30
**Estado:** Planificado
**Owner:** INTEGRA → SOFIA

---

## 1. Objetivo

Agregar opción "Enviar por WhatsApp" en el modal de pago/recibo que:
- Genere el PDF del recibo
- Abra WhatsApp Web con el PDF adjunto (o link de descarga) y mensaje prellenado
- Permita al usuario elegir destinatario (teléfono del trabajador / empresa / manual)

---

## 2. Cambios en UI (PaymentModal.tsx)

**Nuevo campo en sección "Enviar recibo":**

```
[ ] Enviar recibo por email        → (existente)
[ ] Enviar recibo por WhatsApp     → (NUEVO)
    └─ Teléfono destino: [input tel]
    └─ Mensaje personalizable: [textarea]
```

- Checkbox independiente (pueden marcarse ambos)
- Si WhatsApp marcado → requerir teléfono (default: `worker.phone` si existe)
- Botón "Generar y enviar" → ejecuta ambas acciones en paralelo

---

## 3. Implementación Técnica

### WhatsApp Web URL Scheme
```
https://wa.me/<PHONE>?text=<ENCODED_MESSAGE>
```

- No permite adjuntar archivo directamente vía URL
- **Workaround:** Subir PDF a storage temporal (S3/Cloudinary/local) → generar link de descarga → incluir link en mensaje

### Opción A: Link de descarga temporal (recomendado)
1. Generar PDF → subir a `/api/upload/receipt` (nuevo endpoint) → retorna `downloadUrl` (expira 24h)
2. Construir `wa.me` URL con mensaje + `downloadUrl`
3. `window.open(waUrl, '_blank')` → abre WhatsApp Web

### Opción B: Solo mensaje (sin PDF adjunto)
- Mensaje: "Recibo de pago por $X - Método: Y - Ref: Z. Ver en sistema: <link>"
- Requiere que el destinatario tenga acceso al portal

> Decisión: **Opción A** (link temporal) para UX completa.

---

## 4. Server Actions Nuevas (payment.actions.ts)

```ts
// uploadReceiptPdf(pdfBuffer, filename) → { success, downloadUrl, error }
// sendReceiptWhatsApp(paymentId, phone, message, downloadUrl) → { success, error }
```

- `uploadReceiptPdf`: guarda en `public/uploads/receipts/` (dev) o S3 (prod), retorna URL firmada
- `sendReceiptWhatsApp`: solo construye URL + `window.open` en cliente (no server-side)

---

## 5. Modelo de Datos

Extender `PaymentRecord`:
```prisma
model PaymentRecord {
  // ... existentes
  receiptWhatsAppSent Boolean  @default(false)
  receiptWhatsAppPhone String?
  receiptWhatsAppAt    DateTime?
  receiptDownloadUrl   String?  // URL temporal del PDF
  receiptDownloadExpires DateTime?
}
```

---

## 6. Flujo Usuario

1. Abre modal "Pago y Recibo"
2. Completa pago (método, monto)
3. Marca "Enviar por WhatsApp"
4. Teléfono: autollenado desde `worker.phone` / `company.phone` / editable
5. Mensaje: plantilla editable
6. Click "Generar y enviar"
7. Loading → PDF generado → subido → WhatsApp Web abre en nueva pestaña con mensaje + link
8. Usuario envía en WhatsApp Web
9. Modal cierra → toast "Recibo enviado por WhatsApp"
10. BD: `receiptWhatsAppSent=true`, `receiptWhatsAppPhone=...`, `receiptWhatsAppAt=now()`

---

## 7. Permisos

- Igual que pago: ADMIN, DOCTOR, RECEPCION
- Requiere `worker.phone` o `company.phone` configurado

---

## 8. Entregables

| Archivo | Acción |
|---------|--------|
| `context/SPECs/SPEC_ARCH-20260630-02-WHATSAPP-RECIBO.md` | Esta SPEC |
| `frontend/src/actions/payment.actions.ts` | + `uploadReceiptPdf` |
| `frontend/src/components/clinical/PaymentModal.tsx` | + WhatsApp section |
| `frontend/prisma/schema.prisma` | + 4 campos en `PaymentRecord` |
| Migración Prisma | `add_receipt_whatsapp_fields` |
| `frontend/src/app/api/upload/receipt/route.ts` | Endpoint upload temporal (opcional si usa server action) |

---

## 9. Cómo Demostrar

1. Ir a `/events/[id]` → "Pago y Recibo"
2. Llenar pago → marcar "Enviar por WhatsApp"
3. Teléfono: `+5215512345678` (test)
4. Click "Generar y enviar"
5. Verificar: WhatsApp Web abre con mensaje + link PDF
6. Verificar BD: campos `receiptWhatsAppSent/Phone/At` poblados