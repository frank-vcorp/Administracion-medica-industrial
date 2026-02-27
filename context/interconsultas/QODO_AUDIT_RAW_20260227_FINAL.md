Initializing Qodo Agent...
Reading agent protocol...
Initializing MCP Servers...
Successfully initialized 9 MCP Servers: [ripgrep, filesystem, git, shell, web_search, qodo_aware_context_retriever, qodo_merge, chat_history, todo_list]



[2J[H╭────────────────────────────────────────────────────────────────────╮
│ Welcome to Qodo Command                                            │
│ Session ID: 20260227-0ab80327-cd14-457c-89ff-7035384f84dc          │
│ Version: 0.36.0 (latest)                                           │
│ AGENTS.md not found - run 'qodo init' to generate project overview │
│ Remaining messages and tool calls: 115 (resets in 27 days)         │
╰────────────────────────────────────────────────────────────────────╯


[0s]  Processing your request... [ESC to stop]
[1A[1AYou:
  Audita frontend/src/actions/appointment.actions.ts,
  frontend/src/app/appointments/page.tsx, frontend/src/app/reception/page.tsx y
  frontend/src/components/AppointmentFormModal.tsx buscando errores de lógica,
  race conditions, manejo de errores y consistencia con el esquema de Prisma.
  Revisa especialmente el uso de transacciones y fechas UTC.


[0s]  Processing your request... [ESC to stop]
[1A[1A
[1s]  Processing your request... [ESC to stop]
[1A[1A
[2s]  Processing your request... [ESC to stop]
[1A[1A
[3s]  Processing your request... [ESC to stop]
[1A[1A
[4s]  Processing your request... [ESC to stop]
[1A[1A
Qodo:
  Leer archivos solicitados para auditoría de
  lógica, errores y consistencia con
  Prisma/fechas UTC.
  +- read_files
  |--paths:["frontend/src/actions/appointment.actions.ts","frontend/src/app/appointments/pa
           ge.tsx","frontend...


[4s]  Processing your request... [ESC to stop]
[1A[1A  `--- [OK] Success
         [
           {
             "path": "frontend/src/actions/appointment.actions.ts",
             "error": "E...


[4s]  Processing your request... [ESC to stop]
[1A[1A
Qodo:
  Buscar usos de Prisma, transacciones
  ($transaction) y manejo de fechas/UTC en el
  frontend para detectar inconsistencias.
  +- ripgrep_search
  |-- pattern: "\\$transaction|Prisma|prisma\\.|new
               Date\\(|toISOString\\(|DateTime|UTC|timezone|moment|dayjs"
  |-- path: "frontend/src"
  |-- fileTypes: ["ts","tsx"]
  |-- maxResults: 100
  |-- contextLines: 2


[4s]  Processing your request... [ESC to stop]
[1A[1A  `--- [ERR] Error
        ripgrep failed with exit code 2: frontend/src: No such file or directory (os
        err...


[4s]  Processing your request... [ESC to stop]
[1A[1A
[5s]  Processing your request... [ESC to stop]
[1A[1A
[6s]  Processing your request... [ESC to stop]
[1A[1A
Qodo:
  Listar estructura para ubicar la carpeta src
  correcta (parece que no existe frontend/src
  bajo este cwd).
  +- list_files_in_directories
  |-- paths: ["."]


[6s]  Processing your request... [ESC to stop]
[1A[1A  `--- [OK] Success
         === . ===
         [FILE] .env
         [FILE] .eslintignore
         [FILE] .gitignore
         [DIR] .next
         [FILE] ...


[6s]  Processing your request... [ESC to stop]
[1A[1A
[7s]  Processing your request... [ESC to stop]
[1A[1A
[8s]  Processing your request... [ESC to stop]
[1A[1A
Qodo:
  Releer archivos con ruta correcta bajo src/
  (sin prefijo frontend/).
  +- read_files
  |--paths:["src/actions/appointment.actions.ts","src/app/appointments/page.tsx","src/app/r
           eception/page.tsx...


[8s]  Processing your request... [ESC to stop]
[1A[1A  `--- [OK] Success
         [
           {
             "path": "src/actions/appointment.actions.ts",
             "content": "'use ser...


[8s]  Processing your request... [ESC to stop]
[1A[1A
[9s]  Processing your request... [ESC to stop]
[1A[1A
[10s]  Processing your request... [ESC to stop]
[1A[1A
Qodo:
  Leer schema de Prisma para validar
  enums/relaciones/fechas contra el uso en
  acciones y páginas.
  +- read_files
  |-- paths: [{"path":"prisma/schema.prisma"}]


[10s]  Processing your request... [ESC to stop]
[1A[1A  `--- [OK] Success
         [
           {
             "path": "prisma/schema.prisma",
             "content": "generator client {\n  ...


[10s]  Processing your request... [ESC to stop]
[1A[1A
[11s]  Processing your request... [ESC to stop]
[1A[1A
[12s]  Processing your request... [ESC to stop]
[1A[1A
[13s]  Processing your request... [ESC to stop]
[1A[1A
[14s]  Processing your request... [ESC to stop]
[1A[1A
[15s]  Processing your request... [ESC to stop]
[1A[1A
[16s]  Processing your request... [ESC to stop]
[1A[1A
[17s]  Processing your request... [ESC to stop]
[1A[1A
[18s]  Processing your request... [ESC to stop]
[1A[1A
[19s]  Processing your request... [ESC to stop]
[1A[1A
[20s]  Processing your request... [ESC to stop]
[1A[1A
[21s]  Processing your request... [ESC to stop]
[1A[1A
[22s]  Processing your request... [ESC to stop]
[1A[1A
[23s]  Processing your request... [ESC to stop]
[1A[1A
[24s]  Processing your request... [ESC to stop]
[1A[1A
[25s]  Processing your request... [ESC to stop]
[1A[1A
[26s]  Processing your request... [ESC to stop]
[1A[1A
[27s]  Processing your request... [ESC to stop]
[1A[1A
[28s]  Processing your request... [ESC to stop]
[1A[1A
[29s]  Processing your request... [ESC to stop]
[1A[1A
[30s]  Processing your request... [ESC to stop]
[1A[1A
[31s]  Processing your request... [ESC to stop]
[1A[1A
[32s]  Processing your request... [ESC to stop]
[1A[1A
[33s]  Processing your request... [ESC to stop]
[1A[1A
[34s]  Processing your request... [ESC to stop]
[1A[1A
[35s]  Processing your request... [ESC to stop]
[1A[1A
[36s]  Processing your request... [ESC to stop]
[1A[1A
[37s]  Processing your request... [ESC to stop]
[1A[1A
[38s]  Processing your request... [ESC to stop]
[1A[1A
[39s]  Processing your request... [ESC to stop]
[1A[1A
[40s]  Processing your request... [ESC to stop]
[1A[1A
[41s]  Processing your request... [ESC to stop]
[1A[1A
Qodo:
  ### 1) src/actions/appointment.actions.ts

  #### A. Fechas / UTC (riesgo alto de desfase)

      * **`createAppointment`**: convierte `scheduledAt` con `new
  Date(data.scheduledAt)` si viene string.
          * Si el string viene como `"2026-02-27T08:00"` (sin `Z`), **JS lo
  interpreta en horario local del servidor**, no UTC. Esto puede mover citas
  varias horas.
          * No se valida `scheduledDate` (ej. `Invalid Date`).
      * **`getAppointments(date)`**: arma rango del día en **UTC** usando:
          * `new Date(`${date}T00:00:00.000Z`)` y `...23:59:59.999Z`
          * Esto está “bien” si el significado de `date` es “día UTC”. Pero en
  UI el usuario elige un día **local**, así que podrías estar filtrando el día
  incorrecto para la clínica (si opera en zona horaria local).
      * **`checkInAppointment`**: `checkInDate: new Date()` usa hora del
  servidor (DateTime de Prisma guarda instante UTC, pero el “instante” depende
  del reloj/zone del server; normalmente OK). El problema real es la mezcla:
  citas creadas en local vs filtro en UTC.

  Recomendación: definir una política única:

      * o todo se interpreta como “hora local de la sucursal” y se convierte
  consistentemente a UTC al persistir,
      * o el sistema opera en UTC completo (UI debe mostrar/convertir
  explícitamente).

  #### B. Consistencia con Prisma (enums /
  relaciones)

      * **`updateAppointmentStatus`** acepta `status: string` y mete `//
  @ts-ignore`.
          * Prisma define `AppointmentStatus` enum: `SCHEDULED | CONFIRMED |
  CANCELLED | NO_SHOW | COMPLETED`.
          * Con string libre puedes guardar basura y romper invariantes lógicas
  (aunque Prisma normalmente validará si el campo es enum; el `ts-ignore` sólo
  evita el typecheck, pero runtime sí fallará si el valor no es válido).
      * **`checkInAppointment`**:
          * Crea `MedicalEvent.status = 'CHECKED_IN'` → **esto sí existe** en
  `EventStatus`.
          * Relación: en Prisma `MedicalEvent.appointmentId` es `@unique` (1:1
  real).
          * En `Appointment` hay `medicalEvents: MedicalEvent[]` (modelado como
  1:N). El código comenta “1:1 lógicamente”, pero el esquema fuerza 1:1 del lado
   de `MedicalEvent` por el `@unique`, así que está OK, sólo que la navegación
  desde Appointment sea array es confusa (pero funcional).

  #### C. Transacción / race conditions (riesgo
  medio-alto)

      * Bien: `checkInAppointment` usa `prisma.$transaction(async tx => ...)`
  para:
          1. leer cita y `medicalEvents`
          2. actualizar cita a `COMPLETED`
          3. crear `MedicalEvent`
      * **Race condition aún posible**: dos check-ins concurrentes pueden pasar
  el `length === 0` y competir.
          * La protección real es `appointmentId @unique` en `MedicalEvent`: el
  segundo `create` fallará con error de unique constraint.
          * **Pero**: ya actualizaste la cita a `COMPLETED` antes del `create`.
  Si el `create` falla por unique, la transacción revierte todo (bien). Si falla
   por otra cosa, también revierte (bien).
      * **Manejo de error**: no distingue error de unique constraint para
  devolver un mensaje claro (ahora caerá a “Error al procesar check-in” o el
  `.message` si viene).

  #### D. Auditoría fuera de transacción

      * `logAudit` está **fuera** de la transacción (comentado como decisión).
          * Consecuencia: puedes completar check-in pero fallar el log → sin
  rastro de auditoría.
          * Si auditoría es compliance, debería ir dentro; si es “best-effort”,
  entonces está bien pero habría que tolerar el fallo explícitamente (ahora si
  falla `logAudit`, la acción retorna error aunque el check-in ya se hizo).

  ----------------------------------------------

  ### 2) src/app/appointments/page.tsx

  #### A. Tipos/serialización de Date (bug
  frecuente)

      * Interfaz dice `scheduledAt: Date`, pero lo que llega desde server
  actions al cliente normalmente es **string** (Next/React serializa).
      * Luego haces `new Date(apt.scheduledAt)`; si ya es Date en runtime no
  pasa nada, pero si es string OK; el problema es el **typing engañoso** que
  oculta errores.
      * Agrupación por hora:    const hour = new
  Date(apt.scheduledAt).getHours()
        `getHours()` usa timezone local del navegador. Si `scheduledAt` fue
  guardado/interpretado distinto (UTC vs local), se agrupará en hora incorrecta.

  #### B. Fecha seleccionada por defecto (UTC vs
  local)

      * `new Date().toISOString().split('T')[0]` produce “fecha UTC”.
          * En zonas negativas, por la tarde/noche puede ser “mañana” UTC →
  cargas el día incorrecto.
          * Esto es un bug UX clásico.

  #### C. Manejo de errores en handleCheckIn

      * Si `checkInAppointment` falla, no se muestra error ni se hace rollback
  visual; sólo se quita el spinner:    const res = await checkInAppointment(id)
            if (res.success) { ... }
            setCheckingIn(null)
        Falta `else setError(res.error...)` o notificación.

  #### D. Race/consistencia UI

      * `loadData()` se llama tras check-in y también navegas a `/events/${id}`.
   Si `loadData` tarda, igual navegas; no es grave pero es trabajo extra.
      * No hay cancelación de requests si el usuario cambia de fecha rápido
  (puede causar “stale state”: respuesta vieja pisa la nueva).

  ----------------------------------------------

  ### 3) src/app/reception/page.tsx

  #### A. Imports inconsistentes / potenciales
  errores

      * Importa `getEventsKanban, updateEventStatus` pero también
  `revalidatePath` en un Server Component y lo usa dentro de un `<form
  action={async ()=>...}>`.
          * Esto es válido, pero **redundante** si `updateEventStatus` ya
  revalida o si la página es `force-dynamic`.
      * `getWorkers()` usado para modal: asume que devuelve lista directamente.
  En otros actions del repo a veces devuelven `{success,...}`; si aquí cambia,
  se rompe. (No puedo confirmarlo sin abrir `worker.actions.ts`.)

  #### B. Esquema Prisma / enums

      * `nextStatus` se pasa como `'IN_PROGRESS' | 'VALIDATING'` que coincide
  con `EventStatus` enum.
      * No se maneja error de `updateEventStatus` en el action inline: si falla,
   el usuario no ve nada.

  ----------------------------------------------

  ### 4) src/components/AppointmentFormModal.tsx

  #### A. Race conditions / carga de catálogos

      * En `useEffect` cuando abre:    getWorkers().then(setWorkers)
            getBranches().then(setBranches)
        Si el modal se cierra antes de que resuelvan, puedes setear state en un
  componente “cerrado” (React lo tolera pero es warning potencial). No hay
  abort/cancel.
      * `handleSubmit` busca worker desde `workers` (bien, evita depender de
  `selectedWorker`), pero si `workers` aún no cargó y el usuario logra enviar
  (poco probable pero posible), fallará con “no tiene empresa”.

  #### B. Fecha/hora (riesgo alto)

      * Construye:    const scheduledAt = new Date(`${date}T${time}:00`)
        Eso se interpreta en **zona local


[41s]  Processing your request... [ESC to stop]
[1A[1A
[42s]  Processing your request... [ESC to stop]
[1A[1A
[43s]  Processing your request... [ESC to stop]
[1A[1A
[44s]  Processing your request... [ESC to stop]
[1A[1A
[45s]  Processing your request... [ESC to stop]
[1A[1A
[46s]  Processing your request... [ESC to stop]
[1A[1A
[47s]  Processing your request... [ESC to stop]
[1A[1A
Qodo:
  Leer archivos solicitados para auditoría de
  lógica, errores y consistencia con
  Prisma/fechas UTC.
  +- read_files
  |--paths:["frontend/src/actions/appointment.actions.ts","frontend/src/app/appointments/pa
           ge.tsx","frontend...


[47s]  Processing your request... [ESC to stop]
[1A[1A  `--- [OK] Success
         [
           {
             "path": "frontend/src/actions/appointment.actions.ts",
             "error": "E...


[47s]  Processing your request... [ESC to stop]
[1A[1A
[48s]  Processing your request... [ESC to stop]
[1A[1A
[49s]  Processing your request... [ESC to stop]
[1A[1A
[50s]  Processing your request... [ESC to stop]
[1A[1A
[51s]  Processing your request... [ESC to stop]
[1A[1A
[52s]  Processing your request... [ESC to stop]
[1A[1A
[53s]  Processing your request... [ESC to stop]
[1A[1A
[54s]  Processing your request... [ESC to stop]
[1A[1A
[55s]  Processing your request... [ESC to stop]
[1A[1A
[56s]  Processing your request... [ESC to stop]
[1A[1A
[57s]  Processing your request... [ESC to stop]
[1A[1A
[58s]  Processing your request... [ESC to stop]
[1A[1A
[59s]  Processing your request... [ESC to stop]
[1A[1A
[1m]  Processing your request... [ESC to stop]
[1A[1A
[1m 1s]  Processing your request... [ESC to stop]
[1A[1A
[1m 2s]  Processing your request... [ESC to stop]
[1A[1A
[1m 3s]  Processing your request... [ESC to stop]
[1A[1A
[1m 4s]  Processing your request... [ESC to stop]
[1A[1A
[1m 5s]  Processing your request... [ESC to stop]
[1A[1A
[1m 6s]  Processing your request... [ESC to stop]
[1A[1A
[1m 7s]  Processing your request... [ESC to stop]
[1A[1A
[1m 8s]  Processing your request... [ESC to stop]
[1A[1A
[1m 9s]  Processing your request... [ESC to stop]
[1A[1A
[1m 10s]  Processing your request... [ESC to stop]
[1A[1A
[1m 11s]  Processing your request... [ESC to stop]
[1A[1A
[1m 12s]  Processing your request... [ESC to stop]
[1A[1A
[1m 13s]  Processing your request... [ESC to stop]
[1A[1A
[1m 14s]  Processing your request... [ESC to stop]
[1A[1A
[1m 15s]  Processing your request... [ESC to stop]
[1A[1A
[1m 16s]  Processing your request... [ESC to stop]
[1A[1A
[1m 17s]  Processing your request... [ESC to stop]
[1A[1A
[1m 18s]  Processing your request... [ESC to stop]
[1A[1A
[1m 19s]  Processing your request... [ESC to stop]
[1A[1A
Qodo:
  No existe el prefijo frontend/ dentro del cwd
  que indicaste (tu root ya es .../frontend). Los
  archivos están en src/.... Con permisos solo
  lectura (r), hice la auditoría sobre:

      * `src/actions/appointment.actions.ts`
      * `src/app/appointments/page.tsx`
      * `src/app/reception/page.tsx`
      * `src/components/AppointmentFormModal.tsx`
        y contrasté contra `prisma/schema.prisma`.

  A continuación, hallazgos por archivo (lógica,
  race conditions, errores, consistencia Prisma y
  fechas UTC).

  ----------------------------------------------

  ## 1) src/actions/appointment.actions.ts

  ### A) Fechas / UTC: inconsistencias (riesgo
  alto)

  createAppointment

      * `scheduledAt` se convierte con `new Date(data.scheduledAt)` si es
  string.
          * Si el string llega sin `Z` (p.ej. `"2026-02-27T08:00"`), **JS lo
  interpreta como hora local del servidor**, no UTC.
          * No hay validación de `Invalid Date`.
      * La UI (`AppointmentFormModal`) genera `new Date(`${date}T${time}:00`)`
  (hora local del navegador). Al enviarse al server action puede serializarse a
  string/ISO y terminar interpretándose distinto.

  getAppointments(date)

      * El filtro por día construye rango **UTC fijo**:
          * `startOfDay = new Date(`${date}T00:00:00.000Z`)`
          * `endOfDay = new Date(`${date}T23:59:59.999Z`)`
      * Esto solo es correcto si `date` representa “día UTC”. En la práctica, el
   `<input type="date">` representa un día **en zona local de la
  clínica/usuario**. Resultado típico: citas “se van” al día anterior/siguiente
  cerca de medianoche según timezone.

  Impacto: creación (local) + consulta (UTC) +
  visualización (local) → desfases, filtros que
  “pierden” citas y agrupación por hora
  incorrecta.

  ### B) Enums Prisma y ts-ignore (riesgo medio)

  updateAppointmentStatus

      * Firma `status: string` + `// @ts-ignore`.
      * Prisma define `AppointmentStatus` enum
  (`SCHEDULED|CONFIRMED|CANCELLED|NO_SHOW|COMPLETED`).
      * Con string libre:
          * Type-safety perdida.
          * En runtime Prisma rechazará valores inválidos (error), pero el
  código no distingue errores de validación para dar feedback claro.

  ### C) Transacción en check-in: bien, pero
  falta “error mapping” (riesgo medio)

  checkInAppointment

      * Bien: usa `prisma.$transaction` para atomicidad:
          1. leer cita + medicalEvents
          2. update appointment → `COMPLETED`
          3. create medicalEvent con `appointmentId`
      * **Carrera concurrente**: dos check-ins simultáneos pueden pasar el check
   `medicalEvents.length === 0`.
          * La protección real es `MedicalEvent.appointmentId @unique` (en
  schema). El segundo create fallará y la transacción revierte: correcto.
          * Pero el usuario recibirá un error genérico; convendría traducir el
  error de constraint a “ya fue registrada”.

  ### D) Auditoría fuera de transacción (riesgo
  medio-alto según compliance)

      * `logAudit` se ejecuta **después** de la transacción.
      * Si el check-in se completó y luego falla `logAudit`, el método retorna
  `{success:false}` aunque la operación ya ocurrió o, peor, quedas sin
  auditoría.
      * Si auditoría es “best-effort”, deberían atraparse fallos de log para no
  convertir un éxito en error; si es “must-have”, entonces debe ir dentro de la
  transacción (con el costo de que si falla auditoría, se revierte el check-in).

  ### E) Esquema Prisma: relación
  Appointment–MedicalEvent

      * En `MedicalEvent`: `appointmentId String? @unique` (1:1).
      * En `Appointment`: `medicalEvents MedicalEvent[]` (1:N desde ese lado).
      * El código lo trata como array (“lógicamente 1:1”). Funciona, pero es
  **inconsistente** y propenso a confusión/malos supuestos.

  ----------------------------------------------

  ## 2) src/app/appointments/page.tsx (Client
  Component)

  ### A) Bug de “hoy” por usar UTC (riesgo alto)

      * Estado inicial:    new Date().toISOString().split('T')[0]
        Eso calcula la fecha “de hoy” en **UTC**, no la fecha local. En
  timezones negativos, por la tarde puede mostrar “mañana”, y filtrar el día
  incorrecto.

  ### B) scheduledAt tipado como Date pero llega
  serializado (riesgo medio)

      * Interfaz declara `scheduledAt: Date`, pero desde server actions
  normalmente llega como **string** serializada.
      * Se usa `new Date(apt.scheduledAt)` en varios lugares: funcionará si es
  string ISO, pero el typing incorrecto oculta errores y facilita bugs.

  ### C) Agrupación por hora depende de timezone
  del navegador (riesgo medio)

      * `getHours()` agrupa por hora local del cliente:    new
  Date(apt.scheduledAt).getHours()
      * Si el almacenamiento/filtro está en UTC, la UI agrupa en otra hora.

  ### D) Manejo de error faltante en check-in
  (riesgo medio)

      * `handleCheckIn` no muestra error si `checkInAppointment` falla.
      * Tampoco hay protección contra doble click salvo `checkingIn` por id
  (bien), pero falta feedback.

  ### E) Posible “stale state” en loadData
  (riesgo bajo-medio)

      * Si el usuario cambia `selectedDate` rápidamente, respuestas tardías
  podrían pisar estado con datos viejos (no hay cancelación/guardas).

  ----------------------------------------------

  ## 3) src/app/reception/page.tsx (Server
  Component)

  ### A) Manejo de errores inexistente en
  transición de estados (riesgo medio)

      * En el `<form action={async () => ...}>`:
          * se llama `updateEventStatus` y `revalidatePath('/reception')`
          * si `updateEventStatus` falla, no hay feedback; el usuario no sabe
  que no cambió.

  ### B) Importaciones y revalidación

      * `export const dynamic = 'force-dynamic'` ya fuerza refresco;
  `revalidatePath` puede ser redundante (no necesariamente incorrecto, pero
  revisar coherencia con cómo `updateEventStatus` revalida).

  ----------------------------------------------

  ## 4) src/components/AppointmentFormModal.tsx
  (Client Component)

  ### A) Creación de scheduledAt en hora local
  sin normalizar (riesgo alto)

      * Construye:    const scheduledAt = new Date(`${date}T${time}:00`)
        Esto es **zona local del navegador**.
      * Luego en server action podría re-interpretarse o guardarse como instante
   UTC; combinado con `getAppointments` (rango UTC) es la receta para “cita
  aparece en otro día”.

  ### B) Race / lifecycle al cargar catálogos
  (riesgo bajo-medio)

      * `getWorkers()` y `getBranches()` al abrir modal:
          * si cierras modal antes de resolver, puede haber setState innecesario
   (warning potencial).
          * no se maneja error de fetch (si falla, dropdowns vacíos sin
  mensaje).

  ### C) Manejo de error y UX (riesgo medio)

      * `createAppointment` falla → se muestra error: bien.
      * Pero si `result.success` es true, hace `router.refresh()` y muestra
  modal de éxito con datos; ok.
      * Mensaje de WhatsApp usa `new Date(apt.scheduledAt).toLocale...`: si
  `apt.scheduledAt` viene como string UTC y el usuario está en otra zona, la
  hora mostrada puede diferir (mismo problema de política de timezone).

  ----------------------------------------------

  # Problemas más críticos (prioridad)

      1. **Política de fechas incoherente** (local vs UTC) entre:
          * creación (`new Date(date+time)` local),
          2. persistencia (server action),
          3. consulta (`getAppointments` filtra por día UTC),
          4. UI (usa toISOString para “hoy” + agrupa por `getHours()` local).
      5. **Auditoría fuera de transacción** en check-in: puede reportar error
  tras éxito o perder trazabilidad.
      6. **Manejo de errores insuficiente en UI** (`handleCheckIn`, forms server
   actions en recepción).
      7. **Tipos engañosos en cliente** (`scheduledAt: Date`).

  ----------------------------------------------

  ## Recomendaciones concretas (sin cambiar
  código, solo auditoría)

      * Definir explícitamente timezone “oficial” (p.ej. `America/Mexico_City`)
  y:
          * guardar instantes en DB (Prisma DateTime) como UTC (normal),
          * pero al construir `scheduledAt` desde `date+time`, convertir desde
  TZ clínica a UTC de forma determinista (idealmente con `date-fns-tz` o luxon),
          * y filtrar por “día en TZ clínica”, no día UTC.
      * Cambiar la forma de obtener “hoy” en UI: no usar
  `toISOString().split('T')[0]` si el día es local.
      * Mapear errores de Prisma en `checkInAppointment` (unique constraint de
  `appointmentId`) a mensaje “ya tiene evento asociado”.
      * Decidir si `logAudit` debe:


[1m 19s]  Processing your request... [ESC to stop]
[1A[1A
[1m 20s]  Processing your request... [ESC to stop]
[1A[1A
