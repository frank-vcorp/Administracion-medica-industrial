# CONF-20260707-02 — Confirmación de flujo NOVA absorbido

**ID:** `CONF-20260707-02`
**Origen:** Pregunta Frank 2026-07-07 20:46 CST
**Conclusión:** SÍ. El flujo NOVA continúa dentro de AMI como si fuera software externo.

---

## Flujo completo end-to-end (NOVA absorbido en AMI)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ANTES (2 sistemas paralelos)                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AMI                                              NOVA Connection  │
│  ┌──────────────────┐                              ┌──────────────┐ │
│  │ Recepción         │  ─── duplicar datos ───►    │ Recepción    │ │
│  │ Consulta          │  ◄── resultados ────────   │ Resultados   │ │
│  │ Resultados lab?   │  ─── enviar a NOVA ────►   │ Validación   │ │
│  └──────────────────┘                              └──────────────┘ │
│                                                                     │
│  ❌ Doble captura, doble sistema, inconsistencias                 │
└─────────────────────────────────────────────────────────────────────┘

                            ↓  ↓  ↓  ABSORCIÓN NOVA → AMI  ↓  ↓  ↓

┌─────────────────────────────────────────────────────────────────────┐
│  AHORA (1 sistema único) — flujo NOVA dentro de AMI                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AMI (sistema único)                                                │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  1. PERFIL DE EMPLEO                                        │ │
│  │     JobPosition "Soldador"                                  │ │
│  │       → ProfileTest: BH, Audiometría, Espirometría, RX    │ │
│  │                                                              │ │
│  │  2. PAPELETA (MedicalEvent)                                  │ │
│  │     → EventTests pre-llenados del perfil                    │ │
│  │       ├── EventTest(BH)             status: PENDING          │ │
│  │       ├── EventTest(Audiometría)    status: PENDING          │ │
│  │       └── EventTest(Espirometría)   status: PENDING          │ │
│  │                                                              │ │
│  │  3. TOMA DE MUESTRA (consultorio)                           │ │
│  │     → Botón "Tomar muestra" en /events/[id]                 │ │
│  │     → Para cada EventTest de tipo Laboratorio:             │ │
│  │       EventTest(BH).status = SAMPLE_TAKEN                  │ │
│  │     → TRIGGER automático:                                    │ │
│  │       crea LabOrder DRAFT con:                                │ │
│  │         - workerId (de la papeleta)                          │ │
│  │         - doctorName (médico tratante)                       │ │
│  │         - companyId (empresa)                                 │ │
│  │         - medicalEventId (la papeleta)                        │ │
│  │         - items: [LabOrderItem(medicalTestId=BH, eventTestId=…)] │
│  │                                                              │ │
│  │  4. RECEPCIÓN DE LABORATORIO (/lab/reception)                │ │
│  │     → Bandeja de papeletas con EventTest SAMPLE_TAKEN          │ │
│  │     → Filtra por categoría "Laboratorio"                     │ │
│  │     → Click en papeleta → auto-llena admisión con datos      │ │
│  │     → Recepcionista CONFIRMA folio LabOrder (DRAFT → SAVED) │ │
│  │                                                              │ │
│  │  5. CAPTURA DE RESULTADOS (/lab/results)                     │ │
│  │     → Técnico de laboratorio procesa la muestra              │ │
│  │     → Captura valores por analito                            │ │
│  │       (ej: BH → Hemoglobina 14.5 g/dL)                      │ │
│  │     → Validación visual contra rangos:                       │ │
│  │       • verde (normal)                                       │ │
│  │       • amarillo (borderline)                                 │ │
│  │       • rojo (crítico, alerta)                                │ │
│  │     → Ciclo de vida:                                          │ │
│  │       PENDING → REPORTED → AUTHORIZED → VALIDATED             │ │
│  │     → Bitácora de auditoría (snapshot before/after)          │ │
│  │                                                              │ │
│  │  6. ENTREGA Y VISUALIZACIÓN                                  │ │
│  │     → Resultado visible en /events/[id] (papeleta)           │ │
│  │     → Sección "Laboratorio" en la papeleta                   │ │
│  │     → PDF imprimible (Slice F)                                │ │
│  │     → Visible para el médico tratante                       │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ✅ Un solo sistema, un solo login, datos consistentes              │
└─────────────────────────────────────────────────────────────────────┘
```

## Diferencia clave

| Antes | Ahora |
|---|---|
| AMI envía datos a NOVA | NOVA Connection se depreca |
| NOVA retorna resultados a AMI | AMI captura resultados directamente |
| Doble captura manual | Auto-llenado desde papeleta |
| Datos en 2 DBs | Datos en 1 DB (Railway) |
| Usuarios en 2 sistemas | Usuarios en 1 sistema (AMI) |
| Operación fragmentada | Operación unificada |

## Lo que NOVA "deja de ser"

**NOVA Connection (el PHP)** se convierte en:
1. **Fuente de datos históricos** a migrar en Slice H (catálogos persistentes + órdenes del último mes)
2. **Documentación de procedimientos** — los flujos operativos de NOVA se preservan como knowledge base
3. **Capacitación del equipo** — los técnicos que usaban NOVA siguen los mismos pasos, ahora en AMI
4. **NADA activo** — no recibe datos, no captura nada, no se usa

## Slice roadmap actualizado

| Slice | Descripción | Estado |
|---|---|---|
| A | Catálogos base | ✅ Cerrado |
| B | Recepción (modelo viejo: manual) | ✅ Cerrado PERO obsoleto |
| **B-v2** | Recepción (modelo nuevo: bandeja papeletas) | ⏸️ Pendiente decisión Frank |
| C | Resultados (ciclo P/R/A/V) | ✅ Cerrado (encaja con modelo nuevo) |
| D | Trazabilidad (muestra → proceso) | ⏸️ Pendiente |
| E | Catálogo avanzado estudios + seed | ⏸️ Pendiente |
| F | Reportes PDF | ⏸️ Pendiente |
| G | Caja, cortesías, corte caja | ⏸️ Pendiente |
| H | Migración datos NOVA | ⏸️ Pendiente |
| I | Cutover + deprecación NOVA | ⏸️ Pendiente |

## Mi recomendación

1. **Pausar el demo del flujo manual** (que ya sabemos está mal)
2. **Re-arquitecturar Slice B** con el nuevo modelo (bandeja de papeletas + trigger)
3. **Implementar primero el trigger** (es lo más crítico)
4. **Después seguir con D, E, F, G, H, I** con la base correcta
5. **Actualizar SPEC del Slice B** con el modelo de Frank

---

**Estado:** [✓] Modelo operativo NOVA absorbido confirmado por Frank
**Próximo paso:** Decisión de Frank sobre re-arquitecturar Slice B
