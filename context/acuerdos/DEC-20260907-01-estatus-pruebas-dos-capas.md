# DEC-20260907-01 — Estatus de pruebas clínicas (dos capas)

**Fecha:** 2026-09-07  
**Origen:** Word *Renombramiento de catálogos 2* (R-17) + observación Frank (laboratorio)  
**Estado:** ✅ Implementado (capa visual) · pipeline BD sin cambio

---

## Problema

El Word propone **3 estatus** para la papeleta:

- Realizado  
- Pendiente  
- No realizado  

Eso cubre pruebas clínicas “directas” (audiometría, espirometría, examen médico), pero **no contempla laboratorio**, donde hoy existe un paso intermedio crítico: **muestra tomada, esperando resultado**.

El sistema ya modela un **pipeline operativo** (`EventTestStatus` en Prisma) con 7 valores. Reemplazarlo por 3 rompería visibilidad operativa.

---

## Decisión

Adoptar **modelo de dos capas**:

| Capa | Qué es | Dónde se muestra |
|---|---|---|
| **1 — Negocio** | Pendiente · Realizado · No realizado | Badges en papeleta, trazabilidad ligera, listados |
| **2 — Operativo** | Subtexto derivado del pipeline | Debajo del badge cuando aplica |

**No se cambia** el enum `EventTestStatus` ni la lógica de transiciones en server actions.

---

## Mapeo acordado

| Pipeline (`EventTestStatus`) | Estatus negocio | Detalle operativo (subtexto) |
|---|---|---|
| `PENDING` | Pendiente | — |
| `IN_PROGRESS` | Pendiente | En proceso |
| `SAMPLE_TAKEN` | Pendiente | Muestra tomada · esperando laboratorio |
| `RESULT_REGISTERED` | Realizado | Resultado registrado |
| `COMPLETED` | Realizado | Pendiente de envío |
| `SKIPPED` | No realizado | Omitido |
| `CANCELLED` | No realizado | Cancelado |

---

## Implementación

| Artefacto | Rol |
|---|---|
| `frontend/src/lib/clinical/study-status-display.ts` | Mapeo puro + labels |
| `frontend/src/components/clinical/StudyStatusBadge.tsx` | Badge UI reutilizable |
| `PapeletaWorkspace.tsx` | Lista de estudios + cabecera activa |
| `TraceabilidadLigera.tsx` | Último movimiento / siguiente paso / timeline |

---

## Fuera de alcance (por ahora)

- Renombrar “Papeleta electrónica” → “Módulo de pruebas clínicas” (R-16)
- Estatus de **interpretación** vs **envío** (R-18)
- Selector manual de estatus de negocio (solo derivación automática hoy)
- Cambios en cronograma admin (`PapeletaCronograma`) más allá de labels de timeline

---

## Referencias

- `context/acuerdos/AMI-SR-F-017-cruce.md` — ítem R-17
- `frontend/prisma/schema.prisma` — `enum EventTestStatus`
