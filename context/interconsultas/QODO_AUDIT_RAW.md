# Reporte Raw Qodo CLI
  ## Auditoría frontend/src/actions/*

  ### admin.actions.ts

  #### Inyección de dependencias fallida /
  acoplamiento

      * **Acoplamiento directo a Prisma** (`import prisma from "@/lib/prisma"`):
   dificulta testeo y sustituir fuente de datos (no hay capa de servicio).
      * **Multi-tenant “implícito”**:
          * `getBranches()` usa `prisma.tenant.findFirst()` y si no existe
  retorna `[]`.
          * `createBranch()` crea un tenant `"Default Tenant"` si no existe.
          * Esto es un **fallback silencioso** y puede terminar asignando datos
  al tenant equivocado (fallo lógico de “inyección” de contexto/tenant).

  #### Nulos no manejados / validación
  insuficiente

      * `createCompany(formData)`:
          * `formData.get(...) as string` **no valida** `null`. Si falta un
  campo, se insertará `null`/`undefined` en runtime (dependiendo del motor) o
  fallará por constraints.
          * `price: Number(formData.get('price'))` puede producir `NaN` si viene
   `null`/string inválido.
          * Variable `plan` se lee pero no se usa (ruido / posible bug de
  requerimiento).
      * `createBranch(formData)`:
          * Mismo patrón `as string` sin validación
  (name/address/phone/managerName).

  #### Performance

      * `getCompanies()`, `getBranches()`, `getServices()` traen todos los
  registros sin paginación/limit.
      * `getBranches()` hace 2 queries (tenant + branches). Si el tenant se
  obtiene en muchos lugares, convendría resolverlo en una capa común (o por
  sesión) para evitar repetición.

  ----------------------------------------------

  ### company.actions.ts

  #### Inyección de dependencias fallida /
  acoplamiento

      * Buen patrón: delega a `@/services/company.service`.
      * **Riesgo**: no hay manejo de errores; si el service arroja excepción, la
   server action falla sin respuesta controlada (depende de cómo el caller lo
  maneje).

  #### Nulos no manejados / validación
  insuficiente

      * `updateCompany(id, data)` y `createCompany(data)` no validan:
          * `id` vacío
          * shape mínima de `data` (queda al service/DB).

  #### Performance

      * `getCompanies()` depende del service; aquí no se observa
  paginación/caching. Verificar en `company.service` si hay límites/filters.

  ----------------------------------------------

  ### event.actions.ts

  #### Inyección de dependencias fallida /
  acoplamiento

      * Acoplamiento directo a Prisma.
      * `createEvent()` selecciona branch con `findFirst()` (**branch
  “implícita”**) en vez de usar contexto/tenant/branch del usuario. Esto es un
  fallo típico de “inyección” de contexto (branch) y puede crear eventos en una
  sucursal incorrecta.

  #### Nulos no manejados / validación
  insuficiente

      * `createEvent(formData)`:
          * `workerId` se obtiene con `as string` sin validar `null`/vacío.
          * Si no hay branches lanza error (bien), pero el mensaje al usuario es
   genérico.
      * `getEventsKanban()`:
          * Agrupación ignora estados no contemplados: eventos con otro status
  quedan descartados silenciosamente (no van a ningún bucket).

  #### Performance

      * `getEventsKanban()`:
          * `findMany` con `include: { worker: true, branch: true }` trae
  objetos completos; puede ser pesado. Considerar `select` de campos usados en
  UI.
          * Sin paginación/limit: si crece la tabla, la carga será costosa (DB +
   transferencia + reduce en memoria).

  ----------------------------------------------

  ### medical-event.actions.ts

  #### Inyección de dependencias fallida /
  acoplamiento

      * Buen patrón: delega a `@/services/medical-event.service`.

  #### Nulos no manejados / validación
  insuficiente

      * `createEvent(data)`:
          * `revalidatePath(\`/workers/${data.worker.connect?.id}\`)` puede
  producir `/workers/undefined` si `connect` o `id` no existe (nulo no
  manejado).
      * `addStudy(eventId, serviceName, fileUrl?)`:
          * No valida `eventId`/`serviceName` vacíos.
      * `saveVerdict(eventId, diagnosis, validatorId)`:
          * No valida strings vacíos; `validatorId` inválido fallará en
  DB/service.
      * En general: sin `try/catch` para devolver errores controlados.

  #### Performance

      * `revalidatePath` se llama en cada mutación (esperable), pero cuidado con
   rutas calculadas con `undefined` (además de bug, puede disparar
  revalidaciones inútiles).

  ----------------------------------------------

  ### upload.actions.ts

  #### Inyección de dependencias fallida /
  acoplamiento

      * Acoplamiento directo a FS + Prisma + servicio externo (AI) dentro de una
   sola action.
      * `EventService` importado pero **no usado** (indicador de diseño
  incompleto / refactor pendiente).
      * Endpoint AI:
          * `process.env.PYTHON_API_URL || 'http://backend:8000'` (fallback
  rígido). Si el servicio no existe, se degrada con log pero continúa; puede ser
   esperado, pero es un “dependency injection” por env incompleto sin señal
  fuerte al usuario.

  #### Nulos no manejados / validación
  insuficiente

      * `const file = formData.get('file') as File`:
          * Si `formData.get('file')` no es `File` real (puede ser `string`),
  `arrayBuffer()` romperá.
      * `filename` usa `file.name` sin sanitización completa:
          * Solo reemplaza espacios; permite caracteres potencialmente
  problemáticos (e.g. `../`, `\`, `:`). Riesgo de path traversal/archivos
  inválidos según FS.
      * `uploadDir`:
          * Se define `../uploads` pero **no se asegura `mkdir`** (está
  comentado). Esto produce fallos en runtime según entorno.
      * `relativePath = /uploads/${filename}`:
          * Se envía al AI como `file_path` pero el archivo real se guarda en
  `../uploads`. Puede haber desalineación entre el path que espera el backend y
  la ubicación real.

  #### Performance

      * Carga completa del archivo en memoria:
          * `await file.arrayBuffer()` + `Buffer.from(bytes)` duplica memoria
  (ArrayBuffer + Buffer). Para archivos grandes es costoso.
      * Llamada `fetch` al AI es síncrona dentro de la action (bloquea
  respuesta).
      * `console.log` de resultados AI potencialmente grandes (`result`) puede
  afectar performance y logs.

  ----------------------------------------------

  ### worker.actions.ts

  #### Inyección de dependencias fallida /
  acoplamiento

      * Acoplamiento directo a Prisma.

  #### Nulos no manejados / validación
  insuficiente

      * `createWorker(formData)`:
          * `formData.get(...) as string` sin validación para
  firstName/lastName/etc.
          * `companyId: companyId || null` está bien para permitir null, pero no
   valida si el `companyId` existe (fallará por FK si aplica).
      * `getWorkers()`:
          * Si UI no necesita todo el worker, podría usar `select` para evitar
  campos innecesarios.

  #### Performance

      * `getWorkers()` sin paginación/limit; crecerá linealmente con la tabla.
      * `include.company.select.name` está bien (no trae toda la empresa).


[36s]  Processing your request... [ESC to stop]
[1A[1A
[37s]  Processing your request... [ESC to stop]
[1A[1A
