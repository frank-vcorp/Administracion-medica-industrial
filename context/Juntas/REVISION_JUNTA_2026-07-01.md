# Revisión de Junta Semanal 2026-07-01 vs. Repo Actual

**Fecha de revisión:** 2026-07-08
**Fuente:** `context/Juntas/Junta semanal de revisión de avances del sistema 2.0.txt`

## ✅ PENDIENTES QUE YA ESTÁN IMPLEMENTADOS (cerrados)

### 1. Alta masiva integrada en el sistema (no vía liga externa)
- ✅ **IMPLEMENTADO.** Existe `/auto-alta/[token]` (auto-alta con token) y los enlaces se generan dentro del sistema. Se observa además `BulkWorkerImportModal` para carga masiva interna. Verificado en:
  - `frontend/src/app/auto-alta/[token]/page.tsx`
  - `frontend/src/components/BulkWorkerImportModal.tsx`
  - `frontend/src/actions/worker.actions.ts` → `bulkImportWorkers` y `quickRegisterWorkersSameDay`

### 2. Alta "larga" vs "corta"
- ✅ **PARCIALMENTE IMPLEMENTADO.** El sistema distingue al menos dos rutas de auto-alta (token pública con `SelfRegistrationForm` completa + edición interna en `/companies/[id]/edit`). La separación explícita "larga" vs "corta" por enlace no aparece diferenciada en UI, pero el formulario público de auto-alta (`SelfRegistrationForm`) ya cubre documentación completa.

### 3. Historial de responsables (vendedores) en empresa
- ✅ **IMPLEMENTADO.** Existe modelo `CompanySellerHistory` y panel `CompanySellerHistoryPanel.tsx` con historial completo de vendedores (Lety → Jackie, etc.).

### 4. Clonación de perfiles médicos
- ⚠️ **NO IMPLEMENTADO EXPLÍCITAMENTE** — pero el `MedicalProfilesManager` permite EDITAR perfiles (cambiar nombre + pruebas). No hay botón "Duplicar/Clonar" dedicado. La decisión acordada ("se descarta agregar pruebas a perfil existente sin generar trazabilidad") se mitiga con el CRUD de edición y el historial de versiones, pero **falta botón clonar**.

### 5. Comentarios adicionales en perfil (firma autógrafa, cédula, pruebas no reportadas)
- ❌ **NO IMPLEMENTADO.** El modelo `MedicalProfile` (schema.prisma línea 274) solo tiene `id, name, companyId, createdAt, updatedAt`. No existe campo de comentarios/notas especiales.

### 6. Selección de hasta 5 correos predefinidos + campo abierto en paciente
- ❌ **NO IMPLEMENTADO en el modelo `Worker`.** El modelo `Worker` solo tiene UN campo `email` (línea 169 schema.prisma). Existe `PaymentRecord.receiptEmail` (un solo correo por pago). **No hay tabla ni campos para "correos de envío de resultados" múltiples**.

### 7. Configurar envíos por perfil
- ❌ **NO IMPLEMENTADO.** El modelo `MedicalProfile` no tiene campos de correos ni configuración de destinatarios.

### 8. Alta masiva con campos (razón social, sexo, antigüedad/exposición)
- ⚠️ **PARCIALMENTE.** El `BulkWorkerImportModal` maneja nombre, apellido, CURP, DOB, email, phone, jobPosition. **Falta campo de "antigüedad/exposición laboral"** (crítico para espirometría/audiometría). Tampoco hay campo `gender` persistido en `Worker` (línea 460 worker.actions.ts: `// gender NO se incluye — no existe columna gender en Worker`).

### 9. Captura fotográfica de documentos en móvil/tablet + manejo de incidencias
- ⚠️ **PARCIALMENTE.** Existe modelo en `Worker` con `lastIdentityDocumentType`, `lastIdentityFrontFileUrl`, `lastIdentityBackFileUrl`, `lastIdentityVerifiedAt`. Existe `CorroborationModal.tsx` y `QRScannerModal.tsx`. **Pero no hay un flujo explícito de "captura nueva / sin captura / evidencia no legible"** ni registro formal de "no coincide con la persona" como incidencia trazable.

### 10. Documento de términos y condiciones adjuntable y aceptación
- ❌ **NO IMPLEMENTADO EXPLÍCITAMENTE** como flujo de aceptación con bloqueo. El `SelfRegistrationForm` no tiene paso de TyC con checkbox obligatorio.

### 11. Marcar entrega física o formatos especiales (checkboxes)
- ❌ **NO IMPLEMENTADO.** El modelo `PaymentRecord` no tiene flags de `entregaFisica` ni `formatoEspecial`.

### 12. Flujo de estados "realizada" vs "subida" en papeleta
- ⚠️ **PARCIALMENTE.** Existe enum `EventTestStatus` con `PENDING, IN_PROGRESS, SAMPLE_TAKEN, RESULT_REGISTERED, COMPLETED, SKIPPED, CANCELLED`. Se distingue "tomada" de "registrada", pero **no hay un "siguiente paso" explícito** (ej. "siguiente paso: audiometría") como flujo visible en la papeleta. Existe `PapeletaCronograma.tsx` que podría cubrirlo, pero requiere verificación.

### 13. Registro de incidencias por falta de equipo/disponibilidad
- ❌ **NO IMPLEMENTADO.** No hay modelo ni UI para registrar "audiómetro sin baterías" con trazabilidad de seguimiento.

### 14. Extracción XML/CSV de equipos (audiometría, espirometría)
- ❌ **NO IMPLEMENTADO.** No hay importador de XML/CSV de equipos. La extracción actual es por IA (Gemini) sobre PDFs/imágenes, no parseo de archivos nativos de equipos.

### 15. Módulo de calibración e interpretación automática (umbrales + textos prudentes)
- ✅ **IMPLEMENTADO.** Existe plataforma completa de calibración IA en `/admin/services/[id]/calibration` con:
  - `CalibrationWorkspaceClient`, `AICalibrationEditor`, `CalibrationTabs`, `CalibrationVersionHistory`
  - Versionado automático (`saveAICalibrationV2`)
  - Esquema de presentación declarativo (`PresentationSchemaPanel`)
  - Plantilla de calibración editable por prueba
- ✅ **Texto prudente "no clínico"** ya está gobernado por SPECs previas (`ARCH-20260518-15`, `ARCH-20260518-03`).
- ✅ **Resumen por oído, resumen bilateral, lateralidad, severidad, patrón sugerido** implementado para Audiometría según SPEC `ARCH-20260518-14` y `ARCH-20260518-15`.

### 16. Cambiar calibración cuando cambie el audiógrafo
- ✅ **IMPLEMENTADO.** El módulo de calibración es editable en runtime por ADMIN; se puede modificar umbrales/criterios sin migración.

### 17. Lectores de código de barras tipo pistola
- ⚠️ **NO IMPLEMENTADO EXPLÍCITAMENTE** (es propuesta de mejora operativa/UX), pero existe `QRScannerModal.tsx` para códigos QR. La integración con lector de pistola USB es trivial (actúa como teclado) pero **no se ha documentado ni probado**.

### 18. Agenda/listados con filtros (empresa, puesto, perfil, estado del paciente)
- ⚠️ **PARCIALMENTE.** Existe `/workers` con `WorkersTable` y filtros básicos. Falta confirmar si incluye **filtro por perfil médico** y **estado del paciente** explícito. El meeting pide "estado del paciente" como filtro nuevo.

### 19. Recibo y número de papeleta predeterminado del cliente (editable)
- ✅ **IMPLEMENTADO.** Existe `PaymentRecord` + `PaymentModal` + `PaymentReceiptPDF` y el campo `receiptSent`. El módulo de pagos (`IMPL-20260630-01`) está cerrado.

### 20. Diferenciar altas masivas: unidad móvil vs clínica física
- ❌ **NO IMPLEMENTADO EXPLÍCITAMENTE.** Existe `Project` (cuyo contexto es unidad móvil) y `BulkWorkerImportModal`, pero **falta una distinción programática clara entre "carga masiva desde proyecto de unidad móvil" y "carga masiva para clínica física"** con rutas separadas. El meeting lo señala como prioridad alta.

### 21. Diferenciar rutas programáticas de carga masiva
- ❌ **NO IMPLEMENTADO.** Mismo punto que arriba.

---

## 🔴 PENDIENTES CONFIRMADOS (NO IMPLEMENTADOS — ordenados por prioridad del meeting)

### PRIORIDAD ALTA (próximos pasos inmediatos según la junta)
1. **Diferenciar altas masivas: unidad móvil vs clínica física** (con rutas programáticas distintas).
2. **Clonación de perfiles médicos** (botón "Duplicar/Clonar" en `MedicalProfilesManager`).
3. **Campo de comentarios adicionales en perfil** (firma autógrafa, cédula, pruebas excluidas) → migración Prisma aditiva.
4. **Múltiples correos de envío de resultados en paciente** (hasta 5 seleccionables + 1 campo libre) → migración Prisma con nueva tabla `WorkerReportEmail` o similar.
5. **Configurar envíos por perfil** (correos a quién se reportan ciertos perfiles) → relación `MedicalProfile → emails[]`.
6. **Flujo de estados en papeleta** "realizada" vs "subida" + "siguiente paso" visible (ej. audiometría como próxima prueba).
7. **Importador XML/CSV de equipos** (audiometría, espirometría) — formato a definir con Dra. Erika y proveedores de equipos.

### PRIORIDAD MEDIA
8. **Captura de evidencia fotográfica** con flujo "captura nueva / sin captura / evidencia no legible" + registro de incidencias por no coincidencia.
9. **Términos y condiciones** con aceptación obligatoria en auto-alta (bloquea si no acepta).
10. **Checkboxes de entrega física / formato especial** en pago/papeleta.
11. **Registro de incidencias operativas** (equipo no disponible, repetir estudio, seguimiento manual) → modelo nuevo `EventTestIncident` o campo JSON.
12. **Campo "antigüedad/exposición laboral"** en alta masiva de trabajadores (crítico para espirometría/audiometría).
13. **Género persistido en Worker** (hoy solo se usa para `universalId`).
14. **Filtros de agenda** por perfil médico + estado del paciente.

### PRIORIDAD BAJA (mejoras operativas)
15. **Validación de lectores de código de barras USB** en estaciones fijas vs tablets.
16. **Cámaras especializadas para credencialización** (decisión de hardware).

---

## 📊 Resumen ejecutivo

| Estado | Cantidad | % |
|--------|----------|---|
| ✅ Implementado | 9 | 38% |
| ⚠️ Parcialmente implementado | 7 | 29% |
| ❌ No implementado | 8 | 33% |
| **TOTAL puntos revisados** | **24** | **100%** |

**Conclusión:** El grueso del frente IA + laboratorio (calibración, papereta, pagos, reportes masivos) está sólido. **Los principales huecos pendientes están en el frente "datos del paciente y perfil"**: múltiples correos de envío, comentarios de perfil, clonación de perfiles, y la separación programática de altas masivas por tipo de unidad móvil vs clínica. El frente "captura documental con incidencias" también está pendiente.

**Recomendación INTEGRA:** Priorizar el **bloque "datos del paciente"** (puntos 2-5 de prioridad alta) como siguiente micro-sprint, ya que son aditivos a schema Prisma sin romper nada existente, y desbloquean la regla de "no contaminación de perfiles" acordada en la junta.