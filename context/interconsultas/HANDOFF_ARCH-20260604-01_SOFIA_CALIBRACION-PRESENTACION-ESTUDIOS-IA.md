# HANDOFF ARCH-20260604-01 a SOFIA - Capa de Presentación Persistida en Calibración IA

## Objetivo

Implementar la tercera capa de calibración por estudio: `presentation`, persistida en `aiCalibration`, con propuesta asistida desde `extracted_data` y consumo directo por el renderer clínico.

## Estado

Extracción y diagnóstico ya tienen gobernanza por calibración. La presentación todavía depende de hardcodes por estudio y ese es el cuello actual.

## Archivo ancla

- `frontend/src/types/calibration.ts`

## Ruta de control actual

- `frontend/src/actions/medical-profiles.ts`
- `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`

## Restricciones

1. No introducir un tercer prompt operativo en runtime clínico.
2. La IA solo propone el schema dentro de calibración; la papeleta consume configuración persistida.
3. Máximo 8 archivos.
4. Si necesitas un noveno archivo, detente y justifícalo.

## Archivos autorizados

1. `frontend/src/types/calibration.ts`
2. `frontend/src/actions/medical-profiles.ts`
3. `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`
4. `frontend/src/components/calibration/PresentationSchemaPanel.tsx`
5. `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`
6. `frontend/src/components/clinical/PapeletaWorkspace.tsx`
7. `backend/app/main.py`
8. `backend/app/services/ai/presentation.py`

## Implementación esperada

1. Persistir `aiCalibration.presentation.schema` con tipos compartidos.
2. Hacer que `saveAICalibrationV2()` versione cuando cambie `presentation.schema`.
3. Agregar tab `Presentación` al workspace de calibración.
4. Crear `PresentationSchemaPanel` con:
   - botón para generar propuesta asistida desde snapshot seleccionado
   - editor declarativo básico
   - guardado persistido
5. Crear endpoint backend para propuesta de schema visual usando Gemini text-only.
6. Hacer que la papeleta lea primero el schema persistido y luego el fallback hardcodeado.

## Contrato clave

Persistir bajo:

```ts
aiCalibration.presentation = {
  enabled: true,
  schema: {
    studyType: string,
    sections: []
  },
  lastSuggestedAt?: string,
  lastSuggestionModel?: string,
  lastSuggestionSummary?: string
}
```

## Validación exacta

1. `cd /workspaces/Administracion-medica-industrial/frontend && pnpm build`
2. `cd /workspaces/Administracion-medica-industrial/backend && pytest tests/test_ai_pipeline.py -q`

## Referencia obligatoria

- `context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md`