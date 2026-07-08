# INSIGHT-2026-07-07 — Histórico del paciente en vista consolidada

**ID:** `INSIGHT-2026-07-07-PACIENTE-HISTORIAL`
**Origen:** Frank 2026-07-07 23:38 CST
**Contexto:** Frank confirmó durante la conversación nocturna:
> "En NOVA el histórico está, pero es de papeletas. Si quieren ver el historial
> de un paciente tienen que entrar papeleta por papeleta. Por otro lado, en la
> parte de laboratorio, ¿no lo podrías ordenar así como mencionas?"

## Diagnóstico

**NOVA:** histórico del paciente existe pero requiere navegación manual papeleta por papeleta. Cero visibilidad agregada.

**AMI actual:** los LabResults están vinculados a MedicalEvent via `eventTestId`, pero la UI no muestra el histórico consolidado.

**Oportunidad:** vista de "historial de laboratorio del paciente" que muestra todos los LabResults a lo largo del tiempo en una sola pantalla, con sparklines por analito, rangos de referencia, y alertas de tendencia.

## Diseño propuesto

**URL:** `/workers/[workerId]/lab-history` (o `/patients/[id]/lab-history`)

**Componentes:**
1. Header con datos del paciente + filtros (período, categoría)
2. Sección por analito con:
   - Sparkline (mini-gráfico) de los últimos N valores
   - Valor actual + fecha
   - Rango de referencia
   - % variación vs valor anterior
   - Color: verde (estable), amarillo (cambio leve), rojo (cambio significativo o fuera de rango)
3. Lista compacta de "otros analitos" (sin sparkline, solo último valor)
4. Acciones: ver papeletas relacionadas, exportar PDF, compartir

**Tecnología:**
- Backend FastAPI: endpoint `/api/v1/lab/patients/[id]/history` con query agregada
- Frontend: componente `LabPatientHistory.tsx` con `recharts` (ya en AMI) para sparklines
- Schema: sin cambios (las relaciones ya existen)

**Esfuerzo:** ~5h
- Backend: 1.5h (endpoint + query agregada + paginación)
- Frontend: 2h (componente con sparklines + integración recharts)
- Vista por analito: 1h (lógica de colores + alertas)
- Integración con `/events/[id]`: 0.5h

**Impacto:** ALTO — resuelve una de las limitaciones más visibles de NOVA (no ver histórico consolidado).

## Pendiente

- Preguntar a la persona de NOVA en la entrevista de mañana: "¿Cuántas veces al día te piden ver el histórico de un paciente? ¿Cómo lo hacen hoy?"
- Si confirma alta demanda, esta es la mejora #1 a implementar después del cierre.
