# SPEC — Rediseño moderado ficha del paciente `/workers/[id]`

- **ID:** ARCH-20260808-05
- **Tipo:** Arquitectónica (rediseño de vista + contrato Prisma aditivo)
- **Origen:** Handoff ATLAS M3 → INTEGRA (2026-08-08)
- **Decisión del usuario:** Opción A — Rediseño moderado (preserva estructura, alinea estilo, repara botones)
- **Estado:** READY (cumple DoR)
- **Confianza INTEGRA:** ≥90 % en decisiones internas reversibles

## 1. Problema raíz

La ficha `/workers/[id]` rompe la coherencia visual del sistema y contiene 2 botones no funcionales (sin handler) y 1 TODO visible en runtime. Ver `frontend/src/app/workers/[id]/page.tsx` (216 líneas).

No es un bug aislado: son **10 desviaciones de estilo** + **2 contratos rotos** (botones muertos) + **1 contrato Prisma incompleto** (branch sin populate).

## 2. Objetivo

Alinear la ficha al estándar visual del sistema (Dashboard/Companies/Workers/Appointments) y hacer funcionales los botones "Editar Perfil" y "Agendar Cita", **sin** cambiar la estructura de información (Opción A: rediseño moderado, no re-arquitectura de layout).

## 3. Alcance (3 artefactos)

| # | Archivo | Tipo | Acción |
|---|---|---|---|
| 1 | `frontend/src/services/worker.service.ts` | Existente | Modificar `getWorkerById`: añadir `include.branch` a `medicalHistory` |
| 2 | `frontend/src/app/workers/[id]/WorkerDetailClient.tsx` | **Nuevo** | Client wrapper: estado de modales + header con botones funcionales |
| 3 | `frontend/src/app/workers/[id]/page.tsx` | Existente | Refactor a server delgado: fetch + serializa + render `<WorkerDetailClient>`; alineación tipográfica y de paleta |

**Ajuste secundario permitido en misma tarea:** `frontend/src/components/workers/WorkerIdentityCard.tsx` — alinear hover ámbar a paleta slate/blue (ver §6.4).

## 4. Decisiones de contrato (respuestas a las 8 preguntas de ATLAS)

### D1 — Split server/client: `WorkerDetailClient.tsx` (SÍ)
Adoptar el patrón existente del proyecto (`UsersClient`, `LabResultsClient`, `CatalogClient`, `PrefillPortalClient`). La página server queda delgada: `await params` + `getWorkerById` + `getWorkerClinicalHistory` + serialización + `<WorkerDetailClient worker={...} history={...} />`. El client wrapper posee el estado de los 2 modales.

### D2 — `getWorkerById` incluye `branch` (SÍ, aditivo)
Añadir dentro de `medicalHistory`:
```
include: { branch: { select: { id: true, name: true } } }
```
- No rompe contrato: `event.branchId` sigue disponible; ahora además `event.branch?.name`.
- Elimina el TODO de runtime (`page.tsx:200`).
- Prisma 5.x: anidar `include` dentro de `include.medicalHistory` es válido (ya hay `orderBy` anidado).

### D3 — "Iniciar Nueva Visita" → "Agendar Cita" (SÍ)
"Visita" colisiona con `MedicalEvent` (visita médica finalizada). "Cita" = `Appointment` (flujo de agendado). Conceptualmente preciso y alinea con `AppointmentFormModal`.

### D4 — Card azul → card slate (SÍ, reemplazar)
La card contenedora "Historial Clínico Longitudinal" (`page.tsx:135-175`) pasa de `border-blue-200` + `bg-blue-50` a paleta slate estándar (`bg-white border-slate-200`). **Preservar la diferenciación semántica** vía:
- Badge "Longitudinal" como accent puntual (puede mantener `bg-blue-100 text-blue-700` — es accent, no card).
- Link "Abrir Historial completo" en `text-blue-600` (patrón de links del sistema).
La card contenedora NUNCA va azul; los accents azules van en elementos puntuales.

### D5 — Avatar: iniciales, NO foto de documento (SÍ, mantener iniciales)
Razón: `lastIdentityFrontFileUrl` es foto de **carnet de identidad**, no retrato. Mostrarla como avatar es semánticamente incorrecto y redundante con `WorkerIdentityCard` (que ya la muestra en su contexto correcto con miniatura ampliable). El dato ya llega al server (no requiere tocar `getWorkerById`); la decisión es de UI: **avatar de iniciales**.
Estilo alineado: `w-16 h-16 rounded-2xl bg-indigo-500 text-white font-bold` (paleta indigo del Dashboard perfil; `rounded-2xl` del sistema; tamaño `w-16` justificado por jerarquía del header de ficha).

### D6 — `space-y-8 pb-12` (SÍ)
`pb-12` es patrón mayoritario (Dashboard, Workers page). `pb-24` es caso aislado (Companies). La ficha pertenece a la familia Workers. Header actual `space-y-6` → `space-y-8`.

### D7 — colSpan 2 con subdivisión interna (SÍ, mantener + reestructurar)
Mantener `md:col-span-2` (la lista de visitas necesita ancho). El problema "rodeada de vacío con pocas visitas" se resuelve con **estado vacío con CTA** (no italic mínimo): "Aún no hay visitas registradas. Agendar primera cita →". Subdividir internamente: header (título + contador) + lista + estado vacío. No centrar la lista.

### D8 — Requiere ARCH (SÍ, este documento lo es)
Es rediseño con 2 decisiones de contrato (split client/server, cambio Prisma include). No requiere ADR separada: el alcance es una sola vista, no decisión multi-módulo. Esta SPEC es el artefacto ARCH suficiente.

## 5. Criterios de aceptación (DoD)

1. **Botón "Editar Perfil"** abre `WorkerFormModal` con `workerToEdit` precargado (datos del worker actual).
2. **Botón "Agendar Cita"** abre `AppointmentFormModal` con `workerId` y `companyId` del worker actual (ver §6.3 sobre mecanismo).
3. **Sin TODO en runtime**: `event.branch?.name` poblado; fallback a `event.branchId` si `branch` es null (no crashear).
4. **Paleta slate coherente**: la card "Historial Clínico Longitudinal" ya NO es azul contenedora; sólo accents azules puntuales (badge, link).
5. **Tipografía**: header `text-3xl font-black text-slate-900 tracking-tight` (alinea con Workers page).
6. **Rounded**: cards `rounded-2xl border border-slate-200 shadow-xl shadow-slate-100` (alinea con Companies/WorkerSelectableGrid).
7. **Avatar**: `rounded-2xl bg-indigo-500` (no `rounded-full bg-slate-200`).
8. **Spacing**: contenedor `space-y-8 pb-12`.
9. **`WorkerIdentityCard` (IMPL-20260808-04)**: hover alineado a paleta (slate o blue accent), NO ámbar. Sin regresión en su funcionalidad de miniatura ampliable.
10. **Gates verdes**: `pnpm typecheck` + `pnpm test` + `pnpm lint` (si existe script).
11. **Sin regresión**: `WorkerIdentityCard` sigue renderizando con los mismos props; `getWorkerClinicalHistory` y la lógica de prefill longitudinal (legacy fallback incluido) se preservan intactas.

## 6. Restricciones y puntos de decisión para SOFIA

### 6.1 Serialización server→client
El `worker` de Prisma contiene `Date` (y posiblemente `Decimal`/`BigInt`). Pasar de server a client requiere serialización segura. SOFIA debe:
- Definir un tipo `SerializedWorker` explícito (no `any`).
- Convertir fechas a ISO string en server, parsear en client donde se formatee.
- Preservar la lógica de prefill longitudinal (`datos_personales`/`historia_laboral`/`heredo_familiares` + fallback `prefill_base`) — puede moverse al client o quedarse en server y pasarse ya resuelta. **Decisión SOFIA**: si mueve `renderPrefillSection` al client, preservar exactamente el filtrado de entries vacías y el formato de claves (`replace(/_/g,' ')`).

### 6.2 Preservar trazabilidad
El header del `page.tsx` actual referencia `ARCH-20260326-02`, `ARCH-20260326-10`, `CHK_IMPL-ARCH-20260326-06`. **No eliminar** esos comentarios; añadir debajo la nueva intervención `ARCH-20260808-05` con backup a esta SPEC.

### 6.3 Mecanismo de "Agendar Cita"
`AppointmentFormModal` lee `?action=new-appointment&workerId=...&companyId=...` (vía URL). Dos opciones:
- **(a)** Abrir el modal vía estado local controlado (prop `open`/`onClose`). Requiere que `AppointmentFormModal` soporte apertura controlada.
- **(b)** `router.push(\`/workers/${id}?action=new-appointment&workerId=${id}&companyId=${companyId}\`)` y dejar que el modal se abra solo por la query.

**Decisión SOFIA (límite):** si la opción (a) requiere **añadir una prop opcional** a `AppointmentFormModal` sin romper su comportamiento existente, procede. Si requiere **cambiar la API pública** del modal de forma que afecte otros callers, **detente y escala a INTEGRA** (sería L3). Documentar qué callers existen antes de decidir (`grep` de `<AppointmentFormModal`).

### 6.4 Hover de `WorkerIdentityCard`
ATLAS sugiere `hover:border-blue-400`. Criterio: paleta slate dominante, accent blue permitido en elementos interactivos puntuales. SOFIA elige entre `hover:border-slate-400` (máxima coherencia) y `hover:border-blue-400` (accent coherente con links). **Prohibido** ámbar (`hover:border-amber-*`).

### 6.5 Lo que NO se hace (fuera de alcance Opción A)
- No re-arquitecturar el grid 1/3 + 2/3.
- No añadir nuevas secciones (exámenes, citas futuras, etc.).
- No cambiar la ruta ni el schema de URLs.
- No tocar `getWorkerClinicalHistory` ni la lógica longitudinal.
- No paginar `medicalHistory` (out of scope; el TODO de paginación va a BACKLOG separado si surge).

## 7. Handoff a SOFIA

```
Tarea: Rediseño moderado ficha /workers/[id] (Opción A)
SPEC: context/SPECs/SPEC_ARCH-20260808-05-REDESIGN-FICHA-WORKER.md
ID implementación: IMPL-20260808-NN (asigna SOFIA)

Artefactos (orden sugerido, 1→2→3; 1 y 2 pueden ir en paralelo):
  1. frontend/src/services/worker.service.ts  (getWorkerById: +include.branch)
  2. frontend/src/app/workers/[id]/WorkerDetailClient.tsx  (NUEVO, client wrapper)
  3. frontend/src/app/workers/[id]/page.tsx  (refactor server delgado + alineación estilo)
  +  frontend/src/components/workers/WorkerIdentityCard.tsx  (hover, ajuste menor)

Referencias de patrones (leer antes de implementar, NO copiar):
  - Dashboard:        frontend/src/app/dashboard/page.tsx          (font-extrabold, space-y-10 pb-12, bg-indigo-500 rounded-xl)
  - Companies:        frontend/src/app/companies/page.tsx          (font-black, pb-24, rounded-2xl border-slate-100 shadow-xl shadow-slate-100)
  - Workers page:     frontend/src/app/workers/page.tsx            (space-y-8 pb-12, text-3xl font-black tracking-tight)
  - Appointments:     frontend/src/app/appointments/page.tsx       (rounded-3xl border-slate-200 shadow-xl shadow-slate-200/50)
  - Client wrapper:   frontend/src/app/admin/users/UsersClient.tsx (patrón client wrapper a replicar)
  - Modales:          frontend/src/components/WorkerFormModal.tsx        (prop workerToEdit)
                     frontend/src/components/AppointmentFormModal.tsx   (ver §6.3 mecanismo)

Validaciones obligatorias antes de cerrar:
  1. pnpm typecheck
  2. pnpm test
  3. pnpm lint (si existe script)
NO ejecutar qodo (sunset). Self-review manual:
  - ¿El código refleja la SPEC (10 criterios de §5)?
  - ¿Hay code smells (any, fechas sin serializar, TODOs)?
  - ¿Tests cubren edge cases (worker sin medicalHistory, branch null, modal apertura)?
  - ¿Riesgo de regresión en WorkerIdentityCard / prefill longitudinal?
Solicitar revisión final a GEMINI (subagent_type='gemini') como segunda mano de validación antes de marcar como listo para commit.

Restricciones:
  - No commit/push/PR.
  - No tocar getWorkerClinicalHistory ni lógica longitudinal.
  - No cambiar ruta ni schema URLs.
  - Si AppointmentFormModal requiere cambio de API pública → escalar a INTEGRA (L3).
```

## 8. Riesgos

| Riesgo | Prob | Mitigación |
|---|---|---|
| `AppointmentFormModal` no soporta apertura controlada por prop | Media | §6.3: preferir router.push (b) si (a) rompe API; escalar si ambos rompen |
| Serialización de `Date` server→client rompe formato | Media | §6.1: tipo `SerializedWorker` explícito, ISO strings |
| `WorkerFormModal` requiere más props de las que pasa `workerToEdit` | Baja | SOFIA debe leer la interfaz del modal antes de integrar |
| Regresión en lógica prefill longitudinal (legacy fallback) | Baja | §6.1: preservar `rootDP/rootHL/rootHF` + `legacyBase` intactos |

## 9. Dependencias

- `getWorkerById` modificado ( artefacto 1 ) debe estar hecho antes de que `page.tsx` ( artefacto 3 ) consuma `event.branch?.name`. Si se hace en paralelo, `page.tsx` usa fallback `event.branchId` temporal y se elimina al mergear.
- `WorkerDetailClient` ( artefacto 2 ) debe existir antes de que `page.tsx` ( artefacto 3 ) lo renderice.

## 10. Observación de gobernanza (fuera de este scope)

`PROYECTO.md` **no existe** en este repo (confirmado por ATLAS). Según §6 de INTEGRA, un proyecto existente sin `PROYECTO.md` debería reconstruirse. **No se inicializa en este turno** porque ampliaría el alcance del handoff sin OK de Frank. Se deja como observación: si Frank quiere gobernanza IDL completa en este repo, abrir tarea separada `ARCH-20260808-NN` para inicializar `PROYECTO.md` desde manifiestos + historial. Por ahora, esta SPEC + el dictamen son la fuente de verdad acotada para el rediseño.
