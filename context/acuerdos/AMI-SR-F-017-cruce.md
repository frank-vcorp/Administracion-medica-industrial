# Cruce: Minuta AMI-SR F-017 × Word Renombramiento de catálogos 2

**Actualizado:** 2026-09-08  
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
| R-01 | 🔗 Word + Minuta #5 | **Listado pacientes citados día siguiente** | Word solo renombró KPI; minuta pide listado nuevo | ¿Pantalla aparte o sección en Gestión de citas? ¿Solo lectura? |
| R-02 | 🔗 Word + Minuta #18 | **Clic en pendientes → ir al paciente** con prueba pendiente | Implica navegación y filtro por estudio | ¿A expediente, papeleta o estudio específico? |
| R-03 | 🔗 Word + Minuta #4 | **Barra de búsqueda general** | Word pide combinar listados; minuta pide búsqueda global | ✅ Hecho — barra en header; pacientes + expedientes + empresas (admin) |
| R-04 | 🔗 Word + Minuta #17 | **Usuarios personalizados** / roles | Sin enum "Coordinador Médico" hoy | ⏸️ Diferido en `context/roles/` |

### B.2 Solo Minuta AMI-SR F-017

| ID | # Minuta | Acción | Responsable | Fecha | Por qué revisar |
|---|---|---|---|---|---|
| R-05 | 2 | Diagnóstico IA → **cuadro diagnóstico editable** | Francisco | 08/09 | ✅ Hecho (panel prediagnóstico IA por estudio) |
| R-06 | 3 | **Recomendaciones autogeneradas** editables | Francisco | 08/09 | ✅ Hecho (`practical_recommendation` + textarea editable) |
| R-07 | 8 | **TA siempre** en diagnóstico | Francisco | 08/09 | ⏸️ Ver §Decisiones — dictamen final, no examen médico |
| R-08 | 9 | Parámetros **agudeza visual** para clasificar | Jaqueline → enviar | 04/09 | Esperar parámetros clínicos |
| R-09 | 12 | **Consentimiento** en Check-in | Jaqueline envía | 04/09 | Texto legal + momento del flujo |
| R-10 | 13 | Mensaje para **calificar servicio** al finalizar | Francisco | 08/09 | Canal (WhatsApp/SMS/in-app) |
| R-11 | 14 | **Encuesta satisfacción** pacientes | Francisco | 08/09 | Contenido + integración |
| R-12 | 15 | Cargar pruebas: campimetría, ECG, consulta, certificado | Francisco | 08/09 | Catálogo + precios + combos |
| R-13 | 16 | Cargar exámenes **Flowserve y Sodexo** | Francisco | 08/09 | Paquetes por empresa; datos fuente |
| R-14 | 19 | Pre-presentación **capacitación** plataforma | Francisco | — | Proceso, no código |

### B.3 Solo Word Renombramiento (no en minuta)

| ID | Acción | Por qué revisar | Pregunta clave |
|---|---|---|---|
| R-15 | **Total del día** (KPI) | No existe tarjeta | ¿Qué suma? ¿Misma pantalla que citas? |
| R-16 | Eliminar **Agenda** y **combinar listados** | Cambio estructural nav + UX | ¿Qué pasa con `/dashboard` y `/events`? |
| R-17 | Estatus pruebas: **Realizado / Pendiente / No realizado** (+ subtexto lab) | Puede cambiar enums BD | ✅ Hecho (capa visual, DEC-20260907-01) |
| R-18 | Estatus **interpretación** vs envío | Conflicto en doc (envío vs interpretación) | ¿Cuál set de estatus queda? |
| R-19 | **Público general** dentro de listado empresas | Cambio de ruta/nav | ¿Eliminar `/publico-general`? |
| R-20 | **Validación diagnóstica** en listado (tabla) | Layout + columnas | ¿Qué columnas y acciones? |
| R-21 | **Semáforo** expediente completo/incompleto | Regla de negocio | ¿Qué define "completo"? |
| R-22 | **Informe mensual** | Sin especificar informe | ¿Cuál módulo? ¿Reportes masivos? |
| R-23 | **Bug modal** agendar citas | UI pero hay que reproducir | ¿Scroll, z-index, tamaño? |

---

## Resumen numérico

| Categoría | Cantidad | Estado |
|---|---|---|
| **A — Triviales** | 10 | 10 ✅ hechos |
| **B — Con revisión** | 23 | 1 ⏸️ diferido (roles), 21 pendientes, 1 ✅ (R-17 visual) |
| **Total ítems únicos** | 33 | |

---

## Orden sugerido de implementación

1. **Triviales pendientes** (T-06 → T-09): signos vitales, LAM, columna vertebral  
2. **Revisión rápida + implementar** (R-01, R-02): listado día siguiente + clic pendientes  
3. **Esperar insumos** (R-08 logos/consentimiento/agudeza): Jaqueline / Leticia  
4. **Clínico + IA** (R-05 ✅, R-06 ✅; R-09 pendiente insumos)  
5. **Catálogo** (R-12, R-13)  
6. **Post-atención** (R-10, R-11)  
7. **Dictámenes finales + PDFs** (R-07 y entregables incompletos — ver §Decisiones)  
8. **Word backlog** (R-15 → R-23) con confirmación negocio  
9. **Roles** (R-04) al cerrar pantallas  

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

---

## Referencias cruzadas

| Tema | Word | Minuta | Roles |
|---|---|---|---|
| Pacientes citados | KPI rename ✅ | #5 listado día siguiente | Recepción / Coord. Médico |
| Pruebas pendientes | KPI rename ✅ | #18 clic → paciente | Recepción / Coord. Médico |
| Búsqueda / listados | Combinar listados ✅ | #4 barra general ✅ | — |
| Usuarios | Roles columna | #17 personalizados | `context/roles/` |
