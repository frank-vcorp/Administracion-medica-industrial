# IMPL-REPORT — FEATURE-20260824-01 (rev. 1.2)

- **ID intervención:** `IMPL-20260824-01`
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` rev. 1.2
- **Regla:** `BR-20260824-01` — umbral AMI de repetibilidad ≤150 ml
- **Estado:** `READY_FOR_VERIFYING`

## Corrección

La evidencia visual mostró que Events sólo presentaba notas de calidad. El panel ahora recibe `extractedData` completo y calcula desde `parametros[]`:

- Diferencia entre los dos valores FVC más altos, en ml.
- Diferencia entre los dos valores FEV1 más altos, en ml.
- Cumplimiento si la diferencia es **≤150 ml (0.15 L)**.
- Número de maniobras válidas disponibles.

Para `context/RD2026/ESPIROMETRIA.pdf` los resultados son:

- FVC: **30.00 ml**.
- FEV1: **40.00 ml**.
- Ambos cumplen el umbral AMI.
- Pruebas aceptables: **3**.

Los criterios cualitativos sólo se muestran cuando el payload los proporciona; no se infieren desde la tabla numérica.

## Archivos

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx`
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts`
- `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md`

`StudyAIPrediagnosisPanel.tsx` conserva las tres secciones `details open`.

## Validación V1

- Typecheck: **PASS**.
- Tests focales: **38/38 PASS**.
- Casos cubiertos:
  - Fixture real: FVC 30 ml, FEV1 40 ml, ambos `Sí`.
  - Diferencia exacta de 150 ml: `Sí`.
  - Diferencia de 151 ml: `No`.
  - Diferencia de 200 ml: `No`.
  - Compatibilidad con claves legacy `_menor_200`.
  - Payload parcial sin inferencias cualitativas.

## Pendiente V3

Playwright del Event real queda pendiente por falta de `DATABASE_URL` en el entorno local. No se modificaron backend, Prisma, migraciones ni calibración publicada.
