# Separación de Puntos — Junta AMI 10/08/2026

**Origen:** `context/Juntas/Revision Ami10082026.txt` (Tactiq, 73 min)
**Asistentes:** Frank Saavedra, Alan, AMI Erika Rodríguez, Jaqueline, Leticia Uribe
**Fecha junta:** 2026-08-10 12:54 → 14:07 CST
**Elaborado:** 2026-08-17 (Atlas M3) — check-in de lo hablado contra el código actual
**Estado:** Draft de discovery. No aprobado aún por Frank. No es SPEC.

---

## Resumen ejecutivo

La junta fue un **recorrido funcional end-to-end** del sistema AMI tal como está hoy, con el objetivo de detectar huecos antes de empezar a usarlo en proyectos reales. No se firmaron decisiones arquitectónicas, pero quedaron **consensos operativos** y **solicitudes explícitas** que conviene convertir en tickets verificables.

**3 decisiones de consenso claras:**

1. **Alta de empresas = 100% link de auto-alta** (no desde vendedor). El vendedor NO da de alta. Reduce datos erróneos.
2. **Perfil médico > Puesto de trabajo.** Para unidades móviles y clínicas, manejar solo `MedicalProfile` (perfil 1, 2, 3…). `JobPosition` se conserva opcional, no decisivo.
3. **Agenda la maneja solo la recepcionista.** Cliente, vendedor y asesor **NO** agendan directo. Toda cita pasa por Lolis (recepción) o equivalente.

**Huecos funcionales detectados** (ver detalle abajo):

- No hay **sobrecupo con autorización** en Branch.
- No hay **origen de cita** explícito (string libre `source`).
- **Agudeza visual / campimetría / Ishihara / reflejos** son inputs de texto libre (la junta pidió combos de selección).
- No hay **auto-poblamiento del resumen/dictamen** desde antecedentes.
- No hay **prellenado de exploración física** tipo "ZIN" (oídos, membrana timpánica íntegra, etc.).

---

## Bloque 1 — Alta de empresa y roles

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| 1.1 | Alta de empresas **solo por link de auto-alta** (no vendedor) | Pendiente decisión producto. Schema permite ambos (`Company.origen` MANUAL/self-reg). | 🔴 Alta | Hoy conviven. Definir si se deshabilita UI para vendedores. |
| 1.2 | El link de auto-alta debe estar en la página web | Ya implementado: `SelfRegistrationForm` + flujo token. Link ya en producción. | ✅ Hecho | URL pública operativa (`getPublicBaseUrl`). |
| 1.3 | **Mejorar términos y condiciones** del link | Existe campo `terminosAceptados` en Company. Texto en `SelfRegistrationForm` por revisar. | 🟡 Media | Lety dijo "lo reviso y ya los mejoramos". |
| 1.4 | **Candados de datos bancarios** (cuenta CLABE, dígitos) | `fiscalData` como JSON libre. Sin validación fuerte. | 🟡 Media | Lety/admin decide si se bloquean. Hoy sin validación. |
| 1.5 | Documentación adjunta: constancia, INE, comprobante, opinión positiva, acta constitutiva | `Company.documentosAdjuntos` (JSON). UI permite subir. | ✅ Hecho | Verificar cantidad y nombres exactos en UI. |
| 1.6 | Administración valida y "habilita" la empresa | `Company.estado` (HABILITADO/PENDIENTE), `enabledBy/enabledAt`. | ✅ Hecho | Flujo manual hoy. |
| 1.7 | Revisar y **definir permisos por rol** (cliente, capturista, doctor validador, doctor general, recepcionista, súper admin) | `UserRole` enum: ADMIN, RECEPTIONIST, DOCTOR_GENERAL, DOCTOR_VALIDATOR, CAPTURIST, COMPANY_CLIENT, VENDEDOR, SUPERADMIN. Permisos granulares no auditados. | 🔴 Alta | "Hay que revisarlos detenidamente" — Frank explícito. No hay un solo doc. |
| 1.8 | Sucursal predeterminada por empresa (Paseo del Prado) | `Company.defaultBranchId` + `Company.allowedBranches[]`. | ✅ Hecho | Funcionalidad existente. |
| 1.9 | Empresa puede ser atendida en **cualquiera de las 3 sucursales** | `Company.allowedBranches[]` lo permite. | ✅ Hecho | Lety confirmó "no hay limitante". |

---

## Bloque 2 — Perfiles médicos y puestos de trabajo

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| 2.1 | **Eliminar "puesto de trabajo" como concepto decisivo**. Usar solo `MedicalProfile` (perfil 1, 2, 3…) | Coexisten `MedicalProfile` y `JobPosition`. `Worker.jobPositionId` FK existe. `JobPosition.defaultProfileId` FK existe. | 🔴 Alta | Cambio de modelo. Implica decidir: ¿se elimina `JobPosition` o se deja opcional? Jaqueline/Erika 동의한. Lety pidió "opcional". |
| 2.2 | Perfiles con nombres genéricos (1, 2, 3) en vez de nombres clínicos | `MedicalProfile.name` libre. | 🔴 Alta | Migración de datos: ¿se renombran perfiles existentes? |
| 2.3 | **Puesto de trabajo se queda como opcional** (no decisivo) | `Worker.jobPositionId` ya es nullable. | ✅ Hecho parcial | Aceptar valor nulo en UI; ya es opcional. |
| 2.4 | Perfiles se asignan a **trabajadores**, no a puestos | Hoy `JobPosition.defaultProfileId` → `MedicalProfile`. Si se quita JobPosition, ¿se va el campo? | 🔴 Alta | Decisión arquitectónica. |
| 2.5 | Documentar quién crea perfiles (Lety dice: "administración") | Sin spec. Probablemente ADMIN. | 🟡 Media | Confirmar con Lety. |

---

## Bloque 3 — Capacidad operativa y agenda

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| 3.1 | Capacidad por hora configurable por sucursal | `Branch.hourlyCapacity` (default 15). Rango validado [1, 100]. | ✅ Hecho | Existe y validado. |
| 3.2 | **Sobrepaso (sobrecupo) con autorización previa** | **No implementado.** No hay `overbookingCapacity`, `overbookingAuthorization`, `overbookingCutoffTime`. | 🔴 Alta | Frank propuso: "capacidad base + capacidad de sobrecupo bajo autorización". Erika: "ok, lo dejamos en v1.0 y vamos revisando". |
| 3.3 | **Ventana de tiempo límite** para autorizar sobrecupo (ej. hasta 12:00 del día previo) | No existe. | 🔴 Alta | Frank explícito: "si hay sobrecupo a las 12 pm de hoy para día siguiente ya no". Requiere decisión de UX. |
| 3.4 | **Pacientes sin cita previa** (llegada espontánea) | No hay categoría explícita. La junta lo mencionó como comentario, no acción. | 🟢 Baja | "Que lo capture la recepcionista" — Erika. Sin formalizar. |
| 3.5 | **Agenda solo la gestiona recepción** (Lolis). NO cliente, NO vendedor, NO asesor | `Appointment.source` default "SUCURSAL" (string libre). Sin role-gate en `createAppointment`. | 🔴 Alta | Hoy cualquiera con rol API puede crear cita. Hay que cerrar el actions. |
| 3.6 | Capacidad mostrada visualmente en agenda (cupo libre vs saturado) | Existe `branchConfig.hourlyCapacity` en UI. `appointments/page.tsx:247` lo consume. | ✅ Hecho | Frank mostró en demo "JuanCarlos: 1 de 15 disponibles". |
| 3.7 | **No limitar agendar más allá de capacidad**, pero registrar que se llenó | Sin enforcement. | 🟡 Media | Comité aprobó "se sigue recibiendo". Pero sin trazabilidad de "agenda sobrepoblada" — decisión de Frank. |
| 3.8 | Pacientes extras: personal de apoyo **se obtiene de unidades móviles** | Operativo, no de sistema. | — | Out of scope del sistema. |
| 3.9 | **Asignación multi-sucursal** desde la cita | `Company.allowedBranches[]` lo permite. UI hoy solo lista la defaultBranch del worker. | 🟡 Media | Frank en demo: "Aquí solo aparece la del Prado", Lety: "puede ser cualquiera". |

---

## Bloque 4 — Cita, check-in y datos del paciente

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| 4.1 | **Origen de la cita** (llamada, WhatsApp, presencial, unidad móvil) | `Appointment.source` STRING libre, default "SUCURSAL". Sin enum. | 🟡 Media | Frank en demo: "supongamos que fue una llamada". Necesario enum con valores controlados. |
| 4.2 | Trabajar captura INE / identificación con código de barras | `Appointment.qrCode`, `qrOperativo`. `IdentityDocumentType` catalog. | ✅ Hecho | Sprint 1. |
| 4.3 | **Reutilización de evidencia** (no recapturar INE cada vez) | `Worker.lastIdentityFrontFileUrl`, `lastIdentityVerifiedAt`. Reuso demo ok. | ✅ Hecho | Frank en demo: "reutilizar la última". |
| 4.4 | Validación de datos del paciente: por recepcionista, **no por sistema** | Sin OCR de identidad. Recepcionista corrobora visual. | 🟡 Media | Frank explícito: "esto lo valida la recepcionista Lety". Podría agregarse validación de nombre en flujo posterior. |
| 4.5 | **Link al paciente para datos personales declarativos** (antecedentes, laborales, familiares) | `PrefilledInvitation` model + flujo de auto-llenado. | ✅ Hecho | Frank en demo: "puede esperar y llenar mientras lo atienden". |
| 4.6 | **Unidades móviles: link enviado previamente** al paciente | Mismo `PrefilledInvitation`. Hoy no se aprovecha al máximo. | 🟡 Media | Decisión: cuándo se dispara el link (post-agenda vs alta). |
| 4.7 | Funcionalidades auto-llenado **bien, pero no obligatorias** | Decisión de producto ya aplicada. | ✅ Hecho | Frank: "Alan importante es que estén bien, pero no obligatorias". |
| 4.8 | Pase de entrada con código de barras / QR | `Appointment.qrCode`, `qrOperativo`. Escaneo en recepción. | ✅ Hecho | Frank en demo del flujo. |
| 4.9 | Capacidad visual en agenda del Prado (cupo de 15) | UI muestra `branchConfig.hourlyCapacity`. | ✅ Hecho | Frank lo mostró OK. |

---

## Bloque 5 — Examen médico (papeleta, somatometría, antecedentes, dictamen)

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|---xt|
| 5.1 | **Prellenado de exploración física** (oídos, membrana timpánica íntegra, etc.) estilo ZIN | Inputs de texto libre en `ExamenMedicoEstudio.tsx`. Sin plantillas. | 🔴 Alta | Frank: "Lo copia igualito que el ZIN". Erika: "Sí tal cual". |
| 5.2 | **Agudeza visual = combos de selección** (no inputs libres) | `AgudezaVisualStudy.tsx`: 8 campos `vision_lejana_od/oi`, `vision_cercana_od/oi`, `lejana_corregida_od/oi`, `cercana_corregida_od/oi`. **Todos son `<input type="text">`**. | 🔴 Alta | Jaqueline: "ya tenemos combos donde seleccionas y abajo te aparecen opciones". Erika: "dejar combos de selección". |
| 5.3 | **Campimetría = combos**: normal / alterada / no aplica / ver estudio anexo | `AgudezaVisualStudy.tsx:110` — `<input type="text">` para `campimetria`. | 🔴 Alta | Conversión a `<select>` con esas 4 opciones. |
| 5.4 | **Ishihara = combos**: normal / anormal | `AgudezaVisualStudy.tsx:120` — `<input type="text">` para `test_ishihara`. | 🔴 Alta | Conversión a `<select>` con 2 opciones. |
| 5.5 | **Reflejos**: default "PRESENTES Y NORMOREFLECTICOS" | `AgudezaVisualStudy.tsx:45` ya tiene ese default. | ✅ Hecho | Mantener. |
| 5.6 | **Antecedentes patológicos: si marca "Sí" → desplegar acordeón** con desde cuándo, tratamiento, etc. | `exam.schema.ts:149` `antecedentes_medico: cleanString`. Texto libre. Sin patrón acordeón. | 🔴 Alta | Frank: "que sea como acordeón que se expanda con ver detalles". |
| 5.7 | **Heredo familiares: combos de selección** (abuelo materno, paterno, padre, madre, otros) | Sin estructura dropdown hoy. | 🔴 Alta | Jaqueline explícito: "seleccionamos y tenemos opciones como opción múltiple". |
| 5.8 | Los datos del examen médico **deben auto-poblar el resumen/dictamen** | Sin link automático. `MedicalVerdict` es tabla separada. | 🔴 Alta | Jaqueline: "lo que necesitamos es que jale directo al resumen". Frank: "podríamos jalarlos directamente". |
| 5.9 | **Observaciones adicionales**: ampliar caracteres (hoy 1500) | Sin validación clara de longitud máxima. | 🟡 Media | Jaqueline: "cuántos caracteres tenemos". Frank: "casi ilimitados". |
| 5.10 | **Impresión del examen médico: máximo 3 hojas** | Sin restricción server-side. Bug actual: en ZIN se corta texto. | 🔴 Alta | Erika: "tres hojas, no más". |
| 5.11 | **Bypass de impresión de texto cortado** | Bug actual en ZIN. | 🔴 Alta | Mejorar CSS @media print o paginación. |
| 5.12 | Campo `puesto` en papeleta: lo llena el médico, no el paciente | Hoy campo libre en TriageForm. | 🟡 Media | Frank explícito: "esto lo llena el médico". |
| 5.13 | **Antecedentes:** los llena el paciente (antecedentes familiares, laborales, personales) | `AntecedentesCaptura` schema. Sub-pestaña dentro de Examen Médico. | ✅ Hecho reciente | ARCH-20260809-01 ya merged. |
| 5.14 | **Aptitud / dictamen**: incremento caracteres (campo muy limitado) | `MedicalVerdict` schema. Por auditar. | 🟡 Media | Jaqueline: "incrementar los caracteres porque está muy reducido". |
| 5.15 | **Signos vitales**: peso, talla, FC, FR, TA, cintura, cadera, temperatura | `ExamenMedicoEstudio.tsx` ya tiene estos campos. | ✅ Hecho | Frank en demo OK. |

---

## Bloque 6 — Temas cruzados / no asignados

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| 6.1 | Revisar documentación adjunta completa de empresa | Función en demo. Verificar cuántos y cuáles docs exige subir. | 🟡 Media | Lety dijo: "actualmente está validado por administración". |
| 6.2 | **Capacidad operativa** se configura semanalmente con logística | `BranchUpdateSchema` ya permite editar. Sin periodicidad. | 🟡 Media | Lety explícito. |
| 6.3 | Trazabilidad de "quién aceptó el sobrecupo" | No existe campo. | 🔴 Alta | Va de la mano con punto 3.2. |
| 6.4 | **Snapshot por cita** de antecedentes (no destruir al cambiar) | `physicalExamData.antecedentes_captured` ya es snapshot. | ✅ Hecho | ARCH-20260809-01. ADR mantenido. |
| 6.5 | Reporte final debe **jalar antecedentes directamente** | Sin auto-poblamiento. | 🔴 Alta | Punto 5.8 cruzado. |

---

## Próximos pasos sugeridos (no comprometedores)

1. **Antes de la próxima junta con AMI**, Frank debería priorizar estos 8 tickets críticos:
   - **[3.2 + 3.3]** Sobrepaso + autorización + cutoff time (decisión UX crítica)
   - **[3.5]** Cerrar `createAppointment` solo a RECEPCIONIST
   - **[5.1]** Prellenado de exploración física estilo ZIN
   - **[5.2, 5.3, 5.4]** Combos de selección en agudeza visual / campimetría / Ishihara
   - **[5.6, 5.7]** Acordeón en patológicos + combos familiares
   - **[5.8]** Auto-poblamiento del dictamen desde antecedentes
   - **[5.10, 5.11]** Impresión máx 3 hojas + fix de texto cortado
   - **[2.1]** Decisión: ¿eliminar `JobPosition` o dejarlo opcional?

2. **Decisión bloqueante:** 2.1 (modelo de datos). Implica migración o marcar como opcional. Sin esto, no se puede cerrar el sprint 1.

3. **No es decisión de este draft:** autorización final de Frank para convertir cada punto en SPEC. Este archivo es **separación de pendientes**, no es ticket.

---

## Referencias — extractos originales

- Bloque 1: líneas 76-145 (alta link), 152-198 (términos), 199-225 (roles)
- Bloque 2: líneas 220-265 (perfiles vs puestos)
- Bloque 3: líneas 30-49, 96-145, 354-435 (capacidad operativa)
- Bloque 4: líneas 460-560 (cita, check-in, pase)
- Bloque 5: líneas 565-700 (examen médico, agudeza visual), 700-825 (antecedentes), 825-925 (impresión 3 hojas)

---

**Nota final:** Este documento NO escala a INTEGRA por sí mismo. Es entregable de discovery. Cuando Frank priorice, cada ticket priorizado pasa a INTEGRA como `ARCH-YYYYMMDD-NN` con su SPEC.
