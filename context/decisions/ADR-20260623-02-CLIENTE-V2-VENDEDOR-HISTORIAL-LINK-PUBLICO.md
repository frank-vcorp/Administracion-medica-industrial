# ADR-20260623-02 — Ficha de Cliente v2: Vendedor, Habilitado, Historial y Link Público de Auto-Alta

**Fecha:** 2026-06-23
**Estado:** [✓] Aprobada
**ID:** ARCH-20260623-02

## Contexto

El sistema AMI gestiona clientes corporativos (`Company`) pero el modal actual `CompanyFormModal.tsx` solo captura 5 campos básicos (Razón Social, RFC, Contacto, Email, Sucursal default). Esto bloquea tres necesidades operativas reales:

1. **Asignación de vendedor**: Cada cliente debe estar ligado a un `User` con rol `vendedor` para comisiones, seguimiento comercial y SLA. No existe ni el rol ni el campo.
2. **Ciclo de vida del cliente**: No hay forma de deshabilitar un cliente sin borrarlo, ni trazabilidad de quién/quién/cuándo cambió su vendedor.
3. **Auto-alta de prospectos**: Hoy un prospecto que quiere darse de alta debe pasar obligatoriamente por un vendedor que capture todo el formulario manualmente. Esto bloquea campañas y ferias.

Adicionalmente, el formulario operativo real de "Alta de Cliente" (10 secciones, ver bloque del usuario) **nunca se implementó** en la plataforma — vive solo en operación manual.

## Decisión

### D1 — Ampliar `Company` con metadatos comerciales sin migrar campos legacy

Agregar a `Company`:

| Campo | Tipo | Default | Justificación |
|-------|------|---------|---------------|
| `sellerId` | String? (FK User) | null | Vendedor asignado actual |
| `sellerAssignedAt` | DateTime? | null | Cuándo se asignó el vendedor actual |
| `origen` | enum `CompanyOrigin` | `MANUAL` | Trazabilidad de cómo entró el cliente |
| `estado` | enum `CompanyStatus` | `PENDIENTE_REVISION` (auto-alta) / `HABILITADO` (manual) | Habilitado lógico |
| `enabledAt` | DateTime? | null | Cuándo se habilitó por primera vez |
| `enabledByUserId` | String? (FK User) | null | Qué vendedor/admin habilitó |

**Por qué flags en lugar de migrar campos**: Mantiene compatibilidad con las 13+ referencias existentes a `Company` (`Worker.companyId`, `Appointment.companyId`, `Project.companyId`, etc.). Solo se **agregan** campos opcionales.

### D2 — Nuevo modelo `CompanySellerHistory` (append-only)

```prisma
model CompanySellerHistory {
  id            String   @id @default(uuid())
  companyId     String
  previousSellerId String?
  newSellerId   String?
  changedByUserId String  // obligatorio
  changedAt     DateTime @default(now())
  reason        String?  // texto libre opcional
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  changedBy     User     @relation(fields: [changedByUserId], references: [id])
}
```

Cada cambio de vendedor genera **una fila nueva**. Nunca se borra. La fila "actual" se obtiene por `MAX(changedAt)` o por el `sellerId` en `Company`.

### D3 — Agregar rol `VENDEDOR` al enum `UserRole`

`VENDEDOR` se suma a los 6 roles existentes sin reordenar para no romper migraciones.

### D4 — Link público con token, replicando patrón `PrefilledInvitation`

```prisma
model CompanySelfRegistration {
  id              String   @id @default(uuid())
  tokenHash       String   @unique           // SHA-256 del token plano (nunca plano en DB)
  companyDraft    Json                        // payload completo de 10 secciones
  uploadedFiles   Json     @default("[]")    // array de file_urls ya en bucket
  status          CompanySelfRegStatus       // ACTIVE | SUBMITTED | EXPIRED | CANCELLED
  expiresAt       DateTime
  submittedCompanyId String?  @unique         // Company creada al enviar
  openedCount     Int      @default(0)
  submittedAt     DateTime?
  createdByUserId String?                      // vendedor/admin que generó link (opcional)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Patrón idéntico a** `PrefilledInvitation` (token + tokenHash + status + expiresAt + module1Data).

### D5 — Storage reutilizado: Railway Bucket existente

Reutilizar `POST /api/v1/upload-only` y la convención `file_url = /api/files/{key}` ya implementada (SPEC `ARCH-20260513-15`). El link público sube archivos al bucket con un **scope dedicado** (`companies/selfreg/{token}/...`) para que un admin pueda limpiarlos si el prospecto nunca envía.

### D6 — Mismo modelo `Company` para auto-alta y manual

Decisión confirmada con el usuario: **no hay tabla `Prospect` separada**. La auto-alta crea una `Company` con `origen = AUTO_ALTA` y `estado = PENDIENTE_REVISION`. Esto simplifica queries, listados y la ficha.

El vendedor revisa en `/companies?estado=PENDIENTE_REVISION`, edita/corrobora datos, asigna vendedor (o se asigna a sí mismo), y al confirmar crea `enabledAt`, `enabledByUserId`, primera fila de `CompanySellerHistory`.

### D7 — Reglas de visibilidad y habilitación

| Estado | Visible en `/companies` (listado general) | Visible en ficha `/companies/[id]` | Editable por vendedor | Aparece en citas/proyectos |
|--------|---|---|---|---|
| `PENDIENTE_REVISION` | Solo admin/vendedor | Solo admin/vendedor asignado | Sí (revisión) | No |
| `HABILITADO` | Todos los roles | Todos | Cualquier vendedor o admin | Sí |
| `DESHABILITADO` | Solo admin/vendedor | Solo admin/vendedor | Solo admin | No |

`enabled = false` ≠ eliminado: los datos persisten para auditoría y reportes históricos.

### D8 — Catálogos y validaciones

- **Estados** (`estado`): enum nuevo `CompanyStatus { PENDIENTE_REVISION, HABILITADO, DESHABILITADO }`.
- **Origen** (`origen`): enum nuevo `CompanyOrigin { MANUAL, AUTO_ALTA }`.
- **Auto-alta status** (`CompanySelfRegistration.status`): enum `CompanySelfRegStatus { ACTIVE, SUBMITTED, EXPIRED, CANCELLED }`.
- **Validaciones Zod**: El modal rápido (`CompanyFormModal`) sigue con 5 campos. El wizard extenso del link público valida las 10 secciones con un único `z.object` consolidado + campo-por-campo.

## Scope del corte único

### Incluido

- Migración Prisma: agregar enums + campos a `Company` + nuevos modelos `CompanySellerHistory`, `CompanySelfRegistration`.
- Migración de datos: clientes existentes → `origen = MANUAL`, `estado = HABILITADO`, `enabledAt = NOW()`.
- Ampliar `CompanyFormModal.tsx` con select de vendedor (rol=VENDEDOR), checkbox habilitado y badge de estado.
- Server action `changeCompanySeller(companyId, newSellerId, changedByUserId, reason?)` con escritura transaccional (`Company.sellerId` + `CompanySellerHistory`).
- Server action `generateCompanySelfRegLink(createdByUserId?, ttlHours=168)` → devuelve URL plana una sola vez y guarda solo el hash.
- Server action `submitCompanySelfRegistration(token, payload)` → crea `Company` con `origen=AUTO_ALTA, estado=PENDIENTE_REVISION` + crea `CompanySelfRegistration.status=SUBMITTED, submittedCompanyId=...`.
- Server action `reviewAndEnableCompany(companyId, reviewerUserId, options)` → vendedor/admin confirma datos, asigna vendedor, marca `estado=HABILITADO`, escribe `CompanySellerHistory` inicial.
- Ruta pública `/auto-alta/[token]` que renderiza formulario extenso de 10 secciones con subida de archivos al bucket.
- Ampliación de ficha `/companies/[id]` con panel de historial de vendedor (timeline) y badge de origen/estado.
- Filtros en `/companies` por `estado`, `origen`, `sellerId`.
- Catálogos SAT para `usoCFDI` y lista de estados de México (tabla seed o enum controlado).

### Excluido (futuro)

- Notificaciones automáticas al vendedor cuando llega un `PENDIENTE_REVISION`.
- Wizard multi-step con guardado parcial (la v1 es submit atómico).
- Multi-país (la v1 cubre México y sus catálogos).
- Aprobación de doble factor (ej. admin debe firmar después del vendedor).

## Archivos autorizados (≤10)

1. `frontend/prisma/schema.prisma` — nuevos enums, campos, modelos.
2. `frontend/prisma/migrations/20260623_company_v2/migration.sql` — migración.
3. `frontend/prisma/seed.ts` — seed catálogos SAT + estados México + vendedor demo.
4. `frontend/src/components/CompanyFormModal.tsx` — agregar vendedor, habilitado, estado.
5. `frontend/src/components/companies/CompanySellerHistoryPanel.tsx` (nuevo) — timeline.
6. `frontend/src/app/companies/[id]/page.tsx` — integrar panel de historial.
7. `frontend/src/app/companies/page.tsx` — filtros por estado/origen/vendedor.
8. `frontend/src/app/auto-alta/[token]/page.tsx` (nuevo) — formulario público.
9. `frontend/src/actions/company.actions.ts` — extender con `changeCompanySeller`, `generateCompanySelfRegLink`, `submitCompanySelfRegistration`, `reviewAndEnableCompany`.
10. `frontend/src/services/company.service.ts` — lógica de negocio (transacciones, hashing token).

## Restricciones

1. No tocar `Worker`, `Appointment`, `Project` ni `MedicalEvent`. Solo se agregan campos opcionales a `Company`.
2. Reutilizar `boto3`/bucket S3 existente; no introducir proveedor de storage nuevo.
3. Token plano NUNCA se persiste — solo `tokenHash` (SHA-256), igual que `PrefilledInvitation`.
4. Subida de archivos del link público debe pasar por `/api/v1/upload-only` con scope `companies/selfreg/{token}/`.
5. Validación Zod obligatoria en server actions; el cliente solo valida UX.
6. Un cliente no se elimina físicamente; el flujo de baja es `DESHABILITADO`.

## Validación

```bash
cd frontend && pnpm typecheck
cd frontend && pnpm test
cd frontend && pnpm lint
```

**Smoke test manual**:

1. Login admin → ir a `/companies` → click "Nueva Empresa" → ver campos nuevos (vendedor, habilitado).
2. Login con rol VENDEDOR → generar link de auto-alta → abrir en ventana incógnito → llenar 10 secciones con archivos → enviar.
3. Login vendedor en `/companies?estado=PENDIENTE_REVISION` → abrir el prospecto → revisar/corregir → asignar vendedor → habilitar.
4. Verificar historial de vendedor en `/companies/[id]` muestra 2 entradas (inicial + revisión).
5. Cambiar vendedor desde ficha → verificar nueva fila en historial con `changedBy` correcto.
6. Verificar que cliente `DESHABILITADO` no aparece en `/companies` para rol `RECEPTIONIST`.

## Referencias

- `frontend/src/components/CompanyFormModal.tsx` — modal actual.
- `frontend/src/services/company.service.ts` — service actual.
- `context/SPECs/SPEC_ARCH-20260513-15-STORAGE-BUCKET-RAILWAY.md` — storage reutilizado.
- `frontend/prisma/schema.prisma` modelo `PrefilledInvitation` — patrón de token replicado.
