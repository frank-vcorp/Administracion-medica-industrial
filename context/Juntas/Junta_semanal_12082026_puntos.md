# Separación de Puntos — Junta Semanal Revisión de Avances Sistema 2.0 (12/08/2026)

**Origen:** `context/Juntas/Junta semanal de revisión de avances del sistema 2.0.txt` (Tactiq, 31 min)
**Asistentes:** Frank Saavedra, Alan, AMI Erika Rodríguez, Jaqueline, Leticia Uribe
**Fecha junta:** 2026-08-12 11:58 → 12:30 CST
**Elaborado:** 2026-08-17 (Atlas M3) — check-in de discovery
**Tema dominante:** **Calibración IA para Audiometría** y estructura del reporte final.

---

## Resumen ejecutivo

Junta corta centrada en una sola pregunta: **¿cómo debe la IA presentar la información de audiometría para que el médico la use realmente, sin ahogarlo en datos que no necesita?**

**Decisiones tomadas verbalmente:**

1. **La tabla visual NO debe mostrar todas las frecuencias** (8+ frecuencias por oído). Solo las **4 frecuencias clave** que alimentan el cálculo del **índice de pérdida bilateral combinada**. El resto va "backstage" para la IA, no para el médico.
2. **El sistema debe calcular automáticamente** el índice de pérdida bilateral combinada (fórmula documentada). Va al reporte final.
3. **Criterios diagnósticos calibrables** (umbrales por dB) — Alan propuso rangos concretos.
4. **Recomendaciones automáticas** según el diagnóstico resultante (no genéricas).
5. **Revisión médica obligatoria** post-IA: aceptar / editar / rechazar sugerencia.
6. **Reporte final debe tener hoja membretada / logo / cintillo** de "Soluciones" — Lety explícito.
7. **Próxima junta: miércoles siguiente** (Alan explícito) para validar carga.

**Discrepancia detectada** (importante):

- **Alan dijo en la junta**: "moderada 41-55 dB, severa 56-70 dB, profunda 71-90 dB".
- **Código actual** (`prediagnostic.py:225-227`): "moderada 41-60 dB".
- **Hay que reconciliar rangos** con Erika/Jaqueline antes de cargar.

---

## Bloque A — Calibración IA Audiometría

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| A.1 | Tabla visual actual muestra **TODAS las frecuencias** (8 por oído × 2 oídos) | ✅ Implementado en `prediagnostic.py`. UI renderiza PTA por oído completo. | ❌ Ajustar | Alan: "no todas, solo unas frecuencias. Son cuatro nada más". |
| A.2 | Reducir a **4 frecuencias clave** que alimentan el cálculo | ❌ UI hoy muestra todas. | 🔴 Alta | Decisión médica: cuáles son las 4 frecuencias (probablemente 500, 1000, 2000, 4000 Hz). Confirmar con Erika/Jaqueline. |
| A.3 | Las 4 frecuencias van en **"backstage"** para la IA (no visibles al médico) | ❌ No existe separación visual. | 🟡 Media | Alan: "si tú a ellas no les sirve verlo en la pantalla, si eso lo puedes tener backstage". |
| A.4 | **Cálculo automático del índice de pérdida bilateral combinada** | ❌ No implementado. Hay `resumen_bilateral` pero no es la fórmula específica. | 🔴 Alta | Fórmula documentada en normativa. Es el dato que va al reporte final. |
| A.5 | Tabla del **porcentaje de pérdida auditiva** | ❌ No existe. | 🔴 Alta | Alan explícito: "nos falta el reporte del porcentaje de pérdida auditiva. Ese no lo veo". |
| A.6 | **Criterios diagnósticos calibrables** | ✅ Ya existe estructura (`prediagnostic.py:225-227` con rangos: normal ≤25, leve 26-40, moderada 41-60). | ✅ Parcial | **Rangos a reconciliar con Alan**: él dijo "moderada 41-55". |
| A.7 | **Recomendaciones automáticas** según diagnóstico | ✅ Existe campo `recommendation` en `StudyAIPrediagnosisPanel.tsx`. Texto genérico del prompt. | 🟡 Media | Alan quiere **específicas**: "audición normal → valoración en 1 año", "hipoacusia → EPP auditivo + vigilancia". |
| A.8 | **Revisión médica obligatoria**: aceptar / editar / rechazar | ✅ Existe `MedicalVerdict` con flujo de validación. | ✅ Hecho | Pendiente: confirmar UX de los 3 botones. |
| A.9 | Prediagnóstico debe ser **enfocado**, no genérico ("muy amplio, ni lo van a ver") | ✅ `prediagnostic.py:212-223` tiene reglas específicas para audiometría. | ✅ Hecho | Alan: "los criterios son muy puntuales". |
| A.10 | **Cargar formato de Jaqueline** con diagnósticos nosológicos / otológicos | ❌ Frank dice "sí tengo la información" pero no se ve cargado en calibration. | 🔴 Alta | Frank: "La voy a empezar a capturar ya". Pendiente confirmar dónde van (en `diagnosis.prompt` o en `presentation.schema`). |
| A.11 | Calibración específica de **espirometría** | Por auditar. | 🟡 Media | Alan: "definitivamente más por los criterios de certificación". |
| A.12 | El sistema **no debe mostrar el PDF crudo** al médico (sí el reporte generado) | ❌ Hoy se muestra el PDF fuente. | 🟡 Media | Alan: "Sí ese sí lo tienen que ver" — sí, sí lo ven. Mantener. |

---

## Bloque B — Estructura del reporte final

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| B.1 | **Hoja membretada** con logo y cintillo | ❌ No existe. | 🔴 Alta | Lety explícito: "me gustaría también que ya pudiéramos a lo mejor definir cuál va a ser si va a ser una hoja membretada, si va a ser una hoja con logo de soluciones y un cintillo". |
| B.2 | Branding "Soluciones" en el reporte | ❌ No existe. | 🔴 Alta | Decisión: ¿"Soluciones AMI" o "Soluciones" como marca blanca? Confirmar con Lety/Alan. |
| B.3 | Decisión: **membrete vs logo + cintillo vs ambos** | ❌ No decidido. | 🟡 Media | Lety dejó abierta la opción. |
| B.4 | El reporte debe integrar **datos del examen médico** (auto-poblamiento) | ❌ Pendiente (también mencionado en junta del 10/ago). | 🔴 Alta | Jaqueline: "lo que necesitamos es que jale directo al resumen". |

---

## Bloque C — Estructura del sistema (catálogos)

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| C.1 | **Concluir revisión de catálogos y nombres para renombrar** | ❌ Pendiente. | 🟡 Media | Lety explícito: "tenemos pendiente concluir de revisar los catálogos y nombres para renombrar". |
| C.2 | Laboratorios y examen médico — "creo que ya tiene todo" | ✅ Lety confirmó. | ✅ Hecho | "En cuestión de de la estructura del sistema tenemos pendiente concluir de revisar los catálogos y nombres para renombrar". |

---

## Bloque D — Programación

| # | Punto | Estado actual | Prioridad | Notas |
|---|-------|---------------|-----------|-------|
| D.1 | **Próxima junta: miércoles 19/ago** (no lunes) | 📅 Acordado. | — | Alan: "Te parece? Te parece si la dejamos para el miércoles normal y ya ahí podemos revisar todo". Frank同意了. |
| D.2 | Frank debe cargar datos antes del miércoles | 🔴 En curso. | 🔴 Alta | Frank: "Yo creo que podríamos verificarlo el día lunes. Voy a tratar de cargar todos todos los los datos que ya tengamos." (luego se movió a miércoles). |
| D.3 | Material pendiente de Jaqueline para calibración: formato de diagnósticos nosológicos/otológicos | 📨 Frank dice ya tenerlo. | 🟡 Media | "Sí sí, tengo la información doctora." |

---

## Verificaciones de código

**Prediagnóstico (`prediagnostic.py:195-227`):**

```python
REGLAS ESPECÍFICAS PARA AUDIOMETRÍA
1. Si existen umbrales de vía aérea por oído y frecuencias suficientes, genera:
   - resumen_por_oido
   - resumen_bilateral
   - clasificacion_hipoacusia

CRITERIOS DE REFERENCIA ORIENTATIVOS (código actual)
- Audición dentro de límites normales: umbrales <= 25 dB
- Hipoacusia leve: 26-40 dB
- Hipoacusia moderada: 41-60 dB   # ⚠️ Discrepancia con Alan (dijo 41-55)
- [severa, profunda — no detectados en este extracto, requiere búsqueda adicional]
```

**Calibración IA — UI:**

- `frontend/src/components/calibration/AICalibrationEditor.tsx` — editor principal.
- `frontend/src/components/calibration/CalibrationTestUpload.tsx` — sube PDFs de prueba.
- `frontend/src/components/calibration/CalibrationTestResults.tsx` — muestra resultados.
- `frontend/src/components/calibration/PresentationSchemaPanel.tsx` — schema declarativo.
- `frontend/src/lib/calibration-schema.ts` — schemas compartidos.
- `frontend/src/types/calibration.ts` — tipos V2 (`FieldDefinition`, `PresentationSection`, `AICalibrationV2`).

**Visualización prediagnóstico:**

- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx:44,453-456` — campo `recommendation` ya existe.
- Falta validación del flujo de **revisión médica** (3 botones: aceptar / editar / rechazar).

**Lo que NO existe (a crear):**

1. UI con solo 4 frecuencias (vs todas las actuales).
2. Cálculo del índice de pérdida bilateral combinada en backend.
3. Tabla de porcentaje de pérdida auditiva en la papeleta.
4. Branding "Soluciones" en el reporte PDF.

---

## Tickets 🔴 Alta (de esta junta)

| # | Ticket | Bloque | Esfuerzo |
|---|--------|--------|----------|
| T-A.1 | UI audiometría: reducir a 4 frecuencias + mover resto a "backstage" | A.1 + A.3 | S (~2-3 h) |
| T-A.4 | Cálculo automático del índice de pérdida bilateral combinada | A.4 | S (~2-3 h) |
| T-A.5 | Tabla de porcentaje de pérdida auditiva | A.5 | S (~2-3 h) |
| T-A.6 | **Reconciliar rangos de criterios** (Alan 41-55 moderada vs código 41-60) | A.6 | XS (~30 min con Erika) |
| T-A.7 | Recomendaciones automáticas específicas por diagnóstico | A.7 | M (~medio día) |
| T-A.10 | Cargar formato de diagnósticos Jaqueline en calibration | A.10 | M (~medio día) |
| T-B.1 | Hoja membretada con logo "Soluciones" + cintillo | B.1 | M (~1 día) |
| T-B.4 | Auto-poblamiento del dictamen desde examen médico | B.4 | M-L (~1-2 días) |

---

## Tickets 🟡 Media (de esta junta)

| # | Ticket | Bloque |
|---|--------|--------|
| T-A.11 | Calibración específica de espirometría con criterios | A.11 |
| T-C.1 | Concluir revisión de catálogos y nombres | C.1 |

---

## Decisiones pendientes de Lety/Alan (necesarias antes de implementar)

1. **Cuáles son las 4 frecuencias** del cálculo de índice bilateral (probablemente 500, 1000, 2000, 4000 Hz — confirmar con Jaqueline/Erika).
2. **Rangos exactos** de clasificación (reconciliar Alan vs código).
3. **Branding final del reporte**: ¿"Soluciones AMI" / "Soluciones" / otro?
4. **Formato del membrete**: ¿solo cintillo superior / membrete completo / watermark?
5. **Lista exacta de diagnósticos nosológicos/otológicos** que Jaqueline envió en formato previo.

---

## Referencias — extractos originales

- Extracción audiometría y tabla actual: líneas 39-66, 07:00-08:00.
- Falta de tabla de pérdida auditiva: línea 11:00-12:40 (Alan).
- Criterios diagnósticos: líneas 17:00-19:30 (Alan).
- Reducir a 4 frecuencias backstage: líneas 20:50-22:40 (Alan).
- Revisión médica obligatoria: líneas 24:00-25:00 (Alan).
- Recomendaciones automáticas: líneas 24:53-25:30 (Alan).
- Formato Jaqueline ya enviado: líneas 25:26-26:35.
- Membrete / logo: líneas 29:15-29:35 (Lety).
- Próxima junta miércoles: líneas 30:30-31:10.

---

**Nota final:** Esta junta es discovery técnica. **No escala a INTEGRA por sí misma**. Cuando Frank priorice los 8 tickets 🔴, van juntos en una SPEC: **`ARCH-20260812-01-CALIBRACION-AUDIOMETRIA-INDICE-BILATERAL`** + sub-SPEC de **`ARCH-20260812-02-MEMBRETE-REPORTE-FINAL`**. Ambos pueden correr en paralelo.
