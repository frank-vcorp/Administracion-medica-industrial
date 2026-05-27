# SPEC: Calendario de Proyectos de Visita Médica

**ID:** ARCH-20260519-16  
**Fecha:** 2026-05-19  
**Estado:** IMPLEMENTADA Y PUBLICADA  
**Agente Autor:** INTEGRA  
**Prioridad:** Media-Alta  
**Depende de:** SPEC-12 (ARCH-20260519-12) — la entidad `Project` ya debe existir y estar migrada  
**Puntaje INTEGRA:** (3×3) + (2×2) - (2×0.5) = **12**  
*(Valor=3: devuelve visibilidad operativa real del calendario | Urgencia=2: ya no bloquea alta masiva, pero sí la operación diaria | Complejidad=2: nueva vista calendario apoyada en entidad ya existente)*

---

## 1. Contexto y Problema

AMI ya puede crear proyectos de visita médica y asociar trabajadores, pero hoy esos proyectos solo se visualizan en forma de tabla. Operativamente, el equipo piensa y coordina estas visitas como bloques de calendario por empresa y rango de fechas.

Sin una vista calendario:
- se pierde la lectura rápida de carga por semana o mes
- cuesta detectar solapamientos de proyectos
- la entidad `Project` sigue sintiéndose administrativa y no operativa
- el equipo mantiene dependencia mental de Google Calendar como fuente visual principal

Este corte agrega una **vista calendario operativa** para `Project`, sin convertir todavía el sistema en un scheduler complejo de citas por hora.

---

## 2. Objetivo

Construir una vista calendario de proyectos que permita visualizar cada `Project` como un bloque de fecha por empresa, con acceso rápido a edición y al conteo de trabajadores vinculados.

---

## 3. Alcance

### Incluye

1. Ruta visual de calendario para proyectos.
2. Vista por mes como primera superficie obligatoria.
3. Render de cada proyecto como bloque o tarjeta dentro de sus días activos.
4. Datos mínimos visibles por bloque:
   - nombre del proyecto
   - empresa
   - rango de fechas
   - estado
   - conteo de trabajadores
   - `unitRef` o sucursal si existe
5. Acción rápida para abrir edición del proyecto.
6. Filtro básico por empresa y por estado.
7. Navegación de mes anterior / siguiente / hoy.

### No incluye

1. Drag and drop en calendario.
2. Reprogramación arrastrando bloques.
3. Agenda por hora.
4. Integración con Google Calendar.
5. Colores semánticos definidos por negocio más allá del estado del proyecto.
6. Conflictos automáticos o validación dura de solapamientos.

---

## 4. Decisiones de Diseño

1. La primera versión vive sobre la entidad `Project` existente; no se crea entidad nueva de evento/calendario.
2. El calendario es una **vista derivada** del CRUD de proyectos ya implementado.
3. El color del bloque responde al `ProjectStatus`, no a reglas manuales del usuario.
4. Si un proyecto cubre varios días, debe verse repetido o extendido a lo largo de todo su rango, pero sin exigir librería pesada de scheduler empresarial en esta fase.
5. Si no existe `branchId`, se muestra `unitRef` o el texto `Planta cliente`.

---

## 5. Superficie Técnica Esperada

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `frontend/src/app/projects/page.tsx` | Modificar | Convertir la página actual en contenedor con toggle Tabla / Calendario o dejar Calendario como vista principal |
| `frontend/src/components/ProjectsTable.tsx` | Reutilizar | Mantener tabla como vista secundaria o fallback |
| `frontend/src/components/ProjectsCalendar.tsx` | Nuevo | Componente de calendario mensual |
| `frontend/src/actions/project.actions.ts` | Extender si hace falta | Reusar `getProjects()`; agregar filtros opcionales solo si son necesarios |
| `frontend/src/components/AppShell.tsx` | Modificar | Exponer acceso visible a `/projects` en navegación interna |

> **Decisión de alcance para SOFIA:** evitar helpers nuevos en `frontend/src/lib/` salvo que el calendario se vuelva ilegible sin ellos. La preferencia de V1 es resolver la lógica dentro de `ProjectsCalendar.tsx` para mantener el corte en **máximo 5 archivos**.

---

## 6. Contrato de Datos

La vista calendario puede partir de `getProjects()` siempre que retorne como mínimo:

```ts
{
  id: string
  name: string
  startDate: Date
  endDate: Date
  status: 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  unitRef: string | null
  notes: string | null
  company: { id: string; name: string }
  branch?: { id: string; name: string } | null
  _count: { workers: number }
}
```

Si el render mensual requiere filtros server-side, se podrá agregar:

```ts
getProjectsCalendar(params?: {
  month: number
  year: number
  companyId?: string
  status?: ProjectStatus
}): Promise<ProjectCalendarItem[]>
```

Pero no es obligatorio en V1 si `getProjects()` alcanza.

---

## 7. UX Esperada

### Layout mínimo

1. Encabezado con título `Calendario de Proyectos`.
2. Controles:
   - selector de mes
   - botón hoy
   - filtro de empresa
   - filtro de estado
   - botón `Nuevo Proyecto`
3. Grilla mensual.
4. Cada proyecto visible como pill/card compacta.
5. Click sobre proyecto:
   - abre modal de edición existente `ProjectFormModal`
   - o navega a detalle futuro si después se crea ruta específica

### Semántica visual mínima

- `DRAFT` → gris
- `CONFIRMED` → azul
- `IN_PROGRESS` → ámbar
- `COMPLETED` → verde
- `CANCELLED` → rojo

---

## 8. Reglas de Render

1. Un proyecto de un solo día aparece solo en esa fecha.
2. Un proyecto multi-día aparece en todos los días entre `startDate` y `endDate` inclusive.
3. Si en un día existen más proyectos de los que caben visualmente, se muestra `+N más` o una variante compacta equivalente.
4. La vista no debe colapsar si hay proyectos sin `branchId`.
5. La vista no debe depender de `workers` cargados completos; solo del `_count.workers`.

---

## 9. Criterios de Aceptación

1. Desde la ruta de proyectos existe una vista calendario usable.
2. Un proyecto creado en `ProjectFormModal` aparece en el mes correspondiente.
3. Los proyectos multi-día se visualizan en todo su rango.
4. Se puede filtrar por empresa sin romper el calendario.
5. Se puede filtrar por estado sin romper el calendario.
6. El conteo de trabajadores es visible por proyecto.
7. La edición de un proyecto desde la vista calendario funciona.
8. La tabla actual sigue disponible como fallback o vista alterna.

---

## 10. Riesgos y Mitigaciones

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Saturación visual si hay muchos proyectos en el mismo día | Media | Compactar con `+N más` |
| Re-render costoso si se cargan demasiados proyectos históricos | Baja | Filtrar por mes/año o recortar por rango visible |
| Complejidad innecesaria por usar librería pesada tipo full scheduler | Media | Resolver V1 con calendario mensual custom y helpers simples |

---

## 11. Handoff Recomendado

1. SOFIA conserva `ProjectsTable` y agrega `ProjectsCalendar`.
2. El corte no debe tocar citas ni agenda clínica.
3. El modal existente `ProjectFormModal` se reutiliza para creación/edición desde calendario.
4. Si se requiere nueva librería de calendario, debe justificarse antes de introducirla. La preferencia inicial es implementación simple propia.

---

## 12. Ejecución para SOFIA

### Archivo ancla inicial

`frontend/src/app/projects/page.tsx`

### Datos existentes a reutilizar

1. La entidad `Project` ya existe en Prisma y en producción.
2. La ruta `/projects` ya existe y hoy renderiza tabla.
3. `ProjectFormModal.tsx` ya soporta creación y edición.
4. `ProjectsTable.tsx` ya existe como fallback funcional.
5. `getProjects()` ya entrega la base de datos necesaria para la vista calendario.

### Datos faltantes a crear

1. Componente visual `ProjectsCalendar.tsx`.
2. Estado o control de vista Tabla / Calendario en `/projects`.
3. Acceso visible a `/projects` en navegación (`AppShell`).
4. Filtros client-side por empresa y estado si `getProjects()` resulta suficiente.

### Archivos exactos a crear o modificar

1. `frontend/src/app/projects/page.tsx` — modificar
2. `frontend/src/components/ProjectsCalendar.tsx` — crear
3. `frontend/src/components/ProjectsTable.tsx` — modificar solo si hace falta coordinación con el toggle
4. `frontend/src/actions/project.actions.ts` — modificar solo si hace falta filtro adicional
5. `frontend/src/components/AppShell.tsx` — modificar para exponer `/projects`

### Máximo de archivos permitidos

**5 archivos**

Si SOFIA concluye que necesita abrir un sexto archivo, debe detenerse y devolver `BLOQUEO DE CONTEXTO` a INTEGRA antes de expandir el alcance.

### Validación exacta esperada

1. `pnpm exec tsc --noEmit --skipLibCheck`
2. `pnpm exec eslint src/app/projects/page.tsx src/components/ProjectsCalendar.tsx src/components/ProjectsTable.tsx src/components/AppShell.tsx src/actions/project.actions.ts`
3. Verificación manual básica:
   - `/projects` muestra vista calendario
   - el toggle conserva acceso a la tabla existente
   - al hacer click sobre un proyecto se puede abrir edición con `ProjectFormModal`

### Condición de detención si falta contexto

Detenerse y devolver `BLOQUEO DE CONTEXTO` si ocurre cualquiera de estos casos:

1. la vista calendario exige una librería externa nueva para ser viable;
2. se requiere una nueva ruta de detalle de proyecto no contemplada aquí;
3. el filtro mensual no puede resolverse razonablemente con `getProjects()` actual y obliga a rediseñar server actions más allá del quinto archivo.

---

*Generado por INTEGRA — ARCH-20260519-16 — 2026-05-19*