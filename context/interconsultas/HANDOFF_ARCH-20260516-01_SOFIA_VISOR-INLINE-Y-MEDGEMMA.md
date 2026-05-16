# HANDOFF ARCH-20260516-01 a SOFIA — Visor inline de bucket y remediación MedGemma

- ID: ARCH-20260516-01
- Fecha: 2026-05-16
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_ARCH-20260516-01-VISOR-INLINE-BUCKET-Y-ACCESO-MEDGEMMA.md

## Objetivo

Atacar dos fallos reales observados ya en producción después del push del slice de bucket/corrobación:

1. el documento PDF del estudio ya no se embebe y dispara descarga/modal de guardado
2. el prediagnóstico clínico falla con rechazo `403 model_gated_needs_oauth` al invocar MedGemma vía Featherless

## Hallazgo verificado que NO debes reabrir

1. el panel lateral frontend sigue usando `iframe` correctamente
2. `fileUrl` estable sigue llegando como `/api/files/<key>.pdf`
3. el problema fuerte del visor está del lado del bucket/metadatos, no del layout
4. el problema de MedGemma sí llega a Featherless; no es ausencia de llamada

## Slice A — Visor inline

### Punto de entrada real

1. `backend/app/main.py`
2. opcionalmente `frontend/src/components/clinical/StudyDocumentViewer.tsx` si detectas un refuerzo menor, pero no partas de que ahí está la causa

### Corrección mínima obligatoria

1. hacer que el upload al bucket preserve `ContentType`
2. para PDF e imágenes, subir con `ContentDisposition=inline`
3. mantener el contrato de `file_url` estable como `/api/files/{key}`
4. verificar con un PDF nuevo que el `iframe` embebe sin descarga automática

### Hipótesis controladora

El objeto en bucket quedó sin metadata suficiente y el navegador trata la presigned URL como descarga, no como documento embebible.

### Qué validar al cerrar

1. visor lateral funcionando en el expediente
2. abrir en nueva pestaña mostrando PDF inline
3. imagen PNG/JPG también visualizable

## Slice B — MedGemma / Featherless

### Punto de entrada real

1. `backend/app/services/ai/prediagnostic.py`
2. `backend/app/main.py` para diagnóstico de status si se requiere enriquecer trazabilidad

### Hecho ya verificado

La UI mostró error con estos rasgos:

1. `403`
2. `invalid_request_error`
3. `model_gated_needs_oauth`
4. modelo `google/medgemma-27b-text-it`

### Lo que debes asumir

1. el código sí alcanza Featherless
2. la cuenta/key actual no tiene acceso válido a ese modelo gated o requiere autorización no satisfecha

### Corrección mínima obligatoria

1. revisar el comportamiento actual cuando Featherless devuelve 403 por permisos
2. asegurar fallback honesto o `AI_NON_CONCLUSIVE` trazado, sin falsa apariencia de éxito
3. dejar claro en checkpoint cuál fue el estado real del proveedor en entorno

### Si el usuario ya habilitó acceso al modelo

1. revalidar con caso real que el snapshot clínico sale con `clinical_provider=featherless`
2. confirmar `clinical_model_used=google/medgemma-27b-text-it`

### Si NO hay acceso aún

1. no simules que MedGemma quedó operativo
2. deja el sistema degradando a Gemini o `AI_NON_CONCLUSIVE` según el camino más honesto y menos confuso
3. documenta exactamente qué env o permiso faltó

## Restricciones

1. no cambies el contrato del panel lateral ni el layout del workspace salvo que sea imprescindible
2. no guardes URLs presignadas en DB
3. no hardcodees content types falsos ni nombres de archivo inseguros
4. no ocultes el rechazo de Featherless detrás de un mensaje genérico si puedes preservarlo de forma segura

## Criterios de aceptación mínimos

1. un PDF nuevo se ve embebido en el panel lateral
2. la nueva pestaña muestra el documento inline
3. el flujo de prediagnóstico deja uno de estos estados correctos:
   - Featherless funcionando con acceso real
   - fallback a Gemini claramente trazado
   - `AI_NON_CONCLUSIVE` con causa explícita de proveedor
4. checkpoint técnico entregado con evidencia del estado final de ambos slices

## Nota de ejecución

Prioriza primero el visor inline porque hoy rompe la lectura operativa del expediente. En paralelo o inmediatamente después, deja saneado el comportamiento clínico frente a `403 model_gated_needs_oauth` para que la IA no quede en un estado ambiguo frente al usuario final.