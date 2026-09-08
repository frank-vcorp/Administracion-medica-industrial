# Cruce: Minuta AMI-SR F-017 × Word Renombramiento de catálogos 2

**Actualizado:** 2026-09-07  
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
| R-03 | 🔗 Word + Minuta #4 | **Barra de búsqueda general** | Word pide combinar listados; minuta pide búsqueda global | ¿Unifica pacientes + expedientes? ¿Qué campos busca? |
| R-04 | 🔗 Word + Minuta #17 | **Usuarios personalizados** / roles | Sin enum "Coordinador Médico" hoy | ⏸️ Diferido en `context/roles/` |

### B.2 Solo Minuta AMI-SR F-017

| ID | # Minuta | Acción | Responsable | Fecha | Por qué revisar |
|---|---|---|---|---|---|
| R-05 | 2 | Diagnóstico IA → **cuadro diagnóstico editable** | Francisco | 08/09 | Flujo IA + persistencia + quién edita |
| R-06 | 3 | **Recomendaciones autogeneradas** editables | Francisco | 08/09 | Origen IA vs plantilla; validación |
| R-07 | 8 | **TA siempre** en diagnóstico | Francisco | 08/09 | ¿Obligatorio? ¿Copia automática desde signos vitales? |
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
| R-17 | Estatus pruebas: **Realizado / Pendiente / No realizado** | Puede cambiar enums BD | ¿Reemplaza labels actuales o estados nuevos? |
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
| **B — Con revisión** | 23 | 1 ⏸️ diferido (roles), 22 pendientes |
| **Total ítems únicos** | 33 | |

---

## Orden sugerido de implementación

1. **Triviales pendientes** (T-06 → T-09): signos vitales, LAM, columna vertebral  
2. **Revisión rápida + implementar** (R-01, R-02): listado día siguiente + clic pendientes  
3. **Esperar insumos** (R-08 logos/consentimiento/agudeza): Jaqueline / Leticia  
4. **Clínico + IA** (R-05, R-06, R-07, R-09)  
5. **Catálogo** (R-12, R-13)  
6. **Post-atención** (R-10, R-11)  
7. **Word backlog** (R-15 → R-23) con confirmación negocio  
8. **Roles** (R-04) al cerrar pantallas  

---

## Referencias cruzadas

| Tema | Word | Minuta | Roles |
|---|---|---|---|
| Pacientes citados | KPI rename ✅ | #5 listado día siguiente | Recepción / Coord. Médico |
| Pruebas pendientes | KPI rename ✅ | #18 clic → paciente | Recepción / Coord. Médico |
| Búsqueda / listados | Combinar listados | #4 barra general | — |
| Usuarios | Roles columna | #17 personalizados | `context/roles/` |
