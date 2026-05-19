Tengo suficiente contexto. Voy a generar el dictamen completo.

---

# DICTAMEN TÉCNICO: Auditoría SPECs ARCH-20260519-11 y ARCH-20260519-12

- **ID:** FIX-20260519-06
- **Fecha:** 2026-05-19
- **Solicitante:** INTEGRA
- **Estado:** ✅ VALIDADO CON AJUSTES MENORES

---

## PARTE I — SPEC-12: Entidad Project (ARCH-20260519-12)

### Hallazgo 1 — 🔴 BLOQUEANTE: Relación inversa faltante en modelo `Branch`

**Descripción:** El modelo `Project` define `branch Branch? @relation(fields: [branchId], references: [id])`. Prisma exige que toda relación tenga su inversa declarada en el otro modelo. La sección "2.4 Modificaciones a modelos existentes" solo menciona `Company` y `Worker`, omitiendo completamente `Branch`.

**Riesgo:** `prisma migrate dev` fallará con error de validación de schema. La migración no se puede aplicar. Bloqueo total de implementación.

**Recomendación — corrección exacta:**
En la sección 2.4, agregar:

```diff
**`Branch`** — agregar relación inversa:
+```prisma
+projects  Project[]
+```
```

Y en la tabla de la sección 5:

| `frontend/prisma/schema.prisma` | Modificar | Agregar `Project`, `ProjectWorker`, `ProjectStatus`; actualizar `Company`, `Worker` **y `Branch`** |

---

### Hallazgo 2 — 🟡 MENOR: `@@map("project_status")` inconsistente con la convención del proyecto

**Descripción:** Los 7 enums existentes en el schema (`UserRole`, `GenderRestriction`, `EventTestStatus`, `EventStatus`, `AppointmentStatus`, `PrefilledStatus`, `TimelineEntryType`) no usan `@@map`. Agregar `@@map` solo en `ProjectStatus` introduce inconsistencia.

**Riesgo:** Bajo. Prisma lo acepta. Pero la inconsistencia puede confundir a futuros agentes que lean la convención del schema.

**Recomendación:** Eliminar el bloque `@@map("project_status")` del enum. El nombre de tabla `project_status` será generado automáticamente por Prisma con el mismo resultado práctico.

---

### Hallazgo 3 — 🟡 MENOR: Falta action `updateProject()`

**Descripción:** La sección 4.3 describe `ProjectFormModal.tsx` como "Modal de creación/**edición**", pero la sección 4.1 solo define `createProject` y `updateProjectStatus`. No existe ningún action que actualice nombre, fechas, `unitRef`, `branchId` o `notes` de un proyecto existente.

**Riesgo:** SOFIA llegará al `ProjectFormModal` en modo edición y no tendrá action qué llamar. Generará código ad-hoc inconsistente o dejará el botón "Guardar" roto en modo edición.

**Recomendación:** Agregar a la sección 4.1:

```typescript
export async function updateProject(
  projectId: string,
  data: Partial<CreateProjectInput>
): Promise<{ success: boolean; error?: string }>
```

O bien, aclarar explícitamente que el modal solo crea (no edita) en esta fase.

---

### Hallazgo 4 — 🟡 MENOR: Autorización de `getProjectsByCompany` / `createProject` sin especificar

**Descripción:** `getProjectsByCompany(companyId: string)` y `createProject({ companyId, ... })` no definen cómo verificar que el usuario autenticado tiene permisos sobre ese `companyId`. Para roles AMI (`ADMIN`, `RECEPTIONIST`) no es problema (acceso total), pero para un futuro `COMPANY_CLIENT` se convierte en vector de enumeración de proyectos de otras empresas.

**Riesgo:** Medio en el estado actual (solo staff interno), pero puede ser crítico si el portal B2B (SPEC futura) reutiliza estas actions.

**Recomendación:** Agregar nota explícita en la sección 4.1:

> "Las actions de esta SPEC son accesibles únicamente para roles `ADMIN` y `RECEPTIONIST`. Verificar con `getServerSession()` antes de cualquier query. El portal B2B requerirá filtrado adicional por `user.companyId`."

---

### Hallazgo 5 — ✅ ACEPTABLE: `unitRef String?` como texto libre

**Evaluación:** El riesgo es mínimo. Está validado por Zod con `max(100)`, es un campo interno solo visible para staff AMI, no se usa para lógica crítica, y la deuda técnica hacia Sprint 5 está explícitamente documentada. El enfoque "texto libre ahora, FK después" es el correcto para no bloquear SPEC-11.

---

### Hallazgo 6 — ✅ ACEPTABLE: `@@id([projectId, workerId])` en `ProjectWorker`

**Evaluación:** Sintaxis válida en Prisma para claves compuestas. Garantiza unicidad sin columna `id` adicional. Correcto para una tabla de unión con semántica "un trabajador una vez por proyecto".

---

### 🏁 VEREDICTO SPEC-12

**REQUIERE AJUSTES MENORES**

| # | Hallazgo | Severidad | Acción requerida |
|---|----------|-----------|-----------------|
| 1 | Relación inversa faltante en `Branch` | 🔴 BLOQUEANTE | Agregar `projects Project[]` a `Branch` en sección 2.4 y tabla 5 |
| 2 | `@@map` en enum inconsistente | 🟡 Menor | Eliminar `@@map("project_status")` |
| 3 | Falta `updateProject()` | 🟡 Menor | Agregar action o declarar fuera de alcance |
| 4 | Autorización sin especificar | 🟡 Menor | Agregar nota de roles en sección 4.1 |

**Aprobación condicional:** SOFIA puede iniciar con las correcciones 1 y 3 aplicadas. Las correcciones 2 y 4 son de documentación y pueden ir en el mismo PR.

---

## PARTE II — SPEC-11: Alta Masiva (ARCH-20260519-11)

### Hallazgo 1 — 🔴 BLOQUEANTE: Campo `gender` no existe en el modelo `Worker`

**Descripción:** `BulkWorkerRow` incluye `gender?: string`. En el `bulkImportWorkers`, el paso 4 ("crear trabajador") implica un `prisma.worker.create({ data: { ...row } })`. El modelo `Worker` actual en [frontend/prisma/schema.prisma](frontend/prisma/schema.prisma) **no tiene columna `gender`**. Comparar con `createWorker` existente: la función ya recibe `gender` para llamar `generateUniversalId({ firstName, lastName, dob, gender })` pero **no lo persiste en la DB**.

**Riesgo:** Si SOFIA intenta incluir `gender` en el payload de `prisma.worker.create`, Prisma lanzará un error de TypeScript en compilación (Gate 1). Si lo omite, la firma de `BulkWorkerRow` queda con un campo sin uso aparente que confunde.

**Recomendación:** Agregar nota explícita en la sección 6.1, paso 4:

> "`gender` NO se almacena en `Worker` (la columna no existe). Solo se usa para calcular `universalId` via `generateUniversalId({ firstName, lastName, dob, gender })`. El create de Prisma no debe incluirlo."

Si se decide en el futuro agregar `gender` al modelo `Worker`, requiere una SPEC separada con migración.

---

### Hallazgo 2 — 🔴 IMPORTANTE: Riesgo de timeout con 500 filas

**Descripción:** El modelo row-by-row con inserts independientes genera ~3 queries DB por fila (1× `findFirst` dedup + 1× `worker.create` + 1× `projectWorker.create`) = **1,500 queries** en el peor caso. Con latencia típica en Railway de 20–40ms por query, el tiempo total sería **30–60 segundos**. Las funciones serverless de Vercel tienen límite de 60s (plan Pro) o 10s (plan Hobby). Railway con `pnpm start` no tiene este límite, pero sí puede haber límite de request de Next.js.

**Riesgo:** Timeout intermitente en cargas grandes. Datos parcialmente importados sin notificación al usuario (la atomicidad parcial no avisa cuánto se completó antes del timeout).

**Recomendaciones (en orden de invasividad):**

**Opción A (mínima intervención):** Reducir el límite de 500 a **200 filas** en esta fase. La SPEC ya documenta que "500 es el límite operativo inicial" — bajarlo a 200 es coherente con una Fase 1 cautelosa.

**Opción B (si se mantiene 500):** Agrupar las queries de deduplicación en una sola:
```typescript
// En lugar de N × findFirst individuales:
const existingWorkers = await prisma.worker.findMany({
  where: {
    OR: rows.map(r => ({
      firstName: { equals: r.firstName, mode: 'insensitive' },
      lastName: { equals: r.lastName, mode: 'insensitive' }
    }))
  }
})
// Luego clasificar en memoria — reduce N queries a 1
```
Esto reduce 500 `findFirst` a 1 `findMany` con OR, bajando de 1,500 a ~1,001 queries.

**Recomendación final para la SPEC:** Cambiar el límite a 200 filas en la tabla de la sección 3 y en el Gate server-side de la sección 9.

---

### Hallazgo 3 — 🟠 IMPORTANTE: Verificación de autorización del `projectId` subespécificada

**Descripción:** La sección 6.1 dice correctamente que `companyId` se resuelve del proyecto (previene inyección de empresa). Sin embargo, el contrato técnico no especifica que el `projectId` mismo debe validarse contra el tenant/scope del usuario autenticado. Un usuario con sesión válida de la empresa A podría pasar un `projectId` perteneciente a la empresa B y crear trabajadores bajo esa empresa.

La sección 9 menciona "verificar sesión activa y permisos sobre companyId", pero el pseudocódigo del paso 1 en 6.1 solo muestra `findUnique` sin el check de sesión.

**Riesgo:** Para el canal interno (solo ADMIN/RECEPTIONIST AMI), el riesgo es bajo porque tienen acceso a todas las empresas. Sin embargo, cuando Fase 2 exponga esto en el portal B2B, el mismo action podría ser llamado por un `COMPANY_CLIENT` que pertenece a empresa A con un `projectId` de empresa B.

**Recomendación:** Agregar explícitamente en el paso 1 del pseudocódigo de 6.1:

```typescript
// 1a. Verificar sesión
const session = await getServerSession(authOptions)
if (!session) return { error: 'No autorizado', created: 0, ... }

// 1b. Resolver proyecto y validar que la empresa del proyecto es accesible para este usuario
const project = await prisma.project.findUnique({ 
  where: { id: projectId }, 
  include: { company: true } 
})
if (!project) return { error: 'Proyecto no encontrado', ... }

// 1c. Para COMPANY_CLIENT: verificar que project.companyId === session.user.companyId
if (session.user.role === 'COMPANY_CLIENT' && project.companyId !== session.user.companyId) {
  return { error: 'Acceso no autorizado a este proyecto', ... }
}
```

---

### Hallazgo 4 — 🟡 MENOR: Inconsistencia de criterios de deduplicación vs alta individual

**Descripción:** `createWorker` en [frontend/src/actions/worker.actions.ts](frontend/src/actions/worker.actions.ts#L55) hace `prisma.worker.findFirst` con `firstName + lastName + dob` de forma **global** (sin filtro de empresa). Si hay match en cualquier empresa, retorna `duplicate_found`. La SPEC-11 propone una matriz más sofisticada que distingue "misma empresa" de "empresa diferente" para clasificar en 🔴 vs 🟡.

**Implicación práctica:** Un trabajador con `nombre=Juan Pérez, dob=1990-01-01` ya registrado en Empresa B bloquea su alta en Empresa A vía formulario individual, pero en alta masiva solo genera un `warning` (🟡) que el admin puede ignorar. Los criterios de "es duplicado" son diferentes entre los dos canales.

**Riesgo:** Bajo. No hay riesgo de integridad de datos (el `universalId` es el mismo para la misma persona biológica, lo cual es correcto). La inconsistencia es de experiencia de usuario: el admin individual ve un hard block, el masivo ve un soft warning.

**Recomendación:** Agregar una nota en la sección 5B o 11 (Notas de Arquitectura):

> "La deduplicación del alta masiva es intencionalmente más permisiva que la del alta individual. El alta individual bloquea ante cualquier match nombre+DOB (independiente de empresa) para forzar al admin a tomar decisión. El masivo clasifica los cross-empresa como `warnings` para no detener operaciones de 200+ trabajadores. Esta asimetría es por diseño."

---

### Hallazgo 5 — 🟡 MENOR: Versión y configuración de `xlsx` sin especificar

**Descripción:** La SPEC indica `pnpm add xlsx` sin versión. La librería SheetJS Community Edition tiene un historial de vulnerabilidades en versiones `<0.18.5` (prototype pollution). Adicionalmente, sin la opción `{ cellDates: false }` en el parser, las celdas formateadas como fecha en Excel se convierten automáticamente a objetos `Date` en lugar de strings, rompiendo el formato esperado `DD/MM/AAAA`.

**Riesgo:** Bajo-moderado. Afecta parsing de fechas de nacimiento si el usuario tiene su Excel con columna D formateada como fecha (caso muy común en Excel generado por SAP/ADP).

**Recomendación:** En la sección 6.3 (BulkWorkerImportModal), especificar:

```typescript
// Instalar versión específica
// pnpm add xlsx@^0.18.5

// Al parsear:
const workbook = XLSX.read(fileBuffer, { 
  type: 'array',
  cellDates: false,  // Mantener fechas como strings DD/MM/AAAA
  raw: false         // Aplicar formato de celda
})
```

---

### Hallazgo 6 — 🟡 MENOR: Generación de plantilla `.xlsx` sin instrucción de creación

**Descripción:** La sección 8 incluye `frontend/public/templates/plantilla-trabajadores.xlsx` como archivo a "Crear". SOFIA no puede generar archivos `.xlsx` binarios. Sin instrucción explícita, SOFIA podría crear un archivo vacío, un `.csv` renombrado, o saltarse el criterio Gate 3 sobre la plantilla.

**Riesgo:** Gate 3 fallará en revisión ("La plantilla descargable tiene los 8 campos con ejemplo en fila 2").

**Recomendación:** Agregar a la sección 12 (Handoff) un paso explícito:

> "Para generar la plantilla: ejecutar el script `scripts/generate-template.js` con `xlsx@^0.18.5` que crea el archivo con encabezados y una fila de ejemplo precargada. SOFIA debe crear este script como parte de la implementación."

O bien, proporcionar el script directamente en el handoff.

---

### Hallazgo 7 — ✅ ACEPTABLE: Decisión de omitir 🟡 posibles duplicados por defecto

**Evaluación:** La decisión de no importar automáticamente los amarillos y requerir revisión manual es correcta. Importarlos automáticamente podría crear duplicados en el sistema y es más difícil de revertir. La UX de "ver lista de posibles duplicados" después de la importación es el patrón estándar de herramientas de ETL.

---

### Hallazgo 8 — ✅ ACEPTABLE: Seguridad del parseo client-side con `xlsx`

**Evaluación:** El flujo "archivo crudo nunca llega al servidor, solo JSON normalizado" es la arquitectura correcta. Reduce la superficie de ataque a:
- Un parser de terceros corriendo en el navegador del propio usuario (entorno confiable)
- El JSON que llega al server action pasa por validación Zod fila por fila

Los controles adicionales (límite 2MB en cliente, 500 filas en servidor) son apropiados. El único riesgo residual es la versión de `xlsx` (ver Hallazgo 5).

---

### 🏁 VEREDICTO SPEC-11

**REQUIERE AJUSTES MENORES**

| # | Hallazgo | Severidad | Acción requerida |
|---|----------|-----------|-----------------|
| 1 | `gender` no existe en `Worker` | 🔴 BLOQUEANTE | Aclarar en 6.1 que `gender` solo va a `generateUniversalId`, no se persiste |
| 2 | Timeout con 500 filas | 🔴 IMPORTANTE | Reducir a 200 filas O implementar `findMany` con OR para dedup en batch |
| 3 | Autorización de `projectId` subespecificada | 🟠 IMPORTANTE | Agregar pseudocódigo de verificación de sesión en paso 1 de 6.1 |
| 4 | Inconsistencia de deduplicación | 🟡 Menor | Agregar nota arquitectural "asimetría por diseño" |
| 5 | `xlsx` sin versión ni `cellDates: false` | 🟡 Menor | Especificar `xlsx@^0.18.5` + opción de parseo |
| 6 | Plantilla `.xlsx` sin script de generación | 🟡 Menor | Agregar script o instrucción en sección 12 |

---

## PARTE III — Análisis de Dependencia entre SPECs

### D.1 Orden de implementación

El orden SPEC-12 → SPEC-11 es **obligatorio**. No hay nada paralelizable porque:

- SPEC-11 requiere `prisma.projectWorker.create` (definido en SPEC-12, inexistente hasta que migre)
- SPEC-11 requiere `getProjectsByCompany()` (definido en `project.actions.ts` de SPEC-12)
- El dropdown de proyectos en el modal de SPEC-11 carga datos creados por SPEC-12

Lo que SÍ puede paralelizarse es el **componente UI** `BulkWorkerImportModal.tsx` (SPEC-11) si se mockeamos el selector de proyectos, pero no tiene valor práctico dado el acoplamiento.

### D.2 Ambigüedades que bloquearían a SOFIA

| Ambigüedad | Riesgo de bloqueo | Resolución |
|-----------|-------------------|------------|
| `gender` en `BulkWorkerRow` vs schema `Worker` | **ALTO** — Falla de compilación | Hallazgo 1 SPEC-11: aclarar que no se persiste |
| Relación inversa `Branch.projects` faltante | **ALTO** — Falla `prisma migrate dev` | Hallazgo 1 SPEC-12: agregar a sección 2.4 |
| Falta `updateProject()` | **MEDIO** — Modal de edición sin action | Hallazgo 3 SPEC-12: agregar o excluir explícitamente |
| Cómo generar la plantilla `.xlsx` | **MEDIO** — Gate 3 bloqueado | Hallazgo 6 SPEC-11: agregar instrucción |

---

## Instrucciones de Handoff para INTEGRA

1. **Aplicar ajustes críticos** (SPEC-12 Hall.1, SPEC-11 Hall.1 y Hall.2) antes de pasar las SPECs a SOFIA. Son los únicos que garantizan compilación exitosa.

2. **Correcciones recomendadas** (Hall. 🟡 en ambas SPECs): pueden incluirse en el mismo commit de ajuste o delegarse al handoff de SOFIA con nota explícita.

3. **Orden de implementación para SOFIA:**
   - Paso 1: Migración Prisma (SPEC-12) → `prisma migrate dev`
   - Paso 2: `project.actions.ts` con todas las actions (incluyendo `updateProject`)
   - Paso 3: `projects/page.tsx` + `ProjectFormModal.tsx`
   - Paso 4: `bulkImportWorkers()` server action (sin UI, testeable directo con curl/Postman)
   - Paso 5: `BulkWorkerImportModal.tsx` + integración en `workers/page.tsx`
   - Paso 6: Script de generación de plantilla + archivo resultante

4. **Prerrequisito para Fase 2 (portal B2B):** El Hallazgo 3 de SPEC-11 (autorización de sesión) debe estar resuelto antes de exponer `bulkImportWorkers` en el portal. Si se implementa ahora con el check de `COMPANY_CLIENT`, la Fase 2 es solo una cuestión de enrutamiento.

---

*Generado por DEBY — FIX-20260519-06 — 2026-05-19*  
*Ref: SPEC_ARCH-20260519-12 · SPEC_ARCH-20260519-11 · schema.prisma · worker.actions.ts*