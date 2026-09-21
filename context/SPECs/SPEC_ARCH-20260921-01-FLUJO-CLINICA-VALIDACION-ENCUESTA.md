# SPEC ARCH-20260921-01 — Flujo clínica · validación · encuesta AMI

- **ID:** ARCH-20260921-01
- **Fecha:** 2026-09-21
- **Estado:** APROBADO PARA IMPLEMENTACIÓN
- **Origen:** Minuta AMI-SR F-017 (#13, #14), sesión Frank 2026-09-21
- **Relacionado:**
  - `context/acuerdos/AMI-SR-F-017-cruce.md` (R-10, R-11)
  - `context/acuerdos/DEC-20260907-01-estatus-pruebas-dos-capas.md`
  - `context/SPECs/SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md`
  - Encuesta oficial: https://medicaindustrial.com/encuesta-satisfaccion-ami.html

---

## 1. Objetivo

Unificar en un solo diseño:

1. **Estatus de estudios** — 3 pasos operativos (solo el 1º manual) + excepción por incidencia.
2. **Proceso de atención clínica** (`/reception`) — seguimiento hasta **checkout** y encuesta al salir.
3. **Validación** (`/validation`) — cierre clínico post-checkout (resultados → dx estudio → dictamen).
4. **Encuesta de satisfacción AMI** — formulario oficial, historial en ficha paciente y panel de estadísticas.

Separar **salida física del paciente** (recepción) de **cierre clínico** (validación/médico).

---

## 2. Principios de diseño

| # | Principio |
|---|-----------|
| P1 | **Un solo paso manual por estudio:** paso 1 (Realización). Pasos 2 y 3 son automáticos por acciones del sistema. |
| P2 | **Checkout ≠ dictamen.** La encuesta se ofrece al irse; lab/dictamen pueden continuar días después. |
| P3 | **Dos módulos de navegación:** clínica hasta checkout; validación después de checkout. |
| P4 | **Excepción documentada:** estudio no realizado = incidencia en cronograma + `SKIPPED` (no bloquea checkout si todos los demás están resueltos). |
| P5 | **Campimetría doble:** solo `CAMPIMETRIA` en papeleta tiene estatus propio; el combo en examen médico cuenta en el `EventTest` de Examen Médico. |
| P6 | **No migrar enum BD en fase 1:** mantener `EventTestStatus`; derivar paso visible 1/2/3/E en capa de aplicación. |

---

## 3. Modelo de 3 pasos por estudio

### 3.1 Pasos visibles (UI papeleta)

| Paso | Nombre | Manual | Disparador automático → paso 2 | Disparador automático → paso 3 |
|------|--------|--------|--------------------------------|--------------------------------|
| **1** | Realización | **Sí** | — | — |
| **2** | Resultado | No | Ver §3.2 | — |
| **3** | Interpretación | No | — | Ver §3.2 |
| **E** | No realizado | Sí (incidencia) | — | — |

### 3.2 Por familia de estudio

| Familia | Ejemplos | Paso 1 manual | → Paso 2 | → Paso 3 |
|---------|----------|---------------|----------|----------|
| **Documento** | Espirometría, audiometría, ECG+PDF | Iniciar / paciente en prueba | Upload OK + extracción | Guardar revisión médica IA |
| **Laboratorio** | Sangre, orina | Muestra tomada | Resultado cargado en sistema | Interpretación / cierre estudio |
| **Formulario** | Examen médico, campimetría completa | Iniciar consulta | Formulario guardado | Completar estudio / revisión |
| **Embebido** | Campimetría combo en examen médico | — | — | Cuenta en Examen Médico |

### 3.3 Mapeo pipeline → paso visible (fase 1)

| `EventTestStatus` + contexto | Paso visible |
|------------------------------|--------------|
| `PENDING`, `IN_PROGRESS` | **1** |
| `SAMPLE_TAKEN` | **2** (lab: esperando resultado) |
| `RESULT_REGISTERED` sin interpretación IA/formulario cerrado | **2** |
| `COMPLETED` o interpretación guardada | **3** |
| `SKIPPED` / `CANCELLED` + incidencia `STUDY_NOT_PERFORMED` ligada | **E** |
| `SKIPPED` / `CANCELLED` sin incidencia | **Inválido** — bloquear checkout y alertar |

**Eliminar en UI:** botones manuales «Resultado registrado» y «Completar estudio» salvo rol admin de corrección.

### 3.4 Capa negocio (DEC-20260907-01)

Se mantiene Pendiente / Realizado / No realizado como badge secundario; el **paso 1/2/3** es la trazabilidad operativa principal en papeleta.

---

## 4. Módulo A — Proceso de atención clínica (`/reception`)

### 4.1 Alcance

- Paciente **en clínica** desde check-in hasta **checkout** (`dischargedAt`).
- **No** muestra dictamen, interpretación pendiente ni semáforo de expediente completo.
- Público: recepción, capturista, admin.

### 4.2 Kanban — 3 columnas

| Columna | Criterio de entrada |
|---------|---------------------|
| **Registro de pruebas** | `MedicalEvent.status = CHECKED_IN` |
| **En proceso** | `IN_PROGRESS` o algún `EventTest` en paso **1** pendiente |
| **Listo para checkout** | Todos los `EventTest` visibles en paso **≥1** o **E**; `dischargedAt IS NULL` |

**Excluidos del tablero:** eventos con `dischargedAt` set (pasan a Validación).

### 4.3 Checkout — flujo UX

1. Tarjeta en **Listo para checkout** → botón **「Dar salida / Checkout」**.
2. Modal:
   - **📱 Encuesta en esta tableta** — abre formulario AMI (`/feedback/satisfaction?event=…&mode=kiosk`).
   - **💬 Enviar por WhatsApp** — `wa.me` con teléfono del trabajador; si falta teléfono, mensaje claro + copiar enlace.
   - **Confirmar salida** — persiste `dischargedAt`, `dischargedByUserId`; cierra modal; quita tarjeta del kanban clínico.
3. La encuesta **puede** completarse antes o después de confirmar salida (decisión operativa: recomendar completar antes de confirmar; no bloquear salida si el paciente se va sin llenar — quedará «encuesta pendiente» en ficha).

### 4.4 Regla de habilitación checkout

```text
checkoutEnabled(event) :=
  ∀ eventTest ∈ activeTests(event):
    studyStep(eventTest) ∈ { 1_done, 2, 3, E }
  donde 1_done = paso 1 completado (IN_PROGRESS+ o muestra tomada)
  AND dischargedAt IS NULL
```

Función pura: `frontend/src/lib/clinical/study-step.ts` (nuevo).

### 4.5 Cambio vs implementación 2026-09-21

La columna «Listos para salida» implementada con criterio `status = COMPLETED` **debe reemplazarse** por la regla §4.4. El modal de checkout se conserva; cambia solo el filtro del kanban.

---

## 5. Módulo B — Validación (`/validation`)

### 5.1 Alcance

- Expedientes con **`dischargedAt IS NOT NULL`** y **`MedicalEvent.status ≠ COMPLETED`** (o ventana reciente post-COMPLETED para archivo).
- Cierre clínico: resultados, diagnóstico por estudio, dictamen final.
- Público: médico, validador, admin, coordinación.

### 5.2 Tres etapas (tabs, sub-kanban o filtros)

Prioridad única — cada expediente aparece en **una** etapa:

| Etapa | Nombre UI | Regla |
|-------|-----------|-------|
| **V1** | En espera de resultados | Algún estudio en paso **2** pendiente (lab, upload, formulario sin guardar) |
| **V2** | En espera de diagnóstico por estudio | Todos con resultado; alguno sin paso **3** |
| **V3** | En espera de dictamen final | Todos los estudios en **3** o **E**; evento `VALIDATING` o sin `MedicalVerdict` firmado |

Al firmar dictamen → `COMPLETED` → sale de validación activa (archivo / histórico).

### 5.3 Semáforos (existentes)

Reutilizar `getEventCompleteness` (`event-completeness.ts`):

- 🟢 **Expediente completo** — todos los estudios resueltos (paso 3 o E válida).
- 🔴 **Expediente incompleto** — alguno en paso 1/2 o SKIPPED sin incidencia.

Mostrar en cada fila de validación + detalle al abrir expediente.

### 5.4 Cambio vs `/validation` actual

Hoy solo lista `status = VALIDATING`. Ampliar a:

- Fuente: `dischargedAt != null` AND (`status IN (IN_PROGRESS, VALIDATING)` OR estudios pendientes).
- Filtros V1 / V2 / V3 según §5.2.
- Mantener tabla (Word R-20) con columnas: paciente, empresa, estudios, etapa, semáforo, acciones.

---

## 6. Incidencias — estudio no realizado

### 6.1 Extensión cronograma

Nuevo `entryType`: **`STUDY_NOT_PERFORMED`** (o preset bajo `ADMIN_INCIDENCE` con metadata obligatoria).

| Campo | Obligatorio |
|-------|-------------|
| `eventTestId` | **Sí** |
| `title` | Preset: «Estudio no realizado», «Paciente se retiró», «Equipo no disponible», etc. |
| `description` | Opcional |

Al registrar:

1. Crear `PapeletaTimelineEntry`.
2. Actualizar `EventTest.status → SKIPPED`.
3. Audit log.

### 6.2 Roles

Fase 1: recepción, médico, admin (ampliar más allá de solo admin en cronograma).

### 6.3 Regla checkout

`SKIPPED` **solo** cuenta como resuelto si existe incidencia ligada al `eventTestId`.

---

## 7. Encuesta de satisfacción AMI

### 7.1 Reemplazo del formulario actual

El formulario `/feedback/satisfaction` actual (1–10 + comentario) **se reemplaza** por la encuesta oficial AMI.

**Fuente de verdad:** https://medicaindustrial.com/encuesta-satisfaccion-ami.html

### 7.2 Campos

**Identificación**

| Campo | Tipo | Obligatorio | Precarga |
|-------|------|-------------|----------|
| `nombre` | text | Sí | Worker.firstName |
| `apellidos` | text | Sí | Worker.lastName |
| `empresa` | text | Sí | Company.name |
| `turno` | text | Sí | — (paciente/recepción) |

**Escala Likert 1–5** (1 = Nada satisfecho … 5 = Totalmente satisfecho)

| Campo | Sección |
|-------|---------|
| `overall` | Satisfacción general (caritas) |
| `q_trato` | Trato — respeto y amabilidad |
| `q_escucha` | Trato — escucha |
| `q_resolucion` | Solución — resolución clara |
| `q_espera` | Solución — tiempo de espera |
| `q_limpieza` | Espacio — limpieza |
| `q_privacidad` | Espacio — privacidad |
| `recomienda` | ¿Recomendarías…? (1–5) |

**Opcional:** `comentario` (text, max 2000).

### 7.3 Modelo de datos (nuevo)

```prisma
model SatisfactionSurvey {
  id          String   @id @default(uuid())
  eventId     String
  workerId    String
  companyId   String?
  branchId    String?
  turno       String
  overall     Int      // 1-5
  qTrato      Int
  qEscucha    Int
  qResolucion Int
  qEspera     Int
  qLimpieza   Int
  qPrivacidad Int
  recomienda  Int
  comentario  String?
  channel     SatisfactionChannel // TABLET | WHATSAPP_LINK | DIRECT
  submittedAt DateTime @default(now())
  event       MedicalEvent @relation(...)
  worker      Worker       @relation(...)
  @@index([workerId])
  @@index([eventId])
  @@index([submittedAt])
}

enum SatisfactionChannel {
  TABLET
  WHATSAPP_LINK
  DIRECT
}
```

- **Una encuesta por evento** (unique `eventId` opcional — permitir reenvío solo admin).
- Migración: registros legacy en `AuditLog` (`PATIENT_SATISFACTION`) quedan históricos; no backfill obligatorio.

### 7.4 Validación server

Zod schema `SatisfactionSurveySchema` en `frontend/src/schemas/satisfaction.schema.ts`.

Action: `submitSatisfactionSurvey` reescrita para persistir en `SatisfactionSurvey` + audit log resumido.

### 7.5 UI formulario

- Ruta pública: `/feedback/satisfaction?event={uuid}`.
- Modo kiosk: `&mode=kiosk` — pantalla completa, sin nav AppShell.
- Precarga nombre/apellidos/empresa desde evento; readonly.
- UI alineada visualmente a encuesta AMI (caritas + dots); mobile-first para tableta recepción.

---

## 8. Panel del paciente (`/workers/[id]`)

### 8.1 Sección nueva

**「Encuestas de satisfacción」** — card/lista similar a `WorkerInformedConsentCard`.

Por cada `SatisfactionSurvey` del worker:

- Fecha, turno, `overall` (carita), `recomienda`, enlace a detalle.
- Detalle expandible: las 8 dimensiones + comentario.
- Badge **「Encuesta pendiente」** si `dischargedAt` set y no hay survey para ese `eventId`.

### 8.2 Datos

Loader en `page.tsx`: `getSatisfactionSurveysByWorker(workerId)`.

---

## 9. Panel de satisfacción — estadísticas

### 9.1 Ruta

**`/reports/satisfaction`** (nuevo ítem nav bajo Reportes o Validación — admin/coordinación).

### 9.2 Vistas

| Vista | Contenido |
|-------|-----------|
| **KPIs** | N respuestas, promedio `overall`, % `recomienda >= 4`, promedio por dimensión |
| **Tendencia** | Serie temporal (semanal/mensual) — fase 2 si no hay tiempo |
| **Tabla** | Paciente, empresa, sucursal, fecha, turno, scores, comentario, link ficha |
| **Filtros** | Rango fechas, empresa, sucursal, canal (tableta/WhatsApp) |

### 9.3 Export

Fase 2: CSV/Excel desde misma query.

---

## 10. Artefactos técnicos (implementación)

| Artefacto | Acción |
|-----------|--------|
| `frontend/src/lib/clinical/study-step.ts` | **Nuevo** — derivar paso 1/2/3/E |
| `frontend/src/lib/clinical/reception-checkout.ts` | **Nuevo** — regla checkoutEnabled |
| `frontend/src/lib/clinical/validation-stage.ts` | **Nuevo** — derivar V1/V2/V3 |
| `frontend/src/actions/event.actions.ts` | Ajustar kanban clínico + discharge gate |
| `frontend/src/app/reception/page.tsx` | 3 columnas; quitar criterio COMPLETED |
| `frontend/src/app/validation/page.tsx` | 3 etapas post-checkout |
| `frontend/src/actions/satisfaction.actions.ts` | Reescribir + tabla nueva |
| `frontend/src/app/feedback/satisfaction/page.tsx` | Formulario AMI completo |
| `frontend/src/components/reception/ReceptionCheckoutModal.tsx` | Tableta + WhatsApp + confirmar |
| `frontend/src/components/workers/WorkerSatisfactionCard.tsx` | **Nuevo** |
| `frontend/src/app/reports/satisfaction/page.tsx` | **Nuevo** |
| `frontend/src/actions/timeline.actions.ts` | Incidencia `STUDY_NOT_PERFORMED` |
| `frontend/prisma/schema.prisma` | `SatisfactionSurvey`, `dischargedAt` (ya migración draft) |
| `frontend/src/components/clinical/PapeletaWorkspace.tsx` | Chips 1·2·3; quitar botones manuales redundantes |
| `frontend/src/components/EventFlowController.tsx` | Sin encuesta (ya hecho) |

---

## 11. Fases de entrega

| Fase | Entrega | Prioridad |
|------|---------|-----------|
| **F1** | `study-step.ts` + chips UI papeleta + quitar botones manuales | P1 |
| **F2** | Incidencia ↔ SKIPPED + checkout gate correcto en `/reception` | P1 |
| **F3** | `SatisfactionSurvey` + formulario AMI + modal checkout | P1 |
| **F4** | Ficha paciente — historial encuestas | P2 |
| **F5** | `/validation` tres etapas + semáforos | P2 |
| **F6** | `/reports/satisfaction` estadísticas | P2 |
| **F7** | Export CSV, tendencias, migración audit log legacy | P3 |

---

## 12. Criterios de aceptación

### Checkout (R-10 / R-13 operativo)

- [ ] Recepción ve columna **Listo para checkout** cuando todos los estudios tienen paso 1 o incidencia E.
- [ ] Modal ofrece tableta + WhatsApp con formulario AMI (no 1–10).
- [ ] Confirmar salida setea `dischargedAt`; paciente desaparece del kanban clínico.
- [ ] Encuesta no aparece en pantalla post-firma médica.

### Validación

- [ ] Post-checkout, expediente visible en `/validation` en etapa V1, V2 o V3 correcta.
- [ ] Semáforo completo/incompleto coherente con pasos de estudios.
- [ ] Dictamen firmado saca expediente de validación activa.

### Encuesta

- [ ] Campos §7.2 validados y persistidos en `SatisfactionSurvey`.
- [ ] Visible en `/workers/[id]`.
- [ ] Panel `/reports/satisfaction` con KPIs y filtros por fecha/empresa.

### Estudios

- [ ] Solo paso 1 manual; paso 2 y 3 por acciones automáticas.
- [ ] SKIPPED sin incidencia bloquea checkout y muestra error claro.

---

## 13. Fuera de alcance (esta SPEC)

- Cambiar enum `EventTestStatus` en BD (fase futura).
- Integración Google Forms externo (Leticia) — solo formulario in-app.
- Notificaciones push a recepción al firmar dictamen.
- Portal empresa (`COMPANY_CLIENT`) para ver encuestas.

---

## 14. Referencias cruzadas minuta F-017

| # Minuta | Cobertura en esta SPEC |
|----------|-------------------------|
| **13** | Checkout + mensaje/tableta/WhatsApp (§4, §7) |
| **14** | Encuesta AMI + panel estadísticas (§7, §9) |
| **R-17** | Capa pasos + badge negocio (§3.4) |
| **R-21** | Semáforo en validación (§5.3) |

---

## 15. Decisiones abiertas (defaults propuestos)

| Tema | Default propuesto |
|------|-------------------|
| ¿Checkout bloqueado sin encuesta? | **No** — salida confirmable; queda «encuesta pendiente» en ficha |
| ¿Una encuesta por evento? | **Sí** — unique `eventId`; admin puede reset en fase 2 |
| ¿Anonimato? | Encuesta ligada a evento/worker en BD; UI pública sin login (como hoy) |
| Nav panel satisfacción | `/reports/satisfaction` bajo sección Reportes |

---

*Documento listo para implementación por fases. Actualizar `AMI-SR-F-017-cruce.md` al cerrar F3.*
