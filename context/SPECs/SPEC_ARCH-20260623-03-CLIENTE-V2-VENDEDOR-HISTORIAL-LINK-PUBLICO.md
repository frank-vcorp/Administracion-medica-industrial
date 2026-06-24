# SPEC ARCH-20260623-03 — Ficha de Cliente v2: Vendedor, Habilitado, Historial y Link Público de Auto-Alta

**ID:** ARCH-20260623-03
**Fecha:** 2026-06-23
**Estado:** Planificado
**ADR:** `context/decisions/ADR-20260623-02-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md`

## Objetivo

Reemplazar el modal básico actual de "Nueva Empresa" por una ficha de cliente corporativa completa que soporte:

1. Asignación de vendedor (`User.role = VENDEDOR`) con historial append-only.
2. Checkbox de habilitado (estados `PENDIENTE_REVISION | HABILITADO | DESHABILITADO`).
3. Link público de auto-alta para prospectos, con flujo de revisión por vendedor antes de habilitar.
4. Persistencia de las 10 secciones del formulario fiscal/bancario/contacto/documentos.

## Contexto funcional

El sistema AMI (`Next.js 16.1.6` App Router, Prisma 5.22, PostgreSQL, NextAuth, Zod) ya tiene `Company` con 11 campos básicos. El modal `CompanyFormModal.tsx` está montado en `/companies` y consume `createCompany` en `admin.actions.ts`.

La ficha actual `/companies/[id]/page.tsx` muestra datos básicos + lista de trabajadores + sucursales + perfiles médicos. No tiene historial de vendedor ni badges de estado.

El storage ya está migrado al Railway Bucket S3-compatible (`t3.storageapi.dev`, bucket `shelved-pod-d66dcokrpe-ik`), con endpoint `/api/v1/upload-only` que sube archivos y devuelve `file_url = /api/files/{key}` (SPEC `ARCH-20260513-15`).

Existe precedente de link público por token: `PrefilledInvitation` usa `tokenHash` SHA-256 + `expiresAt` + status. Se replica el mismo patrón.

## Alcance

### Funcional — Modal rápido (mejorado)

El `CompanyFormModal.tsx` actual se reemplaza por uno que captura:

| Campo | Tipo | Obligatorio | Default |
|-------|------|-------------|---------|
| Razón Social | text | sí | — |
| RFC | text (uppercase) | sí | — |
| Contacto principal | text | no | — |
| Email | email | no | — |
| Sucursal default | select | no | — |
| **Vendedor asignado** | select (User.role=VENDEDOR) | sí si `origen=MANUAL` | — |
| **Habilitado** | checkbox | no | `true` |

Comportamiento: si el vendedor no se asigna al crear, queda `sellerId=null` y se puede asignar después desde la ficha.

### Funcional — Link público de auto-alta

Ruta: `GET /auto-alta/[token]` (sin auth, valida token contra `tokenHash`).

Renderiza formulario extenso con 10 secciones:

**Sección 1 — Información General y Fiscal**
- Fecha (date con select Mes/Día/Año)
- Razón Social *
- RFC * (validación regex mexicano)
- Giro de la empresa * (text con texto de ayuda)
- Domicilio Fiscal * (calle + número int/ext)
- Colonia *
- Estado * (select desde catálogo `EstadoMexico`)
- Municipio *
- País * (default México)
- CP * (5 dígitos)
- Uso de CFDI * (select desde catálogo SAT)
- Método de Pago * (radio: PUE | PPD)

**Sección 2 — Datos Bancarios (opcional)**
- Banco Ordenante
- Número de Cuenta

**Sección 3 — Representante Legal**
- Nombre * / Apellidos * / Puesto * / Teléfono * / Ext. / E-mail *

**Sección 4 — Responsable RH/Seguridad/Compras**
- Mismos 6 campos (todos obligatorios)

**Sección 5 — Responsable Cuentas por Pagar**
- Mismos 6 campos (todos obligatorios)

**Sección 6 — Facturación y Envío de XML**
- Correo recepción XML *
- Correo recepción complemento de pago (opcional)
- Proceso de facturación (textarea)

**Sección 7 — Entrega Factura Física (opcional)**
- Días de entrega (checkboxes L-V)
- Horario recepción documentos (select hora 9-17, select minuto 00-59)
- Datos del contacto que recibe (textarea agrupado: nombre, tel, cel)

**Sección 8 — Referencias Comerciales y Portales (opcional)**
- Hasta 3 referencias (nombre, RFC, tel, cel cada una)
- Página web del portal (URL)

**Sección 9 — Documentación Adjunta**
- Constancia de situación fiscal (RFC) * — máx 3 MB
- Identificación oficial del representante legal * — máx 3 MB
- Comprobante de domicilio * — máx 2 MB
- Opinión positiva del SAT (mes en curso) * — máx 4 MB
- Acta constitutiva * — máx 10 MB
- Otra documentación — máx 10 MB

Extensiones permitidas en todos: `gif, jpg, jpeg, png, pdf, doc, docx, zip`.

**Sección 10 — Términos y Condiciones**
- Aceptación (radio SI/No) *

**Submit**: envía el payload completo + array de file_urls ya subidos al bucket. Server action `submitCompanySelfRegistration(token, payload)` valida con Zod, crea `Company` con `origen=AUTO_ALTA, estado=PENDIENTE_REVISION`, marca `CompanySelfRegistration.status=SUBMITTED`, `submittedCompanyId=company.id`.

### Funcional — Ficha del cliente `/companies/[id]`

Paneles:
1. **Datos generales** (todos los capturados del modal rápido).
2. **Formulario fiscal completo** (las 10 secciones, solo lectura si proviene de AUTO_ALTA y aún `PENDIENTE_REVISION`; editable por vendedor/admin si `HABILITADO`).
3. **Documentos adjuntos** (links presigned a `/api/files/{key}` desde bucket).
4. **Historial de vendedor** (`CompanySellerHistoryPanel.tsx`): timeline cronológico con vendedor anterior → nuevo, `changedBy`, fecha/hora.
5. **Asignar/Cambiar vendedor**: dropdown con todos los `User.role=VENDEDOR`, requiere confirmar cambio y registra en historial.
6. **Toggle habilitado/deshabilitado**: solo admin.

### Funcional — Listado `/companies` con filtros

- Filtros: `estado`, `origen`, `sellerId`, búsqueda por `name`/`rfc`.
- Badges visuales por estado y origen.

## Modelo de datos (delta)

```prisma
// ===========================================================================
// IMPL-20260623-02: Ficha Cliente v2 (ARCH-20260623-03)
// Ref: context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
// ===========================================================================

enum CompanyStatus {
  PENDIENTE_REVISION  // Creado por auto-alta, esperando vendedor
  HABILITADO          // Activo y visible para operaciones
  DESHABILITADO       // Bloqueado (datos persisten)
}

enum CompanyOrigin {
  MANUAL     // Vendedor/admin lo creó
  AUTO_ALTA  // Prospecto usó link público
}

enum CompanySelfRegStatus {
  ACTIVE      // Token vigente, aún no envía
  SUBMITTED   // Ya envió, generó Company
  EXPIRED     // Pasó expiresAt sin enviar
  CANCELLED   // Vendedor/admin lo invalidó
}

enum CfdiUso {
  G01 G02 G03 B01 B02 B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 B13 B14 B15 B16 B17 B18 B19 B20
  // … catálogo SAT completo
  P01 S01 CP01 CN01
}

model Company {
  // … campos existentes …
  sellerId        String?
  seller          User?          @relation("CompanySeller", fields: [sellerId], references: [id])
  sellerAssignedAt DateTime?
  origen          CompanyOrigin  @default(MANUAL)
  estado          CompanyStatus  @default(HABILITADO)
  enabledAt       DateTime?
  enabledByUserId String?
  enabledBy       User?          @relation("CompanyEnabledBy", fields: [enabledByUserId], references: [id])

  // Datos completos del formulario extenso (10 secciones)
  fiscalData           Json?      // Sección 1 + 2 + 6 + 7
  repLegalData         Json?      // Sección 3
  rhData               Json?      // Sección 4
  cuentasPagarData     Json?      // Sección 5
  referenciasData      Json?      // Sección 8
  terminosAceptados    Boolean?   // Sección 10
  documentosAdjuntos   Json?      // Sección 9: [{nombre, fileUrl, fileKey, size, mime}]

  sellerHistory        CompanySellerHistory[]
  selfRegistrations    CompanySelfRegistration[]
}

/// Historial append-only de cambios de vendedor. NUNCA se borra.
model CompanySellerHistory {
  id               String   @id @default(uuid())
  companyId        String
  previousSellerId String?
  newSellerId      String?
  changedByUserId  String
  changedAt        DateTime @default(now())
  reason           String?

  company       Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  previousSeller User?  @relation("PreviousSeller", fields: [previousSellerId], references: [id])
  newSeller     User?   @relation("NewSeller", fields: [newSellerId], references: [id])
  changedBy     User    @relation("ChangedBy", fields: [changedByUserId], references: [id])

  @@index([companyId, changedAt])
  @@map("company_seller_history")
}

/// Link público para auto-alta de prospectos. Token plano NUNCA persiste.
model CompanySelfRegistration {
  id                  String              @id @default(uuid())
  tokenHash           String              @unique           // SHA-256 del token plano
  companyDraft        Json?                                  // borrador parcial (futuro multi-step)
  uploadedFiles       Json                @default("[]")    // [{key, filename, size, mime, section}]
  status              CompanySelfRegStatus @default(ACTIVE)
  expiresAt           DateTime
  openedCount         Int                 @default(0)
  submittedAt         DateTime?
  submittedCompanyId  String?             @unique
  createdByUserId     String?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  submittedCompany Company? @relation(fields: [submittedCompanyId], references: [id])
  createdBy        User?    @relation(fields: [createdByUserId], references: [id])

  @@map("company_self_registrations")
}

/// Catálogo de estados de México (seed estático)
model EstadoMexico {
  id        Int      @id          // clave INEGI
  nombre    String
  municipios String[] // nombres comunes; municipios reales se validan contra servicio externo
  @@map("estados_mexico")
}
```

## Arquitectura técnica

### Frontend — Server actions (en `frontend/src/actions/company.actions.ts`)

```ts
// Helpers internos
function hashToken(plain: string): string { /* SHA-256 */ }

// 1. Generar link de auto-alta
generateCompanySelfRegLink(createdByUserId?: string, ttlHours = 168)
  → { token: string /* plano, solo se devuelve aquí */, url: string, expiresAt: Date }

// 2. Validar token (sin auth)
validateCompanySelfRegToken(token: string)
  → { status: CompanySelfRegStatus, expiresAt, openedCount }
// Incrementa openedCount

// 3. Subir archivo desde link público (usa endpoint existente con scope dedicado)
uploadSelfRegFile(token: string, file: File, section: string)
  → { fileUrl: '/api/files/companies/selfreg/{token}/{section}/{filename}', key: string }

// 4. Enviar formulario completo
submitCompanySelfRegistration(token: string, payload: CompanyFullFormPayload)
  → { success: boolean, companyId: string, error?: string }

// 5. Cambiar vendedor (con historial)
changeCompanySeller(companyId: string, newSellerId: string | null, changedByUserId: string, reason?: string)
  → Transacción: UPDATE Company.sellerId, sellerAssignedAt, INSERT CompanySellerHistory

// 6. Revisar y habilitar (flujo vendedor en auto-alta)
reviewAndEnableCompany(
  companyId: string,
  reviewerUserId: string,
  options: { sellerId: string; corrections?: Partial<CompanyFullFormPayload> }
)
  → Transacción: UPDATE Company (estado, sellerId, enabledAt, enabledByUserId, enabledSellerSnapshot),
                  INSERT CompanySellerHistory (inicial),
                  UPDATE CompanySelfRegistration.status = SUBMITTED si aplica

// 7. Toggle habilitado/deshabilitado
toggleCompanyEnabled(companyId: string, enabledByUserId: string, enabled: boolean)
  → Solo admin. UPDATE Company.estado + AuditLog.
```

### Frontend — Rutas

| Ruta | Auth | Descripción |
|------|------|-------------|
| `/companies` | Sesión activa | Listado con filtros |
| `/companies/[id]` | Sesión activa | Ficha + historial + edición |
| `/auto-alta/[token]` | **Pública** | Formulario extenso 10 secciones |

### Frontend — Componentes nuevos/modificados

- `CompanyFormModal.tsx` — agrega vendedor, habilitado.
- `CompanySellerHistoryPanel.tsx` — timeline cronológico.
- `CompanyFullFormView.tsx` — renderizador readonly + editable de las 10 secciones.
- `SelfRegistrationForm.tsx` — formulario público por secciones con subida de archivos.
- `CompanyStatusBadge.tsx` — badge visual por estado/origen.

### Backend — Endpoints reutilizados

- `POST /api/v1/upload-only` — subida al bucket (sin cambios).
- `GET /api/files/{key}` — presigned URL (sin cambios).

No se requieren cambios en `backend/app/main.py`. La subida desde el link público consume el endpoint existente con un path key dedicado: `companies/selfreg/{tokenHash[:8]}/{section}/{filename}`.

## Validaciones Zod (clave)

```ts
const RepLegalSchema = z.object({
  nombre: z.string().min(1),
  apellidos: z.string().min(1),
  puesto: z.string().min(1),
  telefono: z.string().min(7),
  extension: z.string().optional(),
  email: z.string().email()
});

const FiscalSchema = z.object({
  fecha: z.string().datetime(),
  razonSocial: z.string().min(1),
  rfc: z.string().regex(/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/, 'RFC inválido'),
  giro: z.string().min(1),
  domicilio: z.string().min(1),
  colonia: z.string().min(1),
  estado: z.string().min(1), // validado contra catálogo
  municipio: z.string().min(1),
  pais: z.string().default('México'),
  cp: z.string().regex(/^\d{5}$/, 'CP debe ser 5 dígitos'),
  usoCFDI: z.enum(CfdiUsoValues),
  metodoPago: z.enum(['PUE', 'PPD'])
});

const CompanyFullFormPayloadSchema = z.object({
  fiscal: FiscalSchema,
  bancario: z.object({ banco: z.string().optional(), cuenta: z.string().optional() }).optional(),
  repLegal: RepLegalSchema,
  rh: RepLegalSchema,
  cuentasPagar: RepLegalSchema,
  facturacion: z.object({
    correoXml: z.string().email(),
    correoComplemento: z.string().email().optional(),
    procesoFacturacion: z.string().optional()
  }),
  entregaFisica: z.object({ /* …opcional… */ }).optional(),
  referencias: z.array(z.object({ /* hasta 3 */ })).max(3).optional(),
  documentos: z.array(z.object({
    nombre: z.string(),
    key: z.string(),
    size: z.number().max(10 * 1024 * 1024),
    mime: z.string()
  })).min(5, 'Faltan documentos obligatorios'),
  terminosAceptados: z.literal(true, { errorMap: () => ({ message: 'Debe aceptar términos' }) })
});
```

## Edge cases

1. Token expirado al enviar → `submitCompanySelfRegistration` retorna error `TOKEN_EXPIRED`; UI muestra mensaje y oculta formulario.
2. Archivo mayor al límite → rechazo en cliente antes de POST y validación server-side por `size`.
3. RFC duplicado al enviar auto-alta → `submitCompanySelfRegistration` retorna `RFC_DUPLICATE` con link a `/companies/[id]` del existente; UI sugiere contactar vendedor.
4. Vendedor inactivo intenta asignarse → `changeCompanySeller` rechaza si `User.isActive=false`.
5. Cliente `DESHABILITADO` con citas pasadas → citas previas persisten, solo se bloquea creación de nuevas (`Appointment.create` valida `billingCompany.estado === HABILITADO`).
6. Token adivinado (256 bits) → entropía > 2^200, no factible por fuerza bruta; aun así, expiración 168h por defecto.
7. Vendedor asignado a sí mismo en revisión → permitido; `CompanySellerHistory.changedByUserId === newSellerId`.

## Migración de datos

```sql
-- 1. Agregar columnas con defaults seguros
ALTER TABLE companies
  ADD COLUMN "sellerId" TEXT,
  ADD COLUMN "sellerAssignedAt" TIMESTAMP,
  ADD COLUMN "origen" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'HABILITADO',
  ADD COLUMN "enabledAt" TIMESTAMP,
  ADD COLUMN "enabledByUserId" TEXT,
  ADD COLUMN "fiscalData" JSONB,
  ADD COLUMN "repLegalData" JSONB,
  ADD COLUMN "rhData" JSONB,
  ADD COLUMN "cuentasPagarData" JSONB,
  ADD COLUMN "referenciasData" JSONB,
  ADD COLUMN "terminosAceptados" BOOLEAN,
  ADD COLUMN "documentosAdjuntos" JSONB;

-- 2. Backfill: clientes existentes quedan MANUAL + HABILITADO + fecha de hoy
UPDATE companies
SET "enabledAt" = NOW(),
    "enabledByUserId" = (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1)
WHERE "enabledAt" IS NULL;

-- 3. Crear nuevos modelos
CREATE TABLE "company_seller_history" (...);
CREATE TABLE "company_self_registrations" (...);

-- 4. Crear catálogo de estados
CREATE TABLE "estados_mexico" (...);
-- Seed con 32 entidades federativas
```

## Archivos de implementación (≤10)

1. `frontend/prisma/schema.prisma` — enums + campos + nuevos modelos.
2. `frontend/prisma/seed.ts` — catálogos + vendedor demo.
3. `frontend/src/components/CompanyFormModal.tsx` — UI mejorada.
4. `frontend/src/components/companies/CompanySellerHistoryPanel.tsx` (nuevo).
5. `frontend/src/components/companies/CompanyFullFormView.tsx` (nuevo).
6. `frontend/src/components/companies/SelfRegistrationForm.tsx` (nuevo).
7. `frontend/src/app/companies/[id]/page.tsx` — integrar paneles.
8. `frontend/src/app/auto-alta/[token]/page.tsx` (nuevo) — ruta pública.
9. `frontend/src/actions/company.actions.ts` — server actions nuevas.
10. `frontend/src/services/company.service.ts` — transacciones y hashing.

## Validación

```bash
cd frontend && pnpm typecheck
cd frontend && pnpm test
cd frontend && pnpm lint
```

**Smoke test manual**:

1. Login admin → crear empresa rápida con vendedor → verificar en `/companies` con badge `HABILITADO | MANUAL`.
2. Cambiar vendedor desde ficha → nueva fila en historial con `changedBy=admin_id`.
3. Login vendedor → "Generar link de auto-alta" → copiar URL.
4. Ventana incógnito → abrir link → llenar 10 secciones con archivos reales → enviar.
5. Login vendedor en `/companies?estado=PENDIENTE_REVISION` → abrir prospecto → editar datos si requiere → asignar vendedor (sí mismo) → habilitar.
6. Verificar ficha del prospecto ahora muestra `HABILITADO | AUTO_ALTA`, historial con 1 entrada (asignación inicial).
7. Deshabilitar desde admin → intentar crear cita para ese cliente → debe ser bloqueado.

## Referencias

- `context/decisions/ADR-20260623-02-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md`
- `context/SPECs/SPEC_ARCH-20260513-15-STORAGE-BUCKET-RAILWAY.md` — storage reutilizado.
- `frontend/prisma/schema.prisma` modelo `PrefilledInvitation` — patrón de token.
- `frontend/src/components/CompanyFormModal.tsx` — modal actual a extender.
- `context/00_ARQUITECTURA.md` — stack confirmado.
