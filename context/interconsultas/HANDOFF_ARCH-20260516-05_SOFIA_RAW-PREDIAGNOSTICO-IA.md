# HANDOFF ARCH-20260516-05 -> SOFIA

## Contexto
En producción ya confirmamos que la extracción sí cambió a `extract-v3`, pero la validación del prediagnóstico quedó bloqueada porque la papeleta no expone el RAW clínico ni la versión real del prompt. El sello visible `v1` en la tarjeta actual corresponde a `snapshot.version`, no a `audit.prompt_version`.

## Objetivo
Implementar observabilidad ligera del prediagnóstico IA en la papeleta, sin alterar la lógica clínica ni la persistencia existente.

## Fuente de Verdad
- SPEC: `context/SPECs/SPEC_ARCH-20260516-05-RAW-PREDIAGNOSTICO-IA-TRAZABILIDAD.md`

## Alcance de Implementación
- Ajustar el panel clínico para mostrar:
  - `Snapshot vN`
  - `Prompt clínico: <audit.prompt_version>`
  - proveedor/modelo clínico si existen
  - bloque colapsable con RAW de `prediagnosisData`
- Conservar intacta la vista clínica amigable y la revisión médica.

## Archivos Probables
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- Helper de render JSON si conviene reutilizar uno ya existente

## Restricciones
- No tocar backend.
- No cambiar Prisma.
- No alterar prompts ni calibración.
- No romper snapshots viejos sin `audit`.

## Criterios de Aceptación
1. El usuario puede ver el RAW clínico del snapshot vigente desde la papeleta.
2. La UI separa explícitamente versión del snapshot vs versión del prompt clínico.
3. Si el snapshot no trae `audit`, la UI sigue estable con fallback claro.
4. La revisión médica actual sigue funcionando sin regresiones.

## Validación Pedida a SOFIA
- Ejecutar validación mínima del slice tocado.
- Confirmar con evidencia que el panel muestra `prompt_version` clínico real.
- Generar checkpoint de entrega.