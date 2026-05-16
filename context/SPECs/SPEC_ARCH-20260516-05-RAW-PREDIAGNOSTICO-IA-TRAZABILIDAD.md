# SPEC ARCH-20260516-05: RAW de Prediagnóstico IA y Trazabilidad Visible

## 1. Objetivo
Exponer en la papeleta clínica un panel consultable del RAW del prediagnóstico IA y su trazabilidad operativa mínima para poder validar si el motor clínico realmente cambió entre corridas, sin depender del texto resumido ni del consecutivo visual del snapshot.

## 2. Problema Observado
- Hoy el sistema sí persiste `prediagnosisData` como JSON en `AIPrediagnosisSnapshot`.
- La UI clínica solo renderiza la vista amigable del prediagnóstico y un sello `v{snapshot.version}`.
- Ese `v1`, `v2`, etc. representa la versión ordinal del snapshot, no la versión del prompt clínico.
- Como no existe un panel RAW equivalente al de extracción, el usuario no puede verificar en operación si el prediagnóstico vigente salió con `predx-v1`, `predx-v2` o una versión calibrada posterior.

## 3. Alcance
### Incluye
- Exponer el RAW del prediagnóstico IA en la vista del estudio dentro de la papeleta.
- Hacer visible al menos la trazabilidad mínima del snapshot clínico vigente:
  - `audit.prompt_version`
  - `audit.model_name`
  - `clinical_provider`
  - `clinical_model_used`
  - `clinical_state`
  - `createdAt`
- Diferenciar explícitamente entre:
  - versión del snapshot
  - versión del prompt clínico

### No incluye
- Cambios al motor clínico, prompts o calibración.
- Cambios al esquema Prisma.
- Reprocesamiento automático de snapshots históricos.
- Cambios al flujo de upload/regeneración.

## 4. Hipótesis Validada
El problema no es falta de persistencia clínica, sino falta de observabilidad en UI. El sistema ya guarda `prediagnosisData` y `promptVersion`, pero la papeleta no los expone como evidencia verificable.

## 5. Decisión Arquitectónica
Se aprueba un corte de observabilidad ligera en frontend:
- Mantener la tarjeta clínica amigable actual.
- Agregar un bloque consultable de RAW de prediagnóstico, análogo al panel de extracción RAW.
- Mostrar una franja o metadata compacta con dos conceptos separados:
  - `Snapshot vN`
  - `Prompt clínico: predx-*`

Esto evita confundir numeración de snapshots con versionado del motor clínico y destraba la validación de calibraciones en producción.

## 6. Archivos Objetivo
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- Cualquier helper clínico existente si se requiere reutilizar renderer JSON ya presente en extracción

## 7. Criterios de Aceptación
1. Si existe `aiSnapshot.snapshot.prediagnosisData`, la UI muestra un bloque consultable de RAW clínico sin necesidad de inspeccionar base de datos.
2. El panel visible distingue claramente entre `snapshot.version` y `audit.prompt_version`.
3. El usuario puede verificar en la papeleta, para el snapshot vigente, el proveedor clínico y el modelo realmente usado.
4. Si falta `audit` en snapshots viejos, la UI no falla y muestra fallback explícito tipo `sin audit clínico`.
5. No se modifica la estructura persistida ni se rompe la revisión médica existente.

## 8. Propuesta de UX Mínima
- En la cabecera del panel clínico:
  - `Snapshot vN`
  - `Prompt clínico: predx-v2` o valor persistido
- En el cuerpo:
  - `details` o bloque colapsable `RAW de prediagnóstico`
  - JSON formateado del `prediagnosisData`
- Opcional ligero:
  - microfila de trazabilidad `Proveedor / Modelo / Estado / Fecha`

## 9. Riesgos y Mitigación
- Riesgo: saturar visualmente la papeleta.
  - Mitigación: dejar el RAW colapsado por defecto.
- Riesgo: snapshots viejos sin `audit` completo.
  - Mitigación: fallback defensivo y etiquetas `no disponible`.

## 10. Validación Esperada
- Subir o regenerar una Audiometría.
- Confirmar en UI:
  - `Snapshot vN`
  - `Prompt clínico: predx-v2` o versión real
  - `RAW de prediagnóstico` visible
- Verificar que el resumen clínico siga intacto y la revisión médica continúe operando.

## 11. Resultado Esperado
El usuario puede distinguir, desde producción y sin ambigüedad, si cambió el motor clínico o solo cambió la extracción documental.