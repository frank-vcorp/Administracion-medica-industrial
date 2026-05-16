# SPEC ARCH-20260516-08: RAW de Entrada a MedGemma en Papeleta

## 1. Objetivo
Agregar en la papeleta un cuadro RAW para revisar exactamente qué insumo clínico se envía a MedGemma en la capa de prediagnóstico, permitiendo validar calibración, datos de entrada y trazabilidad operativa sin depender solo de la salida clínica final.

## 2. Problema Observado
- La UI ya muestra el RAW de extracción documental.
- La UI ya muestra la salida estructurada del prediagnóstico de forma amigable.
- Pero hoy no existe un panel para revisar qué llegó realmente a la capa clínica.
- El sistema actualmente NO persiste el prompt exacto renderizado que se envía a MedGemma; solo persiste la salida en `prediagnosisData`.

## 3. Hallazgo Técnico
### 3.1 Prompt clínico real
En `backend/app/services/ai/prediagnostic.py`, el prompt que se manda a MedGemma/Gemini se construye dinámicamente con:
- template por tipo de estudio
- bloque de calibración médica
- `extracted_data` serializado a JSON

### 3.2 Persistencia actual
En `frontend/src/actions/ai-prediagnosis.actions.ts` solo se persiste `result.prediagnosis_snapshot`, es decir, la salida clínica ya resuelta. No se guarda el input exacto enviado al modelo.

## 4. Decisión Arquitectónica
Se aprueba exponer un panel RAW clínico en dos niveles:

### Nivel 1 — obligatorio
Persistir y mostrar un bloque `input_debug` o equivalente con el payload clínico efectivo enviado a la capa de prediagnóstico:
- `study_type`
- `extracted_data`
- `medical_calibration` aplicada o resumen equivalente
- `clinical_provider`
- `clinical_model_used`

### Nivel 2 — deseable
Persistir también el `rendered_prompt` completo enviado a MedGemma/Gemini text-only, para inspección técnica avanzada.

## 5. Alcance
### Incluye
- Extender el snapshot clínico persistido para incluir metadata/payload de entrada a MedGemma.
- Agregar un panel colapsable de `RAW de entrada clínica` en la papeleta.
- Si existe `rendered_prompt`, mostrarlo en un bloque técnico separado o dentro del mismo panel.

### No incluye
- Exponer secretos o tokens.
- Alterar la lógica clínica de decisión.
- Cambiar el contrato de extracción documental.

## 6. Requisitos de Seguridad
1. No persistir API keys, tokens, headers ni secretos del proveedor.
2. El RAW debe contener solo datos clínicos estructurados, calibración y prompt textual renderizado si se aprueba.
3. Si el prompt renderizado se considera demasiado verboso, al menos debe persistirse el `input_payload` estructurado.

## 7. Contrato Propuesto
Dentro del snapshot clínico persistido, agregar algo como:

```json
{
  "input_debug": {
    "study_type": "Audiometria",
    "clinical_provider": "featherless",
    "clinical_model_used": "google/medgemma-27b-text-it",
    "extracted_data": {"cad": "permeable"},
    "medical_calibration": {"version": "predx-audio-medgemma-v2"},
    "rendered_prompt": "...prompt final enviado al modelo..."
  }
}
```

Si por prudencia se decide no guardar `rendered_prompt`, el `input_debug` estructurado sigue siendo obligatorio.

## 8. Criterios de Aceptación
1. Después de procesar un estudio, la papeleta muestra un panel colapsable `RAW de entrada clínica`.
2. El panel permite revisar al menos el `extracted_data` y la calibración efectiva que se enviaron al prediagnóstico.
3. Si se persiste `rendered_prompt`, el usuario puede inspeccionarlo desde la UI técnica.
4. No se exponen secretos del proveedor.
5. Snapshots viejos sin `input_debug` no rompen la UI.

## 9. UX Mínima
- Ubicación: debajo o junto al panel de Prediagnóstico IA.
- Estado: colapsado por defecto.
- Contenido:
  - badge de proveedor/modelo
  - JSON formateado del `input_debug`
  - opcional: bloque adicional de prompt renderizado

## 10. Archivos Probables
- `backend/app/services/ai/prediagnostic.py`
- `backend/app/main.py`
- `frontend/src/actions/ai-prediagnosis.actions.ts` si requiere ajuste de persistencia
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`
- Componente nuevo tipo `StudyPrediagnosisRawPanel.tsx` si conviene separar render técnico

## 11. Prioridad
Alta. Este corte desbloquea la verificación fina de qué llega a MedGemma y evita calibrar a ciegas la capa clínica.

## 12. Resultado Esperado
El usuario puede abrir un cuadro RAW técnico y ver exactamente qué insumo llegó a MedGemma para cada snapshot clínico vigente.