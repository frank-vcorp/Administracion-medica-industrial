# Cruce: Minuta AMI-SR F-017 × Word Renombramiento de catálogos 2

**Actualizado:** 2026-09-21  
**Fuentes:**
- `context/datos AMI/Renombramiento de catálogos 2.docx`
- Minuta AMI-SR F-017 (reunión 12:00, Coordinadora Sr Crecimiento Innovación Calidad y Eficiencia)
- Implementación parcial en código (renombres visuales)
- Backlog roles: `context/roles/`

---

## Leyenda de estado

| Estado | Significado |
|---|---|
| ✅ Hecho | Implementado en código |
| 🔗 Cruce | Aparece en Word y minuta (mismo tema, distinto detalle) |
| 📄 Solo Word | Solo en documento de renombramiento |
| 📋 Solo minuta | Solo en acuerdos de reunión |
| ⏸️ Diferido | Acumulado en `context/roles/` |

---

## A) Cambios triviales — no ameritan revisión

Implementación directa: texto, campos de formulario, assets. Sin ambigüedad de negocio ni cambio de arquitectura.

| ID | Origen | Acción | Estado | Notas |
|---|---|---|---|---|
| T-01 | Word | Renombrar nav/título → **Gestión de citas** | ✅ Hecho | `AppShell.tsx`, `appointments/page.tsx` |
| T-02 | Word | KPI → **Pacientes citados** | ✅ Hecho | `appointments/page.tsx` |
| T-03 | Word | KPI → **Pacientes con pruebas pendientes** | ✅ Hecho | `appointments/page.tsx` |
| T-04 | Word | KPI → **Pacientes con atención completa** | ✅ Hecho | `appointments/page.tsx` |
| T-05 | Word | Dashboard KPI → **Pacientes en espera** | ✅ Hecho | `dashboard/page.tsx` |
| T-06 | Minuta #6 | Agregar **saturación de oxígeno** en signos vitales | ✅ Hecho | Campo `saturacion_oxigeno` + PDF |
| T-07 | Minuta #7 | Quitar **cintura y cadera** de signos vitales | ✅ Hecho | UI + PDF; schema legacy conservado |
| T-08 | Minuta #11 | Quitar **LAM** de método de planificación familiar | ✅ Hecho | `AG_GINE_MPF_VALUES` |
| T-09 | Minuta #10 | Columna vertebral: **"clínicamente desviada"** cuando Test Adam positivo | ✅ Hecho | Auto-fill al marcar SI |
| T-10 | Minuta #1 | Cargar **logos** Soluciones Médico Empresariales | ✅ Hecho | Membrete dictamen PDF |

---

## B) Cambios que ameritan revisión

Requieren decisión de negocio, diseño, reglas clínicas, integración o impacto en flujo/BD.

### B.1 Cruce Word + Minuta (mismo tema, ampliar alcance)

| ID | Origen | Acción | Por qué revisar | Pregunta clave |
|---|---|---|---|---|
| R-01 | 🔗 Word + Minuta #5 | **Listado pacientes citados día siguiente** | Word solo renombró KPI; minuta pide listado nuevo | ✅ Hecho — columna «Día siguiente» en Gestión de citas |
| R-02 | 🔗 Word + Minuta #18 | **Clic en pendientes → ir al paciente** con prueba pendiente | Implica navegación y filtro por estudio | ✅ Hecho — KPI clicable + modal → `/events/[id]?view=IN_PROGRESS` |
| R-03 | 🔗 Word + Minuta #4 | **Barra de búsqueda general** | Word pide combinar listados; minuta pide búsqueda global | ✅ Hecho — barra en header; pacientes + expedientes + empresas (admin) |
| R-04 | 🔗 Word + Minuta #17 | **Usuarios personalizados** / roles | Sin enum "Coordinador Médico" hoy | ⏸️ Diferido en `context/roles/` |

### B.2 Solo Minuta AMI-SR F-017

| ID | # Minuta | Acción | Responsable | Fecha | Por qué revisar |
|---|---|---|---|---|---|
| R-05 | 2 | Diagnóstico IA → **cuadro diagnóstico editable** | Francisco | 08/09 | ✅ Hecho (panel prediagnóstico IA por estudio) |
| R-06 | 3 | **Recomendaciones autogeneradas** editables | Francisco | 08/09 | ✅ Hecho (`practical_recommendation` + textarea editable) |
| R-07 | 8 | **TA siempre** en diagnóstico | Francisco | 08/09 | ⏸️ Ver §Decisiones — dictamen final, no examen médico |
| R-08 | 9 | Parámetros **agudeza visual** para clasificar | Francisco | 21/09 | ✅ Hecho — catálogo ZIN/CAMPI (`AgudezaVisualSchema`) + clasificación automática en pestaña Agudeza del examen médico |
| R-09 | 12 | **Consentimiento** en Check-in | Francisco | 21/09 | ✅ Hecho — paso 2 de `CorroborationModal`, texto 005-18, firma + PDF antes de `checkInAppointment` |
| R-10 | 13 | Mensaje para **calificar servicio** al finalizar | Francisco | 08/09 | ✅ Hecho — prompt en expediente COMPLETED + WhatsApp/copiar |
| R-11 | 14 | **Encuesta satisfacción** pacientes | Francisco | 08/09 | ✅ Hecho — `/feedback/satisfaction` + audit log |
| R-12 | 15 | Cargar pruebas: campimetría, ECG, consulta, certificado | Francisco | 08/09 | 🟡 Parcial — catálogo + campimetría clínica; precios/combos y entregables consulta/certificado |
| R-13 | 16 | Cargar exámenes **Flowserve y Sodexo** | Francisco | 21/09 | ✅ Hecho — catálogo `GEN-EM-FLO` / `GEN-EM-SOD`, perfiles piloto, extensiones UI + anexo PDF |
| ~~R-14~~ | ~~19~~ | ~~Pre-presentación **capacitación** plataforma~~ | — | — | ❌ Fuera de alcance — no es de este proyecto |

### B.3 Solo Word Renombramiento (no en minuta)

| ID | Acción | Por qué revisar | Pregunta clave |
|---|---|---|---|
| R-15 | **Total del día** (KPI) | No existe tarjeta | ✅ Hecho — KPI «Pacientes citados» + rejilla en `/appointments` (día seleccionado) |
| R-16 | Eliminar **Agenda** y **combinar listados** | Cambio estructural nav + UX | ✅ Hecho — `/events` → `/workers`; `getPatientExpedienteList` + tabla unificada |
| R-17 | Estatus pruebas: **Realizado / Pendiente / No realizado** (+ subtexto lab) | Puede cambiar enums BD | ✅ Hecho (capa visual, DEC-20260907-01) |
| R-18 | Estatus **interpretación** vs envío | Conflicto en doc (envío vs interpretación) | ✅ Hecho — subtexto «Pendiente de interpretación» / «Prueba interpretada» (`study-status-display.ts`, Word R-18) |
| R-19 | **Público general** dentro de listado empresas | Cambio de ruta/nav | ✅ Hecho — módulo `/publico-general` + alta con empresa fija (`public-general-company`) |
| R-20 | **Validación diagnóstica** en listado (tabla) | Layout + columnas | ✅ Hecho — `/validation`, etapas V1–V3, `ValidationQueueTable` |
| R-21 | **Semáforo** expediente completo/incompleto | Regla de negocio | ✅ Hecho — `event-completeness` + badges en cola validación |
| R-22 | **Informe mensual** | Sin especificar informe | 🔴 Pendiente |
| R-23 | **Bug modal** agendar citas | UI pero hay que reproducir | ✅ Hecho — `AppointmentFormModal` (z-index, layout modal) |

---

## Resumen numérico

| Categoría | Cantidad | Estado |
|---|---|---|
| **A — Triviales** | 10 | 10 ✅ hechos |
| **B — Con revisión** | 23 | 1 ⏸️ (R-04), 1 ⏸️ (R-07), 1 🟡 (R-12), 1 🔴 (R-22), 1 ❌ (R-14); resto ✅ en minuta + Word |
| **Total ítems únicos** | 33 | |

---

## Orden sugerido de implementación

1. **Triviales pendientes** (T-06 → T-09): signos vitales, LAM, columna vertebral  
2. **Revisión rápida + implementar** (R-01, R-02): listado día siguiente + clic pendientes  
3. **Clínico + IA** (R-05 ✅, R-06 ✅, R-08 ✅, R-09 ✅)  
4. **Catálogo** (R-12 pendiente; R-13 ✅)  
5. **Post-atención** (R-10 ✅, R-11 ✅)  
6. **Dictámenes finales + PDFs** (R-07 y entregables incompletos — ver §Decisiones)  
7. **Word backlog** — solo **R-22** informe mensual pendiente (R-15…R-21, R-23 ✅)  
8. **Roles** (R-04) al cerrar pantallas  

---

## Decisiones de alcance registradas

### R-07 — TA en diagnóstico (2026-09-08, Frank)

**Texto minuta #8 (literal):** *El TA siempre debe ir en el diagnóstica*

**Interpretación acordada (no implementar aún):**

- La **TA ya está** en el flujo de **Examen Médico** (signos vitales: sistólica/diastólica; resumen `presion_arterial_resumen`; fila **PRESIÓN ARTERIAL** en PDF de examen médico).
- R-07 **no** es panel de prediagnóstico IA por estudio.
- R-07 apunta a incluir la TA en el **dictamen final** (consolidado que recibe el contratante), cuando cerremos esa capa.
- **Orden de trabajo:** terminar primero el listado de ítems Francisco de la minuta (R-10…R-13); **después** bloque dictámenes finales + PDFs (hoy considerados incompletos).

**Pendiente definir al entrar al bloque dictámenes:** formato exacto de TA en el dictamen (120/80 vs texto resumen ZIN), obligatoriedad y fuente de datos.

### R-03 — Búsqueda general (2026-09-08, Frank)

**Texto minuta #4:** barra de búsqueda general del sistema (tipo “Google interno”).

**Implementado:**

- Barra centrada en el header del panel (desktop) y debajo del menú hamburguesa (móvil).
- Visible para **staff** autenticado; oculta en portal empresa (`COMPANY_CLIENT`) y dentro del workspace de expediente (`/events/[id]`).
- Mínimo **2 caracteres**, debounce **300 ms**, resultados agrupados en dropdown.
- **Pacientes:** nombre, ID universal, CURP (≥3 chars), email, teléfono → `/workers/[id]`.
- **Expedientes:** folio parcial (≥4 chars), nombre o ID del paciente → `/events/[id]`.
- **Empresas** (solo admin-like): nombre, RFC → `/companies/[id]`.

**Archivos:** `global-search.actions.ts`, `GlobalSearchBar.tsx`, `AppShell.tsx`.

**Ampliaciones futuras posibles:** citas del día, pruebas pendientes, historial clínico.

### R-14 / Minuta #19 — Capacitación (2026-09-08, Frank)

**Fuera de alcance** de este proyecto (proceso operativo / capacitación, no implementación en código).

### R-08 — Parámetros agudeza visual (2026-09-21, Frank)

**Texto minuta #9:** parámetros de agudeza visual para clasificar.

**Cierre sin documento adicional de Jaqueline:**

- Los parámetros ya estaban definidos en `CAMPIMETRÍA.xlsx` + catálogo ZIN (`VISION_SNELLEN_VALUES`, `CAMPIMETRIA_VALUES`, `TEST_ISHIHARA_VALUES`, `REFLEJOS_VALUES`) en `AgudezaVisualSchema`.
- La **campimetría menor** en examen médico (pestaña Agudeza) es la captura cuando **no** hay estudio `CAMPIMETRIA` completo en papeleta.
- Clasificación automática (`NORMAL` / `DISMINUIDA` / `BAJA AL MOMENTO DE LA TOMA`) desde visión lejana OD/OI → `agudeza_visual_resumen` en resumen clínico y PDF.
- Helper único: `frontend/src/lib/clinical/agudeza-visual.ts`.

**Pendiente solo si clínica pide cambiar umbrales** distintos al Excel/ZIN vigente.

### R-09 — Consentimiento en check-in (2026-09-21, Frank)

**Texto minuta #12:** consentimiento informado en el momento del check-in.

**Implementado (sin depender de documento adicional de Jaqueline):**

- Flujo **cita programada** → `/appointments` → Check-in → `CorroborationModal` (2 pasos).
- Paso 2: lectura del consentimiento (`InformedConsentDocument`) + **firma autógrafa obligatoria**.
- Texto: `frontend/src/lib/informed-consent-content.ts` (Formato autorizado **005-18**, fuente `public/templates/consentimiento-informado.pdf`).
- Cierre: `closeReceptionCorroboration` genera PDF firmado, persiste en `Appointment` / `Worker`, auditoría, luego `checkInAppointment`.
- Historial en expediente del paciente: `WorkerInformedConsentCard`.

**Matiz operativo:** check-in **walk-in** vía `CheckInModal` (`createEvent`) no incluye este paso; el acuerdo de minuta se cumple en el flujo estándar con cita.

### R-13 — Paquetes Flowserve y Sodexo (2026-09-21, Frank)

**Texto minuta #16:** cargar exámenes Flowserve y Sodexo (paquetes por empresa).

**Alcance acordado:** **no** es un módulo / app separada por cliente. Es **adecuación** del mismo flujo de Examen Médico AMI: otra prueba en catálogo, perfil paquete al agendar, pestaña **Extensión** + anexo PDF según variante (`AMI` | `SODEXO` | `FLOWSERVE`).

**Implementado:**

- **Catálogo:** `Examen Médico Flowserve` (`GEN-EM-FLO`), `Examen Médico Sodexo` (`GEN-EM-SOD`) — `examen-medico-variant.ts`.
- **Seed idempotente:** `frontend/prisma/seed-exam-variants.ts` crea pruebas + perfiles `Paquete Examen Médico Sodexo` y `Paquete Examen Médico Flowserve Ingreso` (más AMI estándar).
- **Captura:** pestaña **Extensión** en `ExamenMedicoEstudio` — `FlowserveExtension` (incl. Kuorinka) y `SodexoExtension`; persistencia en `physicalExamData.variant_extensions` + `exam_variant` (Zod en `exam.schema.ts`).
- **PDF:** anexos corporativos en `ExamenMedicoVariantAppendixPages` / `ExamenMedicoValidatedPDF`.
- **Tests:** `examen-medico-variant.test.ts`; scripts `prep-flowserve-e2e.ts`, `test-variant-pdf.ts`.

**Operación:** en cada entorno, ejecutar `npx tsx prisma/seed-exam-variants.ts` si aún no están los códigos `GEN-EM-FLO` / `GEN-EM-SOD`. Asignar el perfil paquete al agendar la cita.

### Word backlog R-15…R-23 (2026-09-21, Frank)

| ID | Cierre |
|----|--------|
| R-15 | KPI del día en Gestión de citas (`/appointments`) |
| R-16 | Listado unificado paciente+expediente en `/workers`; `/events` redirige |
| R-18 | Capa interpretación en `study-status-display.ts` (tests `study-status-display.test.ts`) |
| R-19 | Flujo Público General dedicado (`/publico-general`) |
| R-20 | Cola `/validation` post-checkout (SPEC flujo clínica) |
| R-21 | Semáforo completo/incompleto en misma cola (`event-completeness.ts`) |
| R-22 | **Pendiente** — informe mensual formal (dashboard tiene resumen parcial) |
| R-23 | Modal agendar citas corregido |

---

## Referencias cruzadas

| Tema | Word | Minuta | Roles |
|---|---|---|---|
| Pacientes citados | KPI rename ✅ | #5 listado día siguiente ✅ | Recepción / Coord. Médico |
| Pruebas pendientes | KPI rename ✅ | #18 clic → paciente ✅ | Recepción / Coord. Médico |
| Búsqueda / listados | Combinar listados ✅ | #4 barra general ✅ | — |
| Usuarios | Roles columna | #17 personalizados | `context/roles/` |
