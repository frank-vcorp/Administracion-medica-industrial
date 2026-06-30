# SPEC: Modal de Pago y Envío de Recibo en Papeleta

**ID:** ARCH-20260630-01
**Fecha:** 2026-06-30
**Estado:** Planificado
**Owner:** INTEGRA → SOFIA

---

## 1. Objetivo

Agregar un botón "Pago y Recibo" junto al enlace "Ficha trabajador" en la cabecera del expediente médico (`events/[id]/page.tsx`), que abra un modal con:
- Selección de método de pago
- Monto editable
- Opción de generar y enviar recibo (PDF descargable y/o email)

---

## 2. Ubicación en UI

**Archivo:** `frontend/src/app/events/[id]/page.tsx`
**Línea:** ~303-308 (dentro del header, junto a "Ficha trabajador" y "Historial clínico")

```tsx
// Actual (línea 303-308)
<Link href={`/workers/${event.worker.id}`} className="...">
    Ficha trabajador
</Link>
<Link href={`/history/${event.worker.id}`} className="...">
    Historial clínico
</Link>

// Nuevo: botón que abre PaymentModal
<PaymentModalTrigger workerId={event.worker.id} eventId={event.id} />
```

---

## 3. Componente: PaymentModal

**Archivo nuevo:** `frontend/src/components/clinical/PaymentModal.tsx`

### Props
```ts
interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  workerId: string
  eventId: string
  workerName: string
  companyName: string
}
```

### Campos delEventId se usa para trazabilidad del pago en la papeleta.

---

## 4. Campos del Modal

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| Método de pago | Select | Sí | Efectivo, Tarjeta, Transferencia, Cheque, Otro |
| Monto | Number (input) | Sí | Default: 0.00, 2 decimales |
| Referencia/Nota | Textarea | No | Para transferencia/cheque |
| Enviar recibo por email | Checkbox | No | Si marcado, pide email destino |
| Email destino | Email input | Condicional | Requerido si checkbox marcado |

---

## 5. Acciones

### Guardar Pago (sin recibo)
- Persiste en BD: `PaymentRecord` (nueva tabla o extendiendo `EventTest`/`MedicalEvent`)
- Cierra modal
- Toast: "Pago registrado"

### Generar y Enviar Recibo
- Genera PDF del recibo (usar `@react-pdf/renderer` existente)
- Si email: envía vía server action (nueva: `sendReceiptEmail`)
- Persiste registro de envío
- Toast: "Recibo generado y enviado"

---

## 6. Server Actions Necesarias

**Nuevo archivo:** `frontend/src/actions/payment.actions.ts`

```ts
// createPaymentRecord(data) → { success, paymentId, error }
// sendReceiptEmail(paymentId, email, pdfBuffer) → { success, error }
// getPaymentHistory(eventId) → { success, payments[] }
```

---

## 7. Modelo de Datos (Prisma)

**Opción A: Nueva tabla `PaymentRecord`** (recomendada)
```prisma
model PaymentRecord {
  id            String   @id @default(cuid())
  eventId       String
  event         MedicalEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  workerId      String
  amount        Decimal  @db.Decimal(10, 2)
  method        String   // EFECTIVO, TARJETA, TRANSFERENCIA, CHEQUE, OTRO
  reference     String?
  receiptSent   Boolean  @default(false)
  receiptEmail  String?
  receiptPdfUrl String?
  createdAt     DateTime @default(now())
  createdById   String
  createdBy     User     @relation(fields: [createdById], references: [id])
}
```

**Opción B: Extender `MedicalEvent` con campos de pago** (más simple, menos histórico)

> Decisión: Opción A para trazabilidad completa.

---

## 8. Flujo de Usuario

1. Usuario está en `/events/[id]` (cualquier vista)
2. Click en "Pago y Recibo" (botón junto a "Ficha trabajador")
3. Se abre modal centrado
4. Completa: método, monto, (opcional) referencia
5. Opcional: marca "Enviar recibo por email" → ingresa email
6. Click "Registrar pago" o "Generar y enviar recibo"
7. Loading → éxito → cierra modal → toast confirmación
8. (Opcional) Badge/indicador visual en header si hay pagos registrados

---

## 9. Validaciones

- Monto > 0
- Método seleccionado
- Si "enviar recibo" → email válido requerido
- Server-side: validar monto, método en catálogo permitido

---

## 10. Permisos

- Roles: ADMIN, DOCTOR, RECEPCION
- Solo lectura: NURSE (si aplica)

---

## 11. Entregables

| Archivo | Acción |
|---------|--------|
| `context/SPECs/SPEC_ARCH-20260630-01-MODAL-PAGO-RECIBO-PAPELETA.md` | Esta SPEC |
| `frontend/src/components/clinical/PaymentModal.tsx` | Nuevo componente modal |
| `frontend/src/actions/payment.actions.ts` | Server actions |
| `frontend/prisma/schema.prisma` | Add `PaymentRecord` model + migración |
| `frontend/src/app/events/[id]/page.tsx` | Integrar trigger + modal state |

---

## 12. Cómo Demostrar

1. Ir a `/events/[id]` (cualquier estado)
2. Click botón "Pago y Recibo" junto a "Ficha trabajador"
3. Llenar: Método "Efectivo", Monto "500.00"
4. Click "Registrar pago" → toast éxito
5. Reabrir modal → llenar + marcar "Enviar recibo" + email → "Generar y enviar"
6. Verificar PDF descargado / email enviado (logs)
7. Verificar persistencia en BD (`PaymentRecord`)

---

## 13. Notas Técnicas

- Reutilizar patrón de `CorroborationModal.tsx` para estructura del modal
- PDF: usar `@react-pdf/renderer` (ya en deps, ver `MedicalDictamenPDF.tsx`)
- Email: server action con nodemailer/Resend (config existente en backend)
- Migración Prisma: `pnpm prisma migrate dev --name add_payment_record`
- Typecheck: `pnpm typecheck` debe pasar