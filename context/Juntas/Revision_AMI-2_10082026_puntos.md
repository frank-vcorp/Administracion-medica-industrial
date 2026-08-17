# Separación de Puntos — Mini-Junta AMI 10/08/2026 (continuación)

**Origen:** `context/Juntas/Revision Ami-2.txt` (Tactiq, 11 min)
**Asistentes:** Frank Saavedra, AMI Erika Rodríguez, Jaqueline, Leticia Uribe
**Fecha junta:** 2026-08-10 14:16 → 14:27 CST (continúa la junta principal que terminó 14:07)
**Elaborado:** 2026-08-17 (Atlas M3) — check-in complementario
**Relación:** Complemento de `Revision_AMI_10082026_puntos.md`. Esta mini-junta se centró en **unidades móviles, mantenimiento, calibraciones e inventario**.

---

## Resumen ejecutivo

Mini-junta de 11 min, continuación de la principal. **Un solo tema dominante**: cómo se modela la unidad móvil y su mantenimiento, y cómo se agregan equipos (audiómetros, espirómetros, RX) al calendario. Se cerró con:

- ✅ Alta de unidad con nombre y equipamiento (ya operativo).
- ✅ Calendario de mantenimiento ya operativo con regla "proyecto > mantenimiento".
- � Falta agregar **cabina audiometría** y **consultorio** como opciones de equipamiento (Jaqueline explícito).
- 🟡 Falta **calendario de calibraciones de equipos** (audiómetros, espirómetros) — Erika explícito: "es importante".
- � **Inventario de insumos/equipos por clínica** quedó como **2da etapa** — Erika: "A lo mejor en una segunda etapa".
- 📅 **Mini-junta agendada para 11/ago 4-5 pm** para revisar avances.

---

## Bloque 7 — Unidades móviles, mantenimiento, calibraciones, inventario

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| 7.1 | Alta de unidades con **nombre y equipamiento** | ✅ Operativo. `MobileUnitForm.tsx` con 3 opciones: `audiometro`, `espirometro`, `rayos_x`. | ✅ Hecho parcial | Frank en demo OK. |
| 7.2 | Alta de unidades con **placa, año, número económico** | ✅ Modelo `MobileUnit` ya tiene `plate`, `year`, `economicNumber`. UI no los exige (nullable). | 🟡 Media | Lety: "la placa normalmente no la ponemos". Decidir si son opcionales u obligatorios. |
| 7.3 | **Capacidad diaria** de la unidad | ✅ Campo `capacity: Int?` existe. | 🟡 Media | Sin uso visible en UI. |
| 7.4 | **Equipamiento: agregar "Cabina de Audiometría" y "Consultorio"** | ❌ `MobileUnitForm.tsx:30-32` solo tiene audiómetro, espirómetro, rayos X. **Faltan** `cabina_audiometria` y `consultorio`. | 🔴 Alta | Jaqueline: "unidad uno es únicamente consultorio, la unidad dos tiene cabina de audiometría y aparte consultorio". |
| 7.5 | **Calendario de mantenimiento** con regla proyecto > mantenimiento | ✅ Operativo. `MaintenanceCalendar` + `MaintenanceRecord` (PROGRAMADO, COMPLETADO, CANCELADO, REPROGRAMADO). | ✅ Hecho | Frank en demo OK. |
| 7.6 | Mantenimiento no tapa proyecto; proyecto sí puede reagendar mantenimiento | ✅ Implementado (`rescheduledTo`, status REPROGRAMADO). | ✅ Hecho | Frank explícito. |
| 7.7 | Técnico no puede dar de alta mantenimiento | Por verificar — `createBy` requerido en schema, falta role-gate. | � Media | Frank en demo lo asumió. |
| 7.8 | Tipos de mantenimiento: preventivo, correctivo, verificación, limpieza | Por verificar enum `MaintenanceType`. | 🟡 Media | Frank en demo los mencionó. |
| 7.9 | **Calendario de calibraciones de equipos** (audiómetros, espirómetros) | ❌ No existe. Backend tiene `CalibrationSnapshot` (snapshot puntual), pero NO hay modelo `Equipment` ni `Calibration` como calendario. | 🔴 Alta | Erika: "es importante el calendario de calibraciones de equipos". Jaqueline pasó formato con audiómetros y espirómetros. |
| 7.10 | Inventario de **audiómetros y espirómetros** como equipo separado de la unidad | ❌ No existe modelo `Equipment`. Solo `MobileUnit.equipment` como flag binario. | 🔴 Alta | Jaqueline pasó formato con todos los audiómetros y espirómetros en existencia. Frank: "los agrego entonces". |
| 7.11 | **Inventario de insumos y equipos por clínica** (material laboratorio, ambulancia, clínicas) | ❌ No existe. 2da etapa explícita Erika. | 🟢 Baja | Erika: "A lo mejor en una segunda etapa". Out-of-scope por ahora. |
| 7.12 | **Trazabilidad de insumos**: cuánto se entrega, cuánto se gasta, cuánto se repone | ❌ No existe. | 🟢 Baja | 2da etapa. |
| 7.13 | Insumo ligado a equipo que lo consume y ligado a clínica | ❌ No existe. | 🟢 Baja | 2da etapa, Erika: "Tendrían que ligados a cada clínica sí, probablemente". |
| 7.14 | Mini-junta agendada para **11/ago 4-5 pm** | Agendada. | ✅ Hecho | Frank: "Perfecto entonces ahorita envío el [link]". |

---

## Decisiones de la mini-junta (firmadas verbalmente)

1. **Equipamiento mínimo de unidad** (Jaqueline explícito): consultorio / cabina audiometría / rayos X / audiómetro / espirómetro. **Falta agregar los 2 primeros**.
2. **Calendario de equipos se mete en el mismo calendario de unidades** (Frank propuso, todos同意): "para no verlo como mantenimiento, sino parte del equipo de trabajo".
3. **Inventario de insumos queda para 2da etapa** (Erika explícito, todos同意).

---

## Verificaciones de código

**Modelos Prisma (frontend):**

```prisma
model MobileUnit {                    // ARCH-20260711-01 ✅
  id, name, plate, vin, year, capacity, economicNumber, imageUrl
  status: MobileUnitStatus
  equipment: Json?                    // Shape: { <key>: boolean }
  notes
  // Relations: projects, medicalEvents, labOrders, maintenances
}

model MaintenanceRecord {             // ARCH-20260711-01 ✅
  id, mobileUnitId
  type: MaintenanceType, status: MaintenanceStatus
  scheduledDate, completedDate, rescheduledTo
  description, technician, cost, nextDueDate
  attachments: Json?
  createdBy, completedBy
}
```

**Componentes clave:**

- `/operations/mobile-units/page.tsx` — orquestador catálogo + operación + calendario dual.
- `MobileUnitManager.tsx` — CRUD de unidades.
- `MobileUnitOperationsPanel.tsx` — métricas, próximos mantenimientos, conflictos proyecto/mantenimiento.
- `MaintenanceCalendar.tsx` — calendario semanal dual.
- `MobileUnitForm.tsx:30-32` — equipamiento actual:
  ```typescript
  { key: 'audiometro', label: 'Audiómetro' },
  { key: 'espirometro', label: 'Espirómetro' },
  { key: 'rayos_x', label: 'Rayos X' },
  // FALTAN: cabina_audiometria, consultorio
  ```

**Acciones:**

- `frontend/src/actions/mobile-unit.actions.ts` — CRUD completo, schema acepta `equipment: Record<string, boolean>`.
- `frontend/src/actions/maintenance.actions.ts` — usada por `/projects/page.tsx` (ARCH-20260804-03).

**Lo que NO existe (a crear):**

1. Modelo `Equipment` (frontend Prisma) para audiómetros, espirómetros, RX como entidad con nº de serie, calibraciones, etc.
2. Modelo `Calibration` para calendario de calibraciones.
3. Modelo `Supply` / `Consumable` para inventario de insumos (2da etapa).
4. Componente para agregar audiómetros/espirómetros al calendario de unidades.

---

## Tickets 🔴 Alta (de esta mini-junta)

| # | Ticket | Bloque | Esfuerzo |
|---|--------|--------|----------|
| T-7.4 | Agregar `cabina_audiometria` y `consultorio` a `MobileUnitForm` equipamiento | 7.4 | XS (~30 min) |
| T-7.9 | Modelo `Equipment` + `Calibration` + UI calendario | 7.9 + 7.10 | M (~1 día) |

---

## Tickets 🟢 Fuera de alcance (registrados)

- T-7.11 a T-7.13 — Inventario de insumos/equipos por clínica → **2da etapa**, registrado en backlog.

---

## Próxima mini-junta

**11 de agosto 2026, 4-5 pm** (Frank debe enviar link).

Temas esperados según esta junta:
- Avance de catálogo de unidades (Unidad 1, 2, 3, Remolque 1, Remolque RX).
- Avance del calendario de mantenimiento + calibraciones de equipos.

---

## Referencias — extractos originales

- Inventario de unidades y equipamiento: líneas 26-50, 02:09-04:55.
- Calendario de mantenimiento y reagendado: líneas 04:55-07:20.
- Calendario de calibraciones de equipos: líneas 07:20-09:20.
- Inventario 2da etapa: líneas 09:53-11:00.
- Mini-junta 11/ago: líneas 09:25-11:30.

---

**Nota final:** Este documento es complemento del principal (`Revision_AMI_10082026_puntos.md`). Si Frank prioriza, los 2 tickets 🔴 Alta de esta mini-junta pueden ir juntos en una sola SPEC corta.
