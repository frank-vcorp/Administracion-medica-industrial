# Especificación de Producto — Entregable del Examen Médico

**Origen:** `context/datos AMI/informacion para revision/`
- `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf`
- `FORMATO EXAMEN MEDICO SODEXO.pdf`
- `FORMATO EXAMEN MEDICO FLOWSERVE.xlsx`
- `FORMATO DE NOTA MEDICA.docx`
- `FORMATO CERTIFICADO MEDICO.docx`

**Elaborado:** 2026-08-19 (Atlas M3)

---

## Modelo confirmado (Frank 2026-08-19)

```
N pruebas (1, 2, 3... las que apliquen al paciente)
    ↓
Cada prueba → dictamen independiente (slot propio en BD)
    ↓
Consolidado = dictamen general (integración + aptitud laboral)
```

---

## Entregable del Examen Médico (estructura)

El Examen Médico entrega al final **3 bloques**:

| Bloque | Tipo | Persiste en | Fuente |
|---|---|---|---|
| **Resumen ejecutivo** (9 campos) | read-only auto-poblado | `physicalExamData` | derivado |
| **Recomendaciones** | textarea editable auto-poblado | `physicalExamData` | catálogo hallazgo→recomendación |
| **Aptitud laboral** (5 opciones) | select del médico | `physicalExamData.aptitud` + `MedicalVerdict` | decisión clínica |

---

## Estructura del Examen Médico (secciones)

El Examen Médico captura **12 secciones** en este orden:

### 1. Identificación del paciente

| Campo | Origen |
|---|---|
| Nombre, fecha nacimiento, edad, sexo | Historia Clínica (maestro) |
| Identidad de género | Historia Clínica |
| Estado civil, escolaridad, dirección | Historia Clínica |
| Tipo de sangre | Antecedentes (ya migrado a select 9 valores) |

**Implementación:** ya en modelo `Worker` + `ClinicalHistoryData`.

### 2. Consentimiento informado (firma)

| Campo | Origen |
|---|---|
| Firma del paciente | Captura en sala |
| Fecha de firma | auto |

**Estado:** pendiente de implementar en frontend (no está en Cortes 1-4).

### 3. Historia ocupacional

| Campo | Tipo | Origen |
|---|---|---|
| Empresa, puesto, área | texto | Historia Clínica |
| Tipo de examen (preingreso, periódico, etc.) | select | este examen |
| Riesgos de trabajo (matriz 1-5+A) | matriz | Historia Clínica |
| EPP usado | checkboxes | Historia Clínica |

**Implementación:** parcial. Falta **tipo de examen** (select) y matriz de riesgos.

### 4. Antecedentes heredo-familiares (AHF)

| Campo | Tipo | Estado |
|---|---|---|
| 9 enfermedades (diabetes, hipertensión, etc.) | select (8 opciones ZIN) | ✅ Corte 2 |
| Trastornos mentales | select (NEGADO/SI/NO APLICA) | ✅ Corte 2 |
| Otras (con especifique) | select + texto libre | ✅ Corte 2 |

### 5. Antecedentes personales patológicos (APP)

**Modelo confirmado por Frank (2026-08-19):**

```
Por cada enfermedad (33+) → dictamen independiente + acordeón Sí/No
  - sí → 3 inputs (desde_cuando, tratamiento, observaciones)
  - no → colapsado
```

**Implementación:** ✅ Cortes 2-4.5. 5 slots independientes en BD:
- `examen_medico_texto` (texto del APP)
- Otros slots separados por prueba (ver Bloque 6 abajo)

### 6. Antecedentes personales no patológicos (APNP)

**Toxicomanías** (sub-sección):

| Campo | Tipo | Estado |
|---|---|---|
| Alcoholismo | acordeón Sí/No + condicional | ✅ Corte 2 |
| Tabaquismo | acordeón Sí/No + condicional | ✅ Corte 2 |
| Drogas | acordeón Sí/No + condicional | ✅ Corte 2 |
| Ejercicio | acordeón Sí/No + condicional | ✅ Corte 2 |
| Alimentación | select (Óptimo/Bueno/Regular/Malo/Muy malo) | ✅ Flowserve |
| Tatuajes | acordeón Sí/No + condicional | ✅ Corte 2 |

### 7. Inmunizaciones (vacunas)

| Campo | Tipo | Estado |
|---|---|---|
| 7 vacunas (rubeola, neumococo, etc.) | acordeón Sí/No + condicional | ✅ Corte 2 Módulo 1 |
| Fecha próxima dosis | input fecha | ✅ Módulo 1 |

### 8. Historia gineco-obstétrica (si sexo=F)

**12 campos** en sub-tab "Ginecológicos":

| Key | Tipo | Estado |
|---|---|---|
| `m1_gine_ivs` | select (N/A/ACTIVA/NO ACTIVA) | ✅ Módulo 1 |
| `m1_gine_ritmo` | select (métodos anticonceptivos) | ✅ Módulo 1 |
| `m1_gine_gesta` | select (0-11) | ✅ Módulo 1 |
| `m1_gine_parto` | select (0-11) | ✅ Módulo 1 |
| `m1_gine_cesarea` | select (0-11) | ✅ Módulo 1 |
| `m1_gine_doc` | select (métodos anticonceptivos) | ✅ Módulo 1 |
| `m1_gine_mpf` | select (0-11) | ✅ Módulo 1 |
| `m1_gine_aborto` | select (SI/NO) | ✅ Módulo 1 |
| `m1_gine_menarca` | input numérico (0-30) | ✅ Módulo 1 |
| `m1_gine_fum` | input fecha | ✅ Módulo 1 |
| `m1_gine_fup_uc` | input fecha | ✅ Módulo 1 |
| `m1_gine_exp_mamaria` | textarea (plantilla ZIN) | ✅ Módulo 1 |

### 9. Signos vitales (somatometría)

| Campo | Tipo | Estado |
|---|---|---|
| Peso, talla, IMC, perímetro cintura/cadera | input numérico | ✅ Cortes 1-2 |
| TA, FC, FR, T° | input numérico | ✅ Corte 2 |

### 10. Exploración física (17 plantillas ZIN)

**13 selects + 16 plantillas prellenadas + 9 numéricos** (Corte 2):

- 13 combos ZIN (test_adam, arco_movilidad, tono_muscular, coordinacion, reflejos, campimetría, ishihara, salud_bucal, estado_nutricional, etc.).
- 16 plantillas prellenadas (verbatim de NOTA MEDICA EJEMPLO.pdf).
- 9 numéricos con min/max.

### 11. Estudios complementarios (PRUEBAS INDEPENDIENTES)

**Cada prueba → su dictamen independiente (slots separados en BD):**

| Prueba | Slot BD | Origen |
|---|---|---|
| Audiometría | `audiometria_texto` | IA + manual |
| Espirometría | `espirometria_texto` | IA + manual |
| Laboratorios | `laboratorios_texto` | captura manual |
| Radiografía | `radiografia_texto` | captura manual |
| Examen Físico | `examen_medico_texto` | exploración física |

**Implementación:**
- ✅ Schema con 5 slots independientes (Corte 4.5).
- ✅ `buildExamSummary()` prefiere slots nuevos con fallback legacy.
- ⚠️ **UI todavía NO escribe en los slots nuevos** (sigue escribiendo en `impresion_diagnostica` consolidado). Pendiente migración.

### 12. Dictamen de aptitud (CONSOLIDADO)

| Campo | Tipo | Estado |
|---|---|---|
| Aptitud | select (5 opciones PDF) | ✅ Corte 1 |
| Restricciones | textarea | ✅ |
| Observaciones finales | textarea | ✅ |
| Médico evaluador / revisor | texto | ✅ |
| Cédula profesional | texto | ✅ |
| Fecha emisión | auto | ✅ |
| Soluciones Médico Empresariales / Medicina Lab. (firma) | membrete | ⏸️ Corte 5 (bloqueado) |

---

## Entregable al final del Examen Médico

### Bloque A — Resumen ejecutivo (read-only, auto-poblado)

| # | Label | Fuente de auto-poblamiento |
|---|---|---|
| 1 | Estado Nutricional | `physicalExamData.estado_nutricional` |
| 2 | Agudeza Visual | `physicalExamData.agudeza_visual_resumen` |
| 3 | Salud Bucal | `physicalExamData.salud_bucal` |
| 4 | Presión Arterial | `physicalExamData.presion_arterial_resumen` |
| 5 | Examen Médico | `physicalExamData.examen_medico_texto` |
| 6 | Audiometría | `physicalExamData.audiometria_texto` |
| 7 | Espirometría | `physicalExamData.espirometria_texto` |
| 8 | Laboratorios | `physicalExamData.laboratorios_texto` |
| 9 | Radiografía | `physicalExamData.radiografia_texto` |

### Bloque B — Recomendaciones (textarea editable, auto-poblado desde catálogo)

Lista numerada de hallazgos → recomendaciones predefinidas. Médico puede editar/agregar.

### Bloque C — Dictamen de aptitud (decisión del médico)

```
APTO
APTO CONDICIONADO
APTO CON RESTRICCIONES
NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO
PENDIENTE DE RESULTADOS
```

---

## Mapeo contra el código actual

| Sección | Implementación | Pendiente |
|---|---|---|
| 1. Identificación | ✅ existe | — |
| 2. Consentimiento | ❌ falta firma UI | **Alta** |
| 3. Historia ocupacional | parcial | **Tipo de examen (select)** |
| 4. AHF | ✅ Corte 2 | — |
| 5. APP | ✅ Cortes 2-4.5 | — |
| 6. APNP | ✅ Corte 2 | — |
| 7. Inmunizaciones | ✅ Módulo 1 | — |
| 8. Gineco-obstétrica | ✅ Módulo 1 | — |
| 9. Signos vitales | ✅ Corte 2 | — |
| 10. Exploración física | ✅ Corte 2 | — |
| 11. Estudios complementarios | ⚠️ schema sí, UI no | **Migrar UI a slots nuevos** |
| 12. Dictamen | ✅ Cortes 1-4.5 | — |
| Membrete | ⏸️ | **Corte 5** (logo Lety) |

---

## Reglas de Frank confirmadas (2026-08-17)

1. **"Médico solo llena lo estrictamente necesario"** → sistema auto-pobla resumen + recomendaciones.
2. **"Cada prueba con su dictamen independiente + consolidado"** → 5 slots separados en BD + aptitud final.
3. **Aptitud es decisión del médico** (no auto-calculada).

---

## Próximo paso (sugerido)

**Migración del UI para escribir en los 5 slots nuevos** (Corte 5 de Impresión/Aptitud).

Esfuerzo estimado: ~2-3 h SOFIA.

Si apruebas, delego con handoff detallado.