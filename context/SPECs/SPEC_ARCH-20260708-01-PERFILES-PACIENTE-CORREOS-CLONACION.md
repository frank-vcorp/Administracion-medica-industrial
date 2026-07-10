# SPEC_ARCH-20260708-01

## Título
Datos completos del paciente y perfiles: múltiples correos de envío, comentarios especiales, clonación de perfiles y distinción de altas masivas (unidad móvil vs clínica).

## Origen
- Junta semanal 2026-07-01 (`context/Juntas/Junta semanal de revisión de avances del sistema 2.0.txt`).
- Revisión de pendientes 2026-07-08 (`context/Juntas/REVISION_JUNTA_2026-07-01.md`).

## Objetivo
Cerrar los 4 puntos prioritarios del bloque "datos del paciente y perfil médico" identificados en la revisión de la junta, sin romper nada existente y sin migraciones destructivas.

## Decisiones de producto

### Decisión 1 — Múltiples correos de envío de resultados en paciente
- La ficha del paciente debe permitir hasta **5 correos seleccionables** preconfigurados por la clínica + **1 campo libre** para correos adicionales.
- Se rechaza el modelo "un solo campo con punto y coma" por limitar el control de envíos.
- Los correos se configuran a nivel **perfil médico** (regla de negocio: "ciertos perfiles reportan a ciertos correos") y se sobreescriben opcionalmente a nivel paciente para casos especiales (ej. "solo mandar a fulanita").

### Decisión 2 — Comentarios adicionales en perfil médico
- El perfil médico debe tener un campo de texto libre para requisitos especiales:
  - Requiere firma autógrafa.
  - Adjuntar cédula del médico.
  - Pruebas que NO deben reportarse (ej. VIH).
  - Formatos especiales.
- Este campo es **empresa-específico** o **global** según `companyId` del perfil.

### Decisión 3 — Clonación de perfiles médicos
- Agregar botón "Duplicar/Clonar" en `MedicalProfilesManager` y en `CompanyMedicalProfilesPanel`.
- Al clonar: copia nombre + pruebas + correos + comentarios + flags especiales, y permite renombrar antes de guardar.
- La clonación es la vía oficial para crear variantes de un perfil sin contaminar el original (acordado en junta: NO se permite agregar pruebas libres a perfil existente).

### Decisión 4 — Distinción programática de altas masivas
- El sistema debe distinguir claramente entre:
  - **Alta masiva para proyecto de unidad móvil** (vía `Project` + `BulkWorkerImportModal`): conserva contexto de proyecto, clínica móvil, fechas.
  - **Alta masiva para clínica física** (vía nuevo flujo `quickRegisterClinicWalkIn`): pacientes que llegan al mostrador sin proyecto previo, sin crear `Project`, sin agendar cita.
- Las dos rutas usan componentes distintos y dejan huella distinta en `Worker` + log de auditoría.

## Datos existentes a reutilizar
- `MedicalProfile` (`prisma/schema.prisma` línea 274) — base de perfiles.
- `ProfileTest` — pivot de pruebas por perfil.
- `Worker.email` (línea 169 schema.prisma) — correo primario del paciente (se conserva como "correo principal").
- `BulkWorkerImportModal` + `bulkImportWorkers` action — base para alta masiva.
- `quickRegisterWorkersSameDay` — base para alta rápida del mismo día.
- `MedicalProfilesManager` y `CompanyMedicalProfilesPanel` — UI existentes.

## Datos faltantes a crear

### Schema Prisma (migración aditiva, NO destructiva)
1. **Nueva tabla `MedicalProfileReportEmail`** (correos por perfil médico):
   ```
   id            String   @id @default(uuid())
   profileId     String
   email         String
   label         String?  // ej. "Gerente RH", "Médico ocupacional"
   createdAt     DateTime @default(now())
   profile       MedicalProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
   @@unique([profileId, email])
   @@map("medical_profile_report_emails")
   ```
2. **Nueva tabla `WorkerReportEmail`** (correos adicionales por paciente, hasta 5):
   ```
   id            String   @id @default(uuid())
   workerId      String
   email         String
   isPrimary     Boolean  @default(false)
   createdAt     DateTime @default(now())
   worker        Worker   @relation(fields: [workerId], references: [id], onDelete: Cascade)
   @@unique([workerId, email])
   @@map("worker_report_emails")
   ```
3. **Nueva columna en `MedicalProfile`**:
   ```
   specialNotes  String?  // comentarios adicionales: firma autógrafa, cédula, pruebas excluidas
   ```
4. **Nueva columna en `Worker`** (para alta rápida de clínica física sin proyecto):
   ```
   intakeSource  IntakeSource @default(PROJECT_SAME_DAY)
   // valores existentes: APPOINTMENT | PROJECT_PRE_REGISTERED | PROJECT_SAME_DAY | EXTERNAL_WALK_IN | DIRECT_RECEPTION
   // nuevos valores a agregar al enum: CLINIC_WALK_IN_MASS | UNIT_MOBILE_MASS
   ```
5. **Extender enum `IntakeSource`** con dos valores:
   - `CLINIC_WALK_IN_MASS` (alta masiva para clínica física)
   - `UNIT_MOBILE_MASS` (alta masiva para proyecto de unidad móvil)

### Server actions nuevos / modificados
- En `medical-profiles.ts`:
  - `getMedicalProfileWithEmails(profileId)` → incluye correos configurados.
  - `addProfileReportEmail(profileId, email, label?)` → crea correo.
  - `removeProfileReportEmail(emailId)` → elimina correo.
  - `updateProfileSpecialNotes(profileId, notes)` → edita campo `specialNotes`.
  - `cloneMedicalProfile(profileId, newName)` → clona perfil + pruebas + correos + notas.
- En `worker.actions.ts`:
  - `bulkRegisterClinicWalkIn(rows, branchId)` → alta masiva para clínica física (sin Project), marca `intakeSource = CLINIC_WALK_IN_MASS`.
  - Mantener `bulkImportWorkers` actual para unidad móvil (marca `intakeSource = UNIT_MOBILE_MASS`).
  - `addWorkerReportEmail(workerId, email, isPrimary?)` → crea correo.
  - `removeWorkerReportEmail(emailId)` → elimina correo.

### Componentes UI nuevos / modificados
- **Modificar** `MedicalProfilesManager.tsx`:
  - Agregar botón "Clonar" en cada tarjeta de perfil.
  - Agregar campo "Comentarios especiales" en el modal de crear/editar.
  - Agregar sección "Correos de envío de resultados" (hasta N correos).
- **Modificar** `CompanyMedicalProfilesPanel.tsx`: mismas adiciones que el manager global.
- **Crear** `BulkClinicWalkInImportModal.tsx`: alta masiva para clínica física, separada visualmente de `BulkWorkerImportModal`.
- **Modificar** `WorkersTable.tsx` (o crear subcomponente): permitir hasta 5 correos editables por paciente.

## Comportamiento funcional requerido

### 1. Múltiples correos por perfil médico (sub-bloque A)
- En el modal de crear/editar perfil: sección "Correos de envío de resultados" con:
  - Lista de correos configurados.
  - Botón "+ Agregar correo" → input de email + label opcional.
  - Botón "×" por correo para eliminar.
- Sin límite duro en BD; UI sugiere hasta 10 como máximo razonable.
- `Worker.email` se conserva como **correo principal del paciente** (catálogo "Adicionales" = hasta 5).

### 2. Múltiples correos por paciente (sub-bloque B)
- En la ficha del paciente (worker detail): sección "Envío de resultados" con:
  - Checkbox por cada correo del catálogo "Adicionales" (hasta 5).
  - Campo libre "Otros correos (separar por coma)".
  - Estado preseleccionado al crear paciente.
- La combinación efectiva de envío = correos del perfil + correos del paciente + campo libre.

### 3. Comentarios especiales en perfil (sub-bloque C)
- Campo `<textarea>` en el modal de perfil, placeholder: "Firma autógrafa, cédula del médico, pruebas no reportadas, formatos especiales...".
- Se muestra como bloque visible en la vista del perfil.
- Longitud máxima: 2000 caracteres.

### 4. Clonación de perfil (sub-bloque D)
- Botón "Duplicar" en cada tarjeta.
- Al hacer clic:
  - Abre modal prellenado con `name = "{nombre original} (Copia)"` + todas las pruebas + correos + notas.
  - Usuario puede editar nombre y campos antes de guardar.
  - Al guardar: crea perfil nuevo, mantiene referencia visual al original vía tooltip "(clonado de {nombre original})".
- Validación: el nombre clonado debe ser único (Zod ya lo exige).

### 5. Distinción de altas masivas (sub-bloque E)
- En `/workers`, agregar dos botones separados:
  - "Carga Masiva — Unidad Móvil" (verde): abre `BulkWorkerImportModal` con selector de proyecto.
  - "Carga Masiva — Clínica Física" (azul): abre `BulkClinicWalkInImportModal` con selector de sucursal.
- Cada uno usa un action distinto y graba `intakeSource` distinto.
- En auditoría: `AuditLog.action = 'BULK_IMPORT_CLINIC'` vs `'BULK_IMPORT_UNIT'`.

## Scope exacto para Sofia

### Archivos ancla iniciales
- `frontend/prisma/schema.prisma`
- `frontend/src/actions/medical-profiles.ts`
- `frontend/src/actions/worker.actions.ts`
- `frontend/src/components/MedicalProfilesManager.tsx`
- `frontend/src/components/BulkClinicWalkInImportModal.tsx` (nuevo)

### Archivos exactos a modificar o crear
- Modificar `frontend/prisma/schema.prisma` (5 cambios aditivos).
- Crear `frontend/prisma/migrations/20260708XXXXXX_add_profile_emails_and_special_notes/migration.sql` (o el nombre estándar que Prisma genere).
- Modificar `frontend/src/actions/medical-profiles.ts` (5 actions nuevas/modificadas).
- Modificar `frontend/src/actions/worker.actions.ts` (3 actions nuevas/modificadas).
- Modificar `frontend/src/components/MedicalProfilesManager.tsx` (clonar + correos + notas).
- Modificar `frontend/src/components/CompanyMedicalProfilesPanel.tsx` (mismas adiciones).
- Crear `frontend/src/components/BulkClinicWalkInImportModal.tsx`.
- Modificar `frontend/src/app/workers/page.tsx` (dos botones de carga masiva).
- Crear `frontend/src/components/workers/WorkerReportEmailsPanel.tsx` (gestión de correos por paciente).

### Máximo de archivos permitidos
- **10 archivos**.
- Si Sofia detecta que necesita un undécimo archivo, debe detenerse y devolver `BLOQUEO DE CONTEXTO` con la justificación exacta.

## Diseño técnico aprobado

### A. `schema.prisma`
- Agregar `IntakeSource.CLINIC_WALK_IN_MASS` y `IntakeSource.UNIT_MOBILE_MASS` al enum.
- Agregar `specialNotes String?` a `MedicalProfile`.
- Crear modelos `MedicalProfileReportEmail` y `WorkerReportEmail` con relaciones inversas.
- Migración aditiva (no se borran columnas existentes).

### B. `medical-profiles.ts`
- Agregar Zod schema `ReportEmailSchema = z.object({ email: z.string().email(), label: z.string().max(100).optional() })`.
- `cloneMedicalProfile(profileId, newName)` debe ejecutarse en una transacción Prisma que:
  1. Crea nuevo `MedicalProfile` (copia name, companyId, specialNotes).
  2. Crea `ProfileTest` rows para cada testId del original.
  3. Crea `MedicalProfileReportEmail` rows para cada email del original.
- Todos los nuevos actions revalidan `/admin/profiles` y `/companies/[companyId]` cuando aplica.

### C. `worker.actions.ts`
- `bulkRegisterClinicWalkIn(rows, branchId)`:
  - Valida `rows.length <= 20` (límite "clínica física" según junta).
  - Cada fila requiere al menos `firstName + lastName`.
  - Crea `Worker` con `companyId = null` si no se especifica, o con la empresa si se selecciona.
  - Marca `intakeSource = 'CLINIC_WALK_IN_MASS'`.
  - NO crea `ProjectWorker` (no hay proyecto).
  - Retorna mismo `BulkImportResult` que `bulkImportWorkers`.
- `bulkImportWorkers` debe marcar `intakeSource = 'UNIT_MOBILE_MASS'` en cada worker creado (cambio mínimo, no rompe API existente).
- `addWorkerReportEmail` y `removeWorkerReportEmail` validan máximo 5 correos por worker (constraint UI; si excede retorna error).

### D. `MedicalProfilesManager.tsx`
- En el modal, agregar tabs internas (simples, sin librería): "Datos básicos" | "Pruebas" | "Correos de envío" | "Comentarios especiales".
- Botón "Duplicar" llama a `cloneMedicalProfile` server action y refresca lista.
- Sección "Correos de envío": lista + form inline para agregar.

### E. `BulkClinicWalkInImportModal.tsx`
- Estructura similar a `BulkWorkerImportModal` pero:
  - En vez de selector de proyecto, tiene selector de sucursal (`branchId`).
  - En vez de "Carga masiva desde Excel", ofrece paste manual de filas (estilo `quickRegisterWorkersSameDay`).
  - Hasta 20 filas (no 200).
  - Botón primario: "Registrar llegadas".

### F. `workers/page.tsx`
- Agregar segundo botón `BulkClinicWalkInImportModal` junto al existente `BulkWorkerImportModal`.
- Distinguir visualmente con icono + color distinto.

### G. `WorkerReportEmailsPanel.tsx`
- Client component nuevo.
- Lista correos existentes (max 5).
- Form inline para agregar (email + checkbox "es principal").
- Botón eliminar por correo.
- Llama a `addWorkerReportEmail` / `removeWorkerReportEmail`.

## Fuera de alcance (explícito)
- **NO** se refactoriza el módulo de pagos (`PaymentRecord.receiptEmail` se queda como está).
- **NO** se cambia la API pública de `bulkImportWorkers` ni su firma.
- **NO** se migran datos existentes (los workers actuales quedan con `intakeSource` por default `PROJECT_SAME_DAY`).
- **NO** se toca el módulo de calibración IA.
- **NO** se modifica el flujo de auto-alta público (`/auto-alta/[token]`).
- **NO** se rediseña `WorkersTable`; solo se añade el panel de correos en `/workers/[id]`.

## Validación exacta esperada

### Comandos
```bash
# 1. Generar y aplicar migración
cd frontend
pnpm prisma migrate dev --name add_profile_emails_and_special_notes

# 2. Lint y typecheck
pnpm lint src/actions/medical-profiles.ts src/actions/worker.actions.ts src/components/MedicalProfilesManager.tsx src/components/CompanyMedicalProfilesPanel.tsx src/components/BulkClinicWalkInImportModal.tsx src/components/workers/WorkerReportEmailsPanel.tsx src/app/workers/page.tsx
pnpm typecheck

# 3. Tests existentes no deben romperse
pnpm test
```

### Validación funcional mínima manual
1. **Sub-bloque A (correos en perfil):**
   - Ir a `/admin/profiles`, editar un perfil.
   - Agregar 2 correos en sección "Envío de resultados".
   - Guardar y reabrir → los correos deben persistir.
2. **Sub-bloque B (correos en paciente):**
   - Ir a `/workers/[id]`, agregar 3 correos.
   - Verificar que la UI muestra máximo 5 correos.
3. **Sub-bloque C (comentarios en perfil):**
   - Editar perfil, escribir "Requiere firma autógrafa + excluir VIH".
   - Guardar y verificar que se muestra en la vista del perfil.
4. **Sub-bloque D (clonar perfil):**
   - Click "Duplicar" en un perfil.
   - Renombrar y guardar.
   - Verificar que existe el clon con sus pruebas + correos + notas.
5. **Sub-bloque E (altas masivas distintas):**
   - En `/workers`, hacer clic en "Carga Masiva — Clínica Física".
   - Pegar 3 filas manuales, guardar.
   - Verificar que los workers se crean con `intakeSource = CLINIC_WALK_IN_MASS` y NO tienen `ProjectWorker`.

## Criterios de aceptación
- ✅ Migración Prisma aplica sin errores en Railway.
- ✅ Perfiles médicos soportan múltiples correos de envío y campo de comentarios.
- ✅ Workers soportan hasta 5 correos adicionales de envío.
- ✅ Botón "Duplicar" funcional en manager global y panel de empresa.
- ✅ Dos rutas distintas de alta masiva con `intakeSource` correcto.
- ✅ Lint, typecheck y tests existentes en verde.
- ✅ Sin cambios destructivos: todos los datos actuales siguen funcionando.

## Riesgos identificados
- **R1:** Si Prisma genera un nombre de migración distinto al esperado, Sofia debe ajustarlo pero NO cambiar el contenido.
- **R2:** La validación de "máximo 5 correos por worker" es UI; si se bypasea por API directa, la BD lo aceptará. Aceptable para esta iteración; SPEC futura endurecerá con constraint.
- **R3:** El campo libre "Otros correos (separar por coma)" se almacena como string único, no parseado. Aceptable para envío simple; parsing avanzado queda como mejora.

## Condición de detención
Si durante la implementación Sofia descubre que la distinción "unidad móvil vs clínica física" requiere más de 10 archivos (ej. porque implica modificar `ProjectFormModal` o `AppointmentFormModal`), debe detenerse y reportar `BLOQUEO DE CONTEXTO` indicando exactamente qué archivo adicional sería necesario y por qué.

## Handoff operativo previsto
Tras implementar, Sofia debe entregar:
- Código listo para revisión.
- Resultado de los 3 comandos de validación (lint, typecheck, test).
- Sugerencia explícita de que INTEGRA invoque a **GEMINI** (subagent_type='gemini') como segunda mano de validación antes de merge a `main`.
- Self-review manual: ¿el código refleja la SPEC? ¿hay code smells evidentes? ¿los tests existentes siguen pasando? ¿algún riesgo de regresión?

## Trazabilidad
- ID: **ARCH-20260708-01**
- SPEC: este documento (`context/SPECs/SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md`).
- Handoff: `context/interconsultas/HANDOFF_ARCH-20260708-01_SOFIA_PERFILES-PACIENTE.md`.
- Checkpoint final esperado: `context/checkpoints/CHK_ARCH-20260708-01-PERFILES-PACIENTE.md`.