# SPEC ARCH-20260624-02 — Renombramientos Fase 2 (Reorden Nav + Lane + Separación de columnas)

**ID:** ARCH-20260624-02
**Fecha:** 2026-06-24
**Autor:** INTEGRA (Arquitecto de Soluciones)
**Origen:** Decisión del usuario sobre `context/datos AMI/Renombramiento de catálogos.docx`
**Estado:** `[~] Planificado`
**Depende de:** IMPL-20260624-01-RENOMBRES-ETIQUETAS
**Sprint objetivo:** Pendiente de asignación
**Owner implementación:** INTEGRA (corrección por fallo repetido de SOFIA con archivos `.fuse_hidden*`)

---

## 1. Contexto

Fase 1 (renames literales) fue aplicada en dos iteraciones:
- **Iteración 1 (IMPL-20260624-01)**: SOFIA reportó éxito pero los cambios quedaron en archivos `.fuse_hidden*` (caché del IDE), no en archivos fuente reales. Detectado por INTEGRA.
- **Iteración 2 (IMPL-20260624-01b)**: SOFIA aplicó 22 renames en 8 archivos fuente reales (dashboard, workers/page, validation, reception, EventFlowController, AppShell, id.utils). **3 archivos quedaron pendientes**: `WorkersTable.tsx`, `CorroborationModal.tsx`, `WorkerFormModal.tsx`, `appointments/page.tsx`.

**Iteración 3 (IMPL-20260624-03)**: INTEGRA aplica los cambios restantes directamente con Edit tool, e incorpora la decisión adicional del usuario de **separar las columnas Empresa/Puesto y Contacto** en `WorkersTable.tsx` (decisión explícita del usuario 2026-06-24: "el ID solo cambia etiquetas visuales, no cambies algo que modifique el comportamiento del código; Empresa/Puesto déjalo como está; Contacto hay que separarlo en dos — Correo y Teléfono; Empresa debe llevar Empresa y Puesto por separado").

## 2. Cambios aprobados por el usuario

### 2.1 Reorden del menú lateral (`AppShell.tsx`)

**Decisión del usuario:** "Agenda al final, operativos al inicio" (2026-06-24).

**Orden actual (líneas 130–137 de `AppShell.tsx`):**
1. Dashboard (renombrado a "Agenda" en Fase 1)
2. Trabajadores (renombrado a "Listado de pacientes" en Fase 1)
3. Piso Clínico (renombrado a "Proceso de atención clínica" en Fase 1)
4. Gestión de Citas
5. Vista 3 Agendas (secondary)

**Orden nuevo (a aplicar):**
1. Gestión de Citas
2. Listado de pacientes
3. Proceso de atención clínica
4. Agenda
5. Vista 3 Agendas (secondary, bajo Gestión de Citas)

**Restricciones:**
- No mover el `NavSection label="Médico"` ni los items debajo (Expedientes Activos, Validación).
- No mover el `NavSection label="Empresas"` ni los items debajo.
- "Vista 3 Agendas" debe permanecer como secondary de "Gestión de Citas" (no de Agenda).
- El item "Agenda" se mantiene en el bloque `{showStaffItems && (...)}`.

### 2.2 Renombrar Lane "SALA DE ESPERA" → "Registro de pruebas" (`reception/page.tsx`)

**Decisión del usuario:** "Solo renombrar" (2026-06-24). No se agrega lógica de papeleta con checkbox ni restricción de expediente (queda fuera de alcance).

**Cambio exacto:**
- Archivo: `frontend/src/app/reception/page.tsx`
- Línea 64
- `title="SALA DE ESPERA"` → `title="Registro de pruebas"`

### 2.3 Separar columnas en `WorkersTable.tsx` (decisión del usuario 2026-06-24)

**Regla explícita del usuario:**
- **ID**: solo etiqueta visual, NO modificar comportamiento.
- **Empresa / Puesto**: NO renombrar el texto, pero **separar la columna en dos** visualmente.
- **Contacto**: **separar en dos columnas** — `Correo` y `Teléfono`.

**Estructura nueva de la tabla (`WorkersTable.tsx`):**

| # | Columna | Dato fuente | Render |
|---|---------|-------------|--------|
| 1 | `ID` | `w.universalId` | mono |
| 2 | `Nombre Completo` | `w.firstName + w.lastName` | bold |
| 3 | `Empresa` | `w.company.name` | pill azul |
| 4 | `Puesto` | `w.jobPosition.name` | pill ámbar |
| 5 | `Correo` | `w.email` | text-xs |
| 6 | `Teléfono` | `w.phone` | text-xs |
| 7 | `Acciones` | botones Editar/Historial | right-aligned |

**Cambios técnicos:**
- `<thead>`: 5 `<th>` → 7 `<th>`.
- `<tbody>`: celdas reagrupadas — Empresa y Puesto separadas (antes en un solo `<td>` con `flex-col`), Correo y Teléfono separadas (antes combinadas con `||` en un solo `<td>`).
- `colSpan={5}` → `colSpan={7}`.
- Datos faltantes: `w.jobPosition` ausente → `"—"`; `w.email` o `w.phone` ausentes → `"—"`; `w.company` ausente → `"Sin Empresa"` (igual que antes).

**NO se modificó:**
- Lógica, props, tipos, ni el modal de edición.
- El tipo `WorkerRow` ni las funciones helper.
- Tests (no hay tests específicos para `WorkersTable`).

### 2.4 Renames pendientes (ID solo visual) en archivos restantes

- `frontend/src/components/CorroborationModal.tsx:256` — `>ID Universal<` → `>ID<` (solo label).
- `frontend/src/components/WorkerFormModal.tsx:399` — `Banner ID Universal` → `Banner ID` (solo label).
- `frontend/src/components/WorkerFormModal.tsx:406` — `ID Universal se generará automáticamente` → `ID se generará automáticamente` (solo label).
- `frontend/src/app/appointments/page.tsx:224` — `label="Total"` → `label="completar con pacientes citados"`.
- `frontend/src/app/appointments/page.tsx:226` — `label="Completadas"` → `label="Atención completa"`.
- `frontend/src/app/appointments/page.tsx:227` — `label="Ausentes"` → `label="no se presentó"`.
- `frontend/src/app/appointments/page.tsx:233` — `Cronograma de Atención` → `agenda del día`.

## 3. Cambios NO incluidos en esta fase (quedan como tickets futuros)

- Filtro multi-clínica en Dashboard: **YA EXISTE** en `/appointments/overview` (informado por el usuario 2026-06-24).
- Aviso de consentimiento de marketing (check) — feature nueva, fuera de alcance.
- Clínicas móviles en la agenda — feature nueva, fuera de alcance.
- Filtro "Pruebas pendientes" en agenda — feature nueva, fuera de alcance.
- Regla de ausentes: **decidido "solo etiquetar"** — ya implementado como status `NO_SHOW` con label "no se presentó" (Fase 1).
- Header "Separar por Empresa y Perfil" como acción de UI: el usuario no eligió esa opción, queda como header literal.
- Duplicados de consistencia encontrados por SOFIA en Fase 1 (botón "Volver al Piso Clínico", "Volver al Dashboard" en portal B2B, etc.) — se evaluarán en otra iteración.

## 4. Criterios de aceptación

| # | Criterio | Verificación |
|---|----------|--------------|
| CA-1 | El menú lateral muestra en orden: Gestión de Citas → Listado de pacientes → Proceso de atención clínica → Agenda | Inspección visual + lectura de `AppShell.tsx` |
| CA-2 | "Vista 3 Agendas" sigue debajo de "Gestión de Citas" como secondary | Inspección visual + lectura de `AppShell.tsx` |
| CA-3 | Las secciones "Médico" y "Empresas" no se ven afectadas | Comparación con orden previo |
| CA-4 | La lane "SALA DE ESPERA" en `/reception` ahora muestra "Registro de pruebas" | Inspección visual + lectura de `reception/page.tsx:65` |
| CA-5 | El resto de lanes (en proceso de prueba, Por dictaminar) mantiene los renames de Fase 1 | Inspección visual |
| CA-6 | `WorkersTable` muestra 7 columnas: ID, Nombre Completo, Empresa, Puesto, Correo, Teléfono, Acciones | Inspección visual + `colSpan={7}` |
| CA-7 | Los datos de Empresa, Puesto, Correo y Teléfono se muestran por separado (no concatenados) | Inspección visual |
| CA-8 | No se introducen regresiones en typecheck, tests ni lint | `tsc --noEmit`, `vitest run`, `eslint` |
| CA-9 | No se introducen regresiones en login, flujo de pacientes ni portal B2B | E2E manual o `pnpm test` |

## 5. Validaciones obligatorias

Antes de cerrar la implementación:

1. `pnpm typecheck` (o `npx tsc --noEmit`) — debe pasar sin nuevos errores. **Resultado iteración 3: EXIT_CODE=0** ✓
2. `pnpm test` (o `npx vitest run`) — debe pasar. **Resultado iteración 3: 22/22 tests passed** ✓
3. `pnpm lint` (o `npx eslint`) — no debe introducir nuevos errores en archivos tocados. **Resultado iteración 3: 0 errores nuevos en mis líneas (WorkersTable línea 75-130, CorroborationModal 256, WorkerFormModal 399/406, appointments 224-233). Los issues reportados son preexistentes en líneas que no toqué (62, 73).** ✓

## 6. Self-review manual de SOFIA antes de cerrar

- ¿El orden del nav refleja literalmente lo aprobado (1·Citas, 2·Listado, 3·Proceso, 4·Agenda)?
- ¿El secondary "Vista 3 Agendas" quedó bajo "Gestión de Citas" y no bajo "Agenda"?
- ¿El rename del Lane quedó textual sin afectar el resto del Kanban?
- ¿Algún archivo de tests, storybook o fixture quedó con la cadena vieja?
- ¿Algún riesgo de regresión visual o de navegación?

## 7. Segunda mano de validación

INTEGRA invocará a **GEMINI** (`subagent_type='gemini'`) como segunda mano antes de aprobar commit. NO usar Qodo (sunset 2026-06-22).

## 8. Riesgos identificados

- **R1 (bajo):** Si el orden de los NavItem es referenciado en tests E2E (`tests/vercel-sanity.spec.ts`), el cambio de orden podría romper aserciones por índice. Mitigación: SOFIA debe revisar ese archivo y ajustar si es necesario.
- **R2 (bajo):** Si algún usuario tenía bookmark del item del sidebar por posición DOM (no por label), el reorden lo afecta. Mitigación: las URLs (`/appointments`, `/workers`, etc.) no cambian, solo el orden visual.

## 9. Rollback

Procedimiento estándar:
1. `git revert <commit>`
2. Crear checkpoint explicando razón
3. CRONISTA actualiza PROYECTO.md
4. Documentar en `context/interconsultas/`

---

**Aprobado por:** Usuario (decisiones registradas en conversación 2026-06-24)
**Pendiente de commit:** Sí — esperar OK explícito del usuario antes de commitear.
