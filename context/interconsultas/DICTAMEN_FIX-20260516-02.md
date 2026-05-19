# DICTAMEN TÉCNICO: RAW clínico ausente en panel de prediagnóstico
- **ID:** FIX-20260516-02
- **Fecha:** 2026-05-16
- **Solicitante:** SOFIA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
El síntoma más probable no está en el layout actual del frontend, sino en la ausencia de `input_debug` dentro del `prediagnosisData` del snapshot que se está mostrando en producción.

Hallazgos forenses:
- El panel principal sí pasa el dato al componente RAW: `StudyAIPrediagnosisPanel` renderiza siempre `StudyPrediagnosisRawPanel` con `predxData.input_debug`. Ver [frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx](frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx#L528).
- El componente RAW se auto-oculta únicamente si `inputDebug` viene vacío: `if (!inputDebug) return null`. Ver [frontend/src/components/clinical/StudyPrediagnosisRawPanel.tsx](frontend/src/components/clinical/StudyPrediagnosisRawPanel.tsx#L48-L49).
- El backend local sí construye y expone `input_debug` en la ruta feliz: se asigna en `generate_prediagnosis()` y se serializa en `/api/v2/studies/upload-and-analyze`. Ver [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L669-L678) y [backend/app/main.py](backend/app/main.py#L806-L808).
- El snapshot se persiste en frontend sin filtrar el campo: `predxData = result.prediagnosis ?? {}` y luego `prediagnosisData: predxData`. Ver [frontend/src/actions/ai-prediagnosis.actions.ts](frontend/src/actions/ai-prediagnosis.actions.ts#L332-L346).
- La page del evento también reenvía `prediagnosisData` completo hacia la UI, sin normalización que elimine `input_debug`. Ver [frontend/src/app/events/[id]/page.tsx](frontend/src/app/events/[id]/page.tsx#L146-L160).

Conclusión forense:
- Hipótesis 3 queda debilitada: el panel sí pasa `predxData.input_debug` correctamente en el código actual.
- Hipótesis 1 y 4 quedan como causa principal probable: el snapshot publicado no trae `input_debug`, ya sea por antigüedad o porque fue generado antes de validar end-to-end el cambio.
- Hipótesis 2 sigue viva como secundaria: si producción no incluye IMPL-20260516-09, el panel podría verse discreto; pero incluso en ese caso seguiría dependiendo de que `input_debug` exista. La ausencia total del bloque visible apunta primero a dato ausente.
- Evidencia adicional: el propio checkpoint de IMPL-20260516-08 dejó explícito que la validación real con una Audiometría reciente quedó pendiente. Ver [context/checkpoints/CHK_IMPL-20260516-08.md](context/checkpoints/CHK_IMPL-20260516-08.md#L49-L50).

### B. Justificación de la Solución
No recomiendo corrección de código inmediata sin antes discriminar el dato real del snapshot afectado.

Chequeo más barato y más discriminante:
- Inspeccionar el `prediagnosisData` del snapshot afectado y confirmar si existe `input_debug`.
- Si `input_debug` no existe: la causa es snapshot viejo o generado por una ruta/backend sin el cambio.
- Si `input_debug` sí existe pero el panel no se aprecia: la causa pasa a ser deploy desalineado del frontend, especialmente respecto a IMPL-20260516-09.

Forma mínima de verificarlo:
- Consultar en DB o desde Prisma el `prediagnosisData` del `AIPrediagnosisSnapshot` afectado.
- Alternativa equivalente: inspeccionar el JSON serializado que llega a `aiSnapshot.snapshot.prediagnosisData` en la página del evento.

Consulta orientativa:
```sql
select id,
       version,
       clinical_state,
       prediagnosis_data -> 'input_debug' as input_debug
from "AIPrediagnosisSnapshot"
where id = '<snapshot_id_afectado>';
```

### C. Instrucciones de Handoff para SOFIA
1. Tomar el `prediagnosisSnapshotId` exacto del estudio afectado en producción.
2. Verificar si `prediagnosisData.input_debug` existe en la DB o en el payload serializado del evento.
3. Si no existe, regenerar un snapshot nuevo con el backend actual o confirmar que producción no tenga desplegado IMPL-20260516-08.
4. Si sí existe, revisar el build/deploy del frontend para confirmar que producción incluya IMPL-20260516-09 y no una versión previa del panel.
5. Solo si el snapshot nuevo ya trae `input_debug` y el deploy incluye IMPL-20260516-09, considerar un ajuste adicional de observabilidad en UI.
