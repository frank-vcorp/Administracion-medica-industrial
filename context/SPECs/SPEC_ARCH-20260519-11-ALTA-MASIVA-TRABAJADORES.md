# SPEC: Alta Masiva de Trabajadores por Empresa (Pre-registro)

**ID:** ARCH-20260519-11  
**Fecha:** 2026-05-19  
**Estado:** APROBADO CON AJUSTES — Dictamen FIX-20260519-06 aplicado (2026-05-19)  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta  
**Depende de:** SPEC-12 (ARCH-20260519-12) — entidad `Project` debe existir en DB antes de implementar esta SPEC  
**Puntaje INTEGRA:** (3×3) + (3×2) - (2×0.5) = 9 + 6 - 1 = **14**  
*(Valor=3: desbloquea operaciones masivas | Urgencia=3: bloquea unidades móviles y visitas corporativas | Complejidad=2: Excel parse + bulk insert con deduplicación + vínculo a Project)*

---

## 1. Contexto y Problema

### Escenario de negocio
AMI opera en dos modalidades que generan un volumen alto de trabajadores a registrar en un solo momento:

1. **Unidad Móvil en Planta** — Una empresa solicita que AMI visite sus instalaciones. Los trabajadores están ahí, muchos sin registro previo. La operación no puede detenerse para registrar uno a uno.
2. **Visita Masiva a Sucursal** — Una empresa agenda que X trabajadores acudan a la sucursal AMI en un bloque. Requieren pre-registro antes del día de la visita.

### Dos canales de ingreso

| Canal | Actor | Superficie |
|-------|-------|------------|
| **Vendedor / Admin AMI** | El vendedor recibe un Excel de la empresa y lo sube en el panel interno de AMI | `/workers` (panel interno) |
| **Empresa en su portal** | El usuario B2B de la empresa sube el Excel directamente desde su cuenta | `/portal/workers` (portal B2B) |

### Estado actual
- Solo existe alta **individual** mediante `WorkerFormModal`
- No hay mecanismo de carga masiva en ninguno de los dos paneles
- La detección de duplicados (`createWorker`) ya existe y debe reutilizarse

---

## 2. Decisión de Diseño

### ¿Por qué Excel y no formulario individual?
- Las empresas ya tienen sus nóminas en Excel (SAP, ADP, sistemas HR internos)
- Requiere cero aprendizaje del actor que prepara el archivo
- Es la herramienta de menor fricción en el segmento industrial mexicano
- Alternativa CSV también se acepta (misma plantilla, extensión distinta)

### Principio de simplicidad
> "No inventamos nada nuevo: plantilla descargable → upload → vista previa → confirmar."

### Decisión de fases

**Fase 1 (esta SPEC):** Canal interno — vendedor/admin sube el Excel en `/workers`.  
**Fase 2 (SPEC separada):** Canal portal B2B — empresa sube en `/portal/workers`. Depende de madurez del portal. No se implementa aquí.

**Justificación:** El portal B2B hoy es de solo lectura y no está completamente documentado. Construir primero el motor interno permite validar la lógica y luego exponerla en el portal con una server action compartida.

---

## 3. Plantilla Excel (Contrato de Datos)

### Archivo a proveer
**Nombre:** `plantilla-trabajadores.xlsx`  
**Ubicación:** `frontend/public/templates/plantilla-trabajadores.xlsx`  
**Idioma:** Español, sin tecnicismos

### Columnas de la plantilla

| Col | Nombre en Excel | Campo interno | Tipo | Requerido | Validación |
|-----|----------------|---------------|------|-----------|------------|
| A | **Nombre(s)** | `firstName` | texto | **Sí** | No vacío, max 100 chars |
| B | **Apellido(s)** | `lastName` | texto | **Sí** | No vacío, max 100 chars |
| C | CURP o ID Nacional | `nationalId` | texto | No | max 18 chars |
| D | Fecha de Nacimiento | `dob` | DD/MM/AAAA | No | Fecha válida |
| E | Género | `gender` | M / F | No | Solo "M" o "F" |
| F | Correo Electrónico | `email` | email | No | Formato email si presente |
| G | Teléfono | `phone` | texto | No | max 15 chars |
| H | Puesto | `jobPositionName` | texto | No | Match por nombre contra `JobPosition.name` de la empresa (case-insensitive) |

### Reglas de la plantilla
- La fila 1 es encabezado fijo (no modificar)
- A partir de la fila 2: datos de trabajadores
- Máximo **200 filas** por carga (límite operativo Fase 1 — ver nota de rendimiento en sección 9)
- Las celdas vacías opcionales se ignoran silenciosamente
- El campo `Puesto` se resuelve por nombre exacto (case-insensitive) contra los puestos existentes de la empresa. Si no coincide, se omite el puesto sin error bloqueante.

---

## 4. Flujo de Usuario (Panel Interno `/workers`)

```
[Botón "Carga Masiva"]
        │
        ▼
[Modal — Paso 1: Seleccionar Proyecto]
  ├─ Dropdown de proyectos existentes (filtrado por empresa)
  ├─ Botón "+ Nuevo Proyecto" → abre ProjectFormModal inline
  └─ El companyId se deriva del proyecto seleccionado (no se elige empresa por separado)
        │
        ▼
[Modal — Paso 2: Subir Excel]
[Descargar Plantilla] + [Subir archivo .xlsx / .csv]
        │
        ▼
[Parse client-side con 'xlsx']
        │
        ▼
[Vista Previa: tabla con filas coloreadas]
  ┌─ 🟢 Verde: Válida, lista para crear
  ├─ 🟡 Amarillo: Advertencia — posible duplicado (mismo nombre+apellido) 
  └─ 🔴 Rojo: Error — falta nombre, formato incorrecto
        │
        ▼
[Botón "Importar N trabajadores válidos"]
        │ (solo las filas 🟢 se envían al servidor)
        ▼
[Server Action: bulkImportWorkers()]
        │ (las 🟡 ya fueron clasificadas en cliente y no se envían)
        ▼
[Resumen de resultado]
  ┌─ ✅ X creados
  ├─ ⚠️ Y duplicados exactos omitidos
  ├─ 🔍 Z posibles duplicados — requieren revisión manual (listado visible)
  └─ ❌ W errores de formato
        │
        ▼
[revalidatePath('/workers') — tabla actualizada]
```

---

## 5. Escenarios de Borde (Decisiones de Arquitectura)

### 5A. El proyecto NO está creado todavía

**Pregunta:** ¿Qué pasa si el vendedor quiere hacer la carga masiva pero el proyecto aún no existe?

**Decisión:** El proyecto **debe existir o crearse en ese momento**. El modal expone un botón "+ Nuevo Proyecto" en el mismo paso 1, que abre `ProjectFormModal` inline sin salir del flujo.

**Justificación:** A diferencia de la empresa (que tiene datos complejos de RFC, contratos, etc.), un proyecto es rápido de crear: nombre, empresa, fechas y opcionalmente unidad. Es razonable crearlo en el momento sin salir del modal.

**Flujo cuando no hay proyectos disponibles:**
```
[Modal — Paso 1: Seleccionar Proyecto]
        │
        ▼ (dropdown vacío — empresa sin proyectos)
[Estado vacío con botón]
"No hay proyectos para esta empresa todavía."
[+ Crear Proyecto] → abre ProjectFormModal → al guardar, vuelve al dropdown con el nuevo proyecto preseleccionado
```

**La empresa sí debe existir:** si la empresa no existe, primero hay que crearla en `/companies`. El proyecto no crea empresas al vuelo.

---

### 5B. La empresa YA existe con trabajadores registrados individualmente

**Pregunta:** Una empresa tiene 10 trabajadores dados de alta uno por uno. Ahora suben un Excel con 30 trabajadores, algunos de los cuales ya están en el sistema. ¿Qué pasa?

**Respuesta:** Es el caso más común en producción. El motor de deduplicación clasifica cada fila del Excel en una de tres categorías antes de crear cualquier registro:

#### Matriz de Clasificación por Fila

| Escenario | ¿Nombre coincide? | ¿DOB disponible en ambos lados? | ¿DOB coincide? | ¿Misma empresa? | Clasificación | Acción |
|-----------|-------------------|---------------------------------|----------------|-----------------|---------------|--------|
| Duplicado exacto | ✅ | ✅ Ambos tienen | ✅ | ✅ | 🔴 **Duplicado duro** | Omitir, reportar |
| Mismo nombre, misma empresa, sin DOB para comparar | ✅ | ❌ Uno o ambos sin DOB | N/A | ✅ | 🟡 **Posible duplicado** | Omitir por defecto, listar para revisión manual |
| Mismo nombre, empresa diferente, mismo DOB | ✅ | ✅ | ✅ | ❌ | 🟡 **Misma persona, empresa distinta** | Omitir por defecto — ¿transferencia o coincidencia? El admin decide |
| Mismo nombre, DOB diferente (ambos tienen DOB) | ✅ | ✅ | ❌ | Cualquiera | 🟢 **Persona distinta** | Crear normalmente |
| Sin coincidencia de nombre | ❌ | Cualquiera | Cualquiera | Cualquiera | 🟢 **Trabajador nuevo** | Crear normalmente |
| Error de validación (sin nombre) | N/A | N/A | N/A | N/A | 🔴 **Error de formato** | Reportar, omitir |

**Regla importante sobre los 🟡 amarillos:**
- Los amarillos **NO se importan automáticamente**
- Se reportan en un listado separado en el resultado final: "X trabajadores requieren revisión manual"
- El admin puede ver la fila del Excel vs el trabajador existente y decidir caso por caso en el módulo individual
- El resumen final incluye botón "Ver lista de posibles duplicados"

**¿Por qué no dejar que el admin decida en la vista previa?**  
Porque en una carga de 200+ trabajadores, revisar cada amarillo uno a uno en el modal sería peor experiencia que resolver el puñado de casos en el módulo individual. La carga masiva prioriza velocidad; la resolución de ambigüedades es siempre tarea de revisión puntual.

---

### 5C. Caso mixto (el más común en producción)

**Pregunta:** Excel con 30 filas: 20 son nuevos, 5 son duplicados exactos (misma empresa, mismo nombre y DOB), 3 son posibles duplicados (mismo nombre, sin DOB), 2 tienen errores de formato.

**Resultado esperado:**
```
✅ 20 creados correctamente
⚠️  5 omitidos — duplicados exactos (ya existen en la empresa)
🔍  3 requieren revisión manual (posibles duplicados — sin DOB para confirmar)
❌  2 errores de formato (fila 7: falta nombre; fila 19: fecha inválida "31/13/2000")
```

**Garantía de atomicidad parcial:**  
La transacción NO es all-or-nothing. Si falla una fila por error de DB inesperado, las otras filas válidas YA procesadas se preservan. Cada fila es un insert independiente dentro del loop. Solo se usa `prisma.$transaction` para el `AuditLog` final, no para los inserts individuales (lo contrario bloquearía todo ante un error de una sola fila).

---

## 6. Contratos Técnicos

### 6.1 Server Action: `bulkImportWorkers`

**Archivo:** `frontend/src/actions/worker.actions.ts`

```typescript
// Firma esperada
export async function bulkImportWorkers(
  rows: BulkWorkerRow[],
  projectId: string    // ← reemplaza companyId; el companyId se resuelve desde el proyecto
): Promise<BulkImportResult>

// Tipos
interface BulkWorkerRow {
  firstName: string
  lastName: string
  nationalId?: string
  dob?: string           // ISO o DD/MM/AAAA — se normaliza internamente
  gender?: string        // IMPORTANTE: solo se usa para generateUniversalId(). NO existe columna gender en Worker.
                         // No incluir en el payload de prisma.worker.create()
  email?: string
  phone?: string
  jobPositionName?: string
  _rowIndex: number      // Para trazabilidad en errores
}

interface BulkImportResult {
  created: number
  // Duplicados duros (🔴): nombre+DOB+empresa coinciden — omitidos silenciosamente
  duplicates: { rowIndex: number; firstName: string; lastName: string; existingId: string; existingUniversalId: string }[]
  // Posibles duplicados (🟡): nombre coincide pero DOB ambiguo o empresa diferente — requieren revisión manual
  warnings: { rowIndex: number; firstName: string; lastName: string; reason: string; existingId: string }[]
  // Errores de formato (🔴): falta nombre, fecha inválida, etc.
  errors: { rowIndex: number; firstName?: string; lastName?: string; reason: string }[]
}
```

**Comportamiento (por fila, en orden):**
1. Verifica sesión activa:
   ```typescript
   const session = await getServerSession(authOptions)
   if (!session) return { error: 'No autorizado', created: 0, duplicates: [], warnings: [], errors: [] }
   ```
2. Resuelve y valida el proyecto:
   ```typescript
   const project = await prisma.project.findUnique({ where: { id: projectId }, include: { company: true } })
   if (!project) return { error: 'Proyecto no encontrado', ... }
   // Para COMPANY_CLIENT (portal B2B Fase 2):
   if (session.user.role === 'COMPANY_CLIENT' && project.companyId !== session.user.companyId) {
     return { error: 'Acceso no autorizado a este proyecto', ... }
   }
   ```
   El `companyId` se obtiene de `project.companyId`, **nunca del cliente**
3. Valida schema Zod de la fila — si falla, anota en `errors` y continúa
3. Busca en DB: `firstName + lastName` case-insensitive en cualquier empresa
4. **Si no hay coincidencia de nombre** → 🟢 crear trabajador (recordar: `gender` solo a `generateUniversalId`, no a `prisma.worker.create`)
5. **Si hay coincidencia por nombre:**
   - Ambos tienen DOB y DOB coincide y misma empresa → 🔴 `duplicates` (omitir)
   - Ambos tienen DOB y DOB coincide y distinta empresa → 🟡 `warnings` (omitir, avisar)
   - Alguno sin DOB y misma empresa → 🟡 `warnings` (omitir, revisar manualmente)
   - Alguno sin DOB y distinta empresa → 🟡 `warnings` (omitir, revisar manualmente)
   - Ambos tienen DOB y DOB **no** coincide → 🟢 persona distinta, crear
6. Por cada worker creado exitosamente: crear registro `ProjectWorker { projectId, workerId, addedBy: session.userId }`
7. Inserts son independientes (no transacción global) — fallo en uno no bloquea los demás
8. Al finalizar el loop: registra `AuditLog` con resumen (created, duplicates.length, warnings.length, errors.length, projectId)

### 6.2 Validación server-side (Zod)

```typescript
const BulkWorkerRowSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  nationalId: z.string().max(18).optional(),
  dob: z.string().optional(),  // Normalizado a Date en el action
  gender: z.enum(['M', 'F']).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(15).optional(),
  jobPositionName: z.string().optional(),
  _rowIndex: z.number(),
})
```

### 6.3 Nuevo componente: `BulkWorkerImportModal`

**Archivo:** `frontend/src/components/BulkWorkerImportModal.tsx`

**Responsabilidades:**
- Renderizar el modal multi-paso (Empresa → Upload → Preview → Resultado)
- Parsear el archivo con la librería `xlsx` (client-side, no llega a servidor el archivo crudo)
- Mostrar la tabla de preview con colores por estado
- Llamar a `bulkImportWorkers()` al confirmar
- Mostrar el resumen del resultado

**Dependencia externa:**
- Librería: `xlsx@^0.18.5` (SheetJS Community Edition, licencia Apache-2.0)
- Instalar con: `pnpm add xlsx@^0.18.5`
- **Configuración obligatoria del parser** para evitar conversión automática de fechas:
  ```typescript
  const workbook = XLSX.read(fileBuffer, {
    type: 'array',
    cellDates: false,  // Mantiene fechas como strings DD/MM/AAAA (no como objetos Date)
    raw: false         // Aplica formato de celda definido en Excel
  })
  ```

### 6.4 Modificación en `WorkersTable` / `workers/page.tsx`

- Agregar botón **"Carga Masiva"** junto al botón existente de "Nuevo Trabajador"
- El botón abre `BulkWorkerImportModal`
- No modifica la tabla ni lógica existente

---

## 7. Criterios de Aceptación

### Gate 1 — Compilación
- [ ] `pnpm build` sin errores TypeScript

### Gate 2 — Testing
- [ ] Excel con 5 trabajadores nuevos (empresa existente): 5 creados
- [ ] Excel con 3 nuevos + 2 duplicados exactos (nombre+DOB+empresa): 3 creados, 2 en `duplicates`
- [ ] Excel con 3 nuevos + 2 posibles duplicados (mismo nombre, sin DOB): 3 creados, 2 en `warnings`
- [ ] Excel con 1 fila sin nombre: error reportado sin romper las demás filas
- [ ] Subir un archivo no-Excel (PDF): error de formato claro en UI, antes de llegar al servidor
- [ ] Intentar importar sin seleccionar empresa: botón bloqueado
- [ ] Intentar importar empresa que no existe en el sistema: estado vacío con enlace a crear empresa
- [ ] Los creados aparecen en la tabla de `/workers` sin recargar manualmente

### Gate 3 — Revisión
- [ ] La plantilla descargable tiene los 8 campos con ejemplo en fila 2
- [ ] La vista previa muestra colores verde/amarillo/rojo correctamente
- [ ] El resumen final es legible y muestra conteo preciso
- [ ] El `AuditLog` tiene registrada la importación con usuario, empresa y conteo

### Gate 4 — Documentación
- [ ] Este SPEC actualizado con notas de implementación si hubo desvíos
- [ ] Handoff generado hacia SOFIA con instrucciones de implementación

---

## 8. Archivos a Crear / Modificar

| Archivo | Operación | Notas |
|---------|-----------|-------|
| `frontend/src/actions/worker.actions.ts` | Modificar | Agregar `bulkImportWorkers(rows, projectId)` |
| `frontend/src/components/BulkWorkerImportModal.tsx` | Crear | Nuevo componente modal (incluye selector de Project) |
| `frontend/src/app/workers/page.tsx` | Modificar | Agregar botón y modal |
| `frontend/public/templates/plantilla-trabajadores.xlsx` | Crear | Plantilla descargable |
| `frontend/package.json` + `pnpm-lock.yaml` | Modificar | Agregar dependencia `xlsx` |

**Total: 5 archivos** — dentro del límite de escalamiento (≤7).  
**Prerequisito externo:** Los 4 archivos de SPEC-12 deben estar implementados antes de esta SPEC.

---

## 9. Consideraciones de Seguridad

- **Autorización:** La server action debe verificar sesión activa y que el usuario tiene permiso sobre `companyId` (rol ADMIN o superior).  
  No aceptar `companyId` de formulario sin validar en sesión.
- **Límite de tamaño:** Rechazar archivos > 2 MB en cliente antes de parsear.
- **Límite de filas:** Rechazar payloads con > 200 filas en el server action.
  > **Nota de rendimiento (Deby FIX-20260519-06):** 500 filas generaría ~1,500 queries DB (3 por fila) y un tiempo estimado de 30-60s en Railway, cercano al límite de timeout. El límite de 200 filas reduce esto a ~600 queries / 12-24s, dentro del margen seguro. Si en producción se necesita más capacidad, la solución correcta es agrupar las queries de deduplicación en un solo `findMany` con `OR` antes de escalar el límite.
- **Sanitización:** Los strings de `firstName`, `lastName` se triman y pasan por el schema Zod antes de cualquier insert.
- **No loggear datos de trabajadores** en `console.log` en producción (cumplimiento del AGENTS.md).

---

## 10. Fuera de Alcance (Fase 2)

Los siguientes puntos se excluyen de esta SPEC para mantener el scope acotado:

- Canal Portal B2B (`/portal/workers`) — requiere primero documentar y madurar el portal
- Asignación de sucursal (branchId) en la carga — el trabajador queda sin sucursal asignada hasta el check-in
- Notificación por email a trabajadores importados
- Exportación del listado de duplicados como Excel

---

## 11. Notas de Arquitectura

### Sobre el Dashboard de Empresas (Portal B2B)
El portal B2B en `/portal` existe pero está subdesarrollado. Solo tiene lista de trabajadores y lista de eventos. Antes de exponer la carga masiva en el portal, se recomienda una SPEC separada que formalice:
- Qué ve una empresa en su dashboard
- Qué acciones puede tomar (crear trabajadores, subir masiva, ver citas)
- El modelo de permisos de los usuarios de tipo `COMPANY_USER`

Esta es una deuda documentada, no un bloqueante para Fase 1.

### Sobre asimetría de deduplicación (por diseño)
La deduplicación del alta masiva es intencionalmente más permisiva que la del alta individual. El alta individual bloquea ante cualquier match `nombre+DOB` (independiente de empresa) para forzar al admin a tomar una decisión caso por caso. El alta masiva clasifica los match cross-empresa como `warnings` (🟡) para no detener una operación de 200+ trabajadores que puede tener casos legítimos de personal compartido. Esta asimetría es por diseño y no compromete la integridad del `universalId` (que es el mismo para la misma persona biológica en cualquier empresa).

### Sobre usar `xlsx` (SheetJS)
La librería se ejecuta 100% en cliente. El archivo Excel nunca viaja al servidor — solo viajan los datos JSON parseados. Esto reduce riesgo de inyección a través de archivos maliciosos y mantiene los payloads livianos.

---

## 12. Handoff Recomendado

Una vez aprobado este SPEC por el humano:
1. Generar `HANDOFF_ARCH-20260519-11_SOFIA_ALTA-MASIVA-TRABAJADORES.md`
2. SOFIA implementa en este orden:
   - Migración Prisma de SPEC-12 → `prisma migrate dev` (prerequisito)
   - `project.actions.ts` con todas las actions de SPEC-12
   - `projects/page.tsx` + `ProjectFormModal.tsx` de SPEC-12
   - `bulkImportWorkers()` server action (sin UI, verificar con una llamada directa)
   - `BulkWorkerImportModal.tsx` con los pasos del modal
   - Script `scripts/generate-worker-template.js` que usa `xlsx@^0.18.5` para generar la plantilla con encabezados y fila de ejemplo. Guardar el resultado en `public/templates/plantilla-trabajadores.xlsx`.
   - Integrar el modal en `workers/page.tsx`
3. GEMINI valida los 4 Soft Gates antes de cerrar

---

*Generado por INTEGRA — ARCH-20260519-11 — 2026-05-19*
