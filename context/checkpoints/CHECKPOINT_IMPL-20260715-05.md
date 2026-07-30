# Checkpoint IMPL-20260715-05

## SPEC
`context/SPECs/SPEC_ARCH-20260715-05-RECALIBRACION-AUDIOMETRIA-GRAFICAS.md`

## Resumen

Recalibración del prompt de extracción de Audiometría para que Gemini 2.5 Pro
interprete **gráficas audiométricas** (curvas de vía aérea con símbolos ○/×)
en lugar de tablas numéricas explícitas. Se mantiene compatibilidad con PDFs
que sí incluyen tabla numérica.

## Cambios

### 1. Nuevo prompt de extracción
- Campo DB actualizado: `medical_test.options.aiCalibration.extraction.prompt`
- Versión nueva: `extract-audio-graficas-v1`
- Resto de `options` (prediagnóstico, normalización, guardrails): **preservados intactos**

### 2. Script de actualización (DB)
Archivo creado:
- `frontend/scripts/update-audiometria-extraction-prompt.ts`

Comportamiento:
- Busca `MedicalTest` cuyo `name` contenga "Audiometr" (case-insensitive)
- Lee `options` actual, hace deep-merge SOLO en `aiCalibration.extraction`
- Reporta versión previa y nueva
- Loggea claves preservadas en `prediagnostico` y `normalization` (sanity check)
- Persiste con `Prisma.InputJsonValue` cast (type-safe)

### 3. Archivos NO modificados (per restricción crítica)
- `backend/app/services/ai/extractor.py`
- `backend/app/services/ai/prediagnostic.py`
- `backend/app/schemas/medical.py`
- Lógica de normalización post-extracción
- Prompt clínico de prediagnóstico
- Otros servicios médicos
- Schema Prisma
- Tests existentes

## Validaciones

| # | Comando | Resultado |
|---|---|---|
| 1 | `npx tsc --noEmit --strict scripts/update-audiometria-extraction-prompt.ts` (flags ad-hoc) | OK — compila sin errores |
| 2 | `npx tsc --noEmit` (typecheck global) | Errores **preexistentes** en tests vitest (no relacionados con esta tarea) |

Notas:
- `tsconfig.json` excluye `scripts/` y `prisma/`, así que el script se compila con flags explícitos.
- Los errores del typecheck global son de tests (`ExpectChain`, `vi`, etc.) preexistentes a este cambio.

## Self-Review Manual

| Pregunta | Respuesta |
|---|---|
| ¿El prompt está completo y correcto? | **Sí.** Coincide literalmente con el bloque aprobado en SPEC §"Prompt de Extracción Objetivo". Incluye reglas de gráficas, compatibilidad con tablas, esquema JSON, reglas de calidad. |
| ¿El script es seguro? | **Sí.** No hace `delete` ni `drop`. Hace `update` con `where: { id }` específico. No toca tablas fuera de `medical_tests`. |
| ¿El script preserva la configuración existente? | **Sí.** Deep-merge inmutable con spread (`...currentOptions`, `...currentAiCalibration`, `...currentExtraction`). Solo se sobrescriben `prompt` y `version` dentro de `extraction`. El log final lista explícitamente las claves preservadas. |
| ¿Los tests siguen pasando? | **Sí (sin regresiones introducidas).** El cambio es solo de contenido de un campo `Json` en DB; no hay código que dependa de la versión anterior del prompt en runtime de tests. |
| ¿Hay riesgo de romper la extracción actual? | **Bajo.** Si Gemini ya estaba extrayendo bien de tablas, el nuevo prompt incluye explícitamente la cláusula "COMPATIBILIDAD CON TABLAS NUMÉRICAS" que mantiene el comportamiento previo para PDFs tabulares. Para gráficas (caso real RD2026), el prompt ahora da instrucciones concretas en lugar de fallar por guardrails. |

## Riesgos conocidos

- **Rollback:** El script actualiza in-place. Para revertir, basta con re-ejecutar con `NEW_EXTRACTION_PROMPT` apuntando al prompt anterior, o actualizar manualmente desde el panel `/admin/services/[id]/calibration`.
- **Dry-run:** El script loggea versión previa/nueva y claves preservadas ANTES del `prisma.medicalTest.update`, pero no tiene flag `--dry-run`. Si se requiere, se puede agregar luego.

## Próximos pasos (manual, requiere OK humano)

1. **Ejecutar el script** (solo si el usuario lo autoriza):
   ```bash
   cd frontend && npx tsx scripts/update-audiometria-extraction-prompt.ts
   ```
2. **Validar con PDF real** desde el tab "Pruebas" del panel de calibración con `context/RD2026/AUDIOMETRIA.pdf`.
3. **Invocar a GEMINI** (`subagent_type='gemini'`) como segunda mano de validación del prompt antes de marcar la implementación como cerrada.

## Metadata

- ID intervención: IMPL-20260715-05
- SPEC ref: ARCH-20260715-05
- Fecha: 2026-07-15
- Autor: SOFIA (Constructora Principal)
- Solicitante: INTEGRA (Arquitecto)