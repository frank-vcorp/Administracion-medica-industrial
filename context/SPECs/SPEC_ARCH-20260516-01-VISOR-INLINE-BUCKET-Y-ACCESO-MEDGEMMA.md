# SPEC ARCH-20260516-01 — Visor inline de bucket y remediación de acceso MedGemma

- ID: ARCH-20260516-01
- Fecha: 2026-05-16
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260513-15-STORAGE-BUCKET-RAILWAY.md
  - context/SPECs/SPEC_ARCH-20260513-08-MEDGEMMA-OPENAI-SDK-FEATHERLESS.md
  - frontend/src/components/clinical/StudyDocumentViewer.tsx
  - backend/app/main.py
  - backend/app/services/ai/prediagnostic.py

## Objetivo

Corregir dos incidentes operativos observados ya en producción después del cambio a bucket Railway y del enrutamiento clínico a Featherless:

1. el PDF del estudio se descarga o dispara modal de guardado en lugar de renderizarse embebido en el panel lateral
2. el prediagnóstico clínico falla al invocar MedGemma con error de acceso `403 model_gated_needs_oauth`

## Hallazgos verificados

### A. Visor embebido del documento

El frontend no muestra evidencia de regresión estructural en el panel lateral.

Hechos confirmados:

1. `frontend/src/components/clinical/StudyDocumentViewer.tsx` sigue usando `iframe` nativo para PDFs
2. `frontend/src/components/clinical/PapeletaWorkspace.tsx` compone correctamente la URL estable como `apiUrl + test.fileUrl`
3. la detección de PDF sigue funcionando porque el `fileName` y la URL estable conservan sufijo `.pdf`

Hipótesis controladora confirmable:

1. el objeto subido al bucket S3-compatible no conserva `Content-Type` apropiado (`application/pdf`) o no fuerza presentación `inline`
2. la ruta backend `/api/files/{key}` redirige correctamente a presigned URL, pero el navegador trata la respuesta final como descarga y no como recurso embebible

Ancla técnica observada:

1. `backend/app/main.py` sube al bucket con `upload_fileobj(...)` sin `ExtraArgs` para `ContentType` ni `ContentDisposition`

### B. Prediagnóstico MedGemma

El error visible en producción no corresponde a caída genérica del pipeline.

Hechos confirmados:

1. `backend/app/services/ai/prediagnostic.py` sí enruta a Featherless cuando `MEDGEMMA_ENABLED=true` y existe `FEATHERLESS_API_KEY`
2. la respuesta observada en UI muestra `403`, `invalid_request_error`, `model_gated_needs_oauth`
3. el modelo reportado es `google/medgemma-27b-text-it`

Conclusión ejecutiva:

1. el código sí está alcanzando al proveedor clínico
2. el proveedor está rechazando la cuenta, key o autorización del modelo gated
3. no es un fallo de render del panel ni una ausencia de llamada

## Decisión de arquitectura

Se divide la remediación en dos slices coordinados pero distintos:

### Slice 1. Visor inline en bucket

Debe corregirse en backend/storage, no en el layout del frontend.

Regla:

1. todo archivo clínico subido al bucket debe persistirse con metadatos que permitan render embebido para PDF e imagen

### Slice 2. Acceso clínico MedGemma

Debe tratarse como problema de configuración y gobernanza del proveedor, no como bug del parser frontend.

Regla:

1. mientras el modelo gated no esté autorizado, el sistema debe degradar de forma explícita a fallback permitido o dejar `AI_NON_CONCLUSIVE` con trazabilidad honesta

## Alcance aprobado

Incluye:

1. subir objetos al bucket con `ContentType` correcto derivado del archivo original
2. establecer `ContentDisposition=inline` para PDFs e imágenes cuando corresponda
3. verificar que la presigned URL preserve esos metadatos al resolver `/api/files/{key}`
4. validar render embebido del PDF en `StudyDocumentViewer`
5. documentar checklist operativo para revisar key, plan y autorización del modelo `google/medgemma-27b-text-it`
6. endurecer el comportamiento de fallback clínico mientras Featherless no tenga acceso válido al modelo

No incluye:

1. rediseño del visor del panel lateral
2. migración histórica de objetos ya subidos con metadatos incorrectos, salvo prueba puntual o reupload controlado
3. cambio de proveedor clínico definitivo sin validación del usuario
4. apertura de acceso interactivo OAuth en runtime del producto

## Reglas obligatorias

1. no guardar URLs presignadas efímeras en base de datos
2. no romper `fileUrl` estable ya adoptado por expediente y regeneración IA
3. no usar `attachment` como disposition por defecto para PDFs clínicos destinados al visor
4. si Featherless rechaza el modelo por permisos, el sistema no debe simular éxito clínico
5. la trazabilidad de `clinical_provider` y `clinical_model_used` debe conservarse aunque el resultado sea `AI_NON_CONCLUSIVE`

## Diseño técnico mínimo

### A. Upload al bucket con metadatos correctos

La abstracción mínima de upload debe aceptar metadatos del archivo original:

1. `content_type` derivado de `UploadFile.content_type` o inferido por extensión
2. `content_disposition` preferente `inline; filename="<nombre>"` para PDFs e imágenes

Comportamiento recomendado:

1. PDF → `ContentType=application/pdf`, `ContentDisposition=inline`
2. PNG/JPG/JPEG/WebP → content type real + `inline`
3. otros tipos → metadato real o inferido, sin romper descarga explícita cuando el navegador no pueda previsualizar

### B. Resolución de archivos

La ruta `/api/files/{key}` puede seguir usando redirect a presigned URL, pero la remediación no se considera completa hasta confirmar que el navegador embebe el PDF en `iframe` sin abrir modal de guardado.

### C. Remediación MedGemma

Checklist operativo mínimo:

1. confirmar que `MEDGEMMA_ENABLED=true` en el entorno correcto
2. confirmar que `FEATHERLESS_API_KEY` corresponde a una cuenta con acceso al modelo gated
3. confirmar si el plan/proyecto requiere aprobación explícita del modelo `google/medgemma-27b-text-it`
4. si la cuenta no tiene acceso, usar uno de estos caminos:
   - habilitar acceso al modelo gated
   - cambiar temporalmente a un modelo permitido equivalente
   - forzar fallback honesto a Gemini mientras se resuelve autorización

### D. Fallback clínico esperado

Mientras el modelo gated siga rechazado:

1. el resultado debe exponer claramente `clinical_provider=featherless` solo si se alcanzó Featherless y falló allí
2. si por política se decide no golpear Featherless hasta resolver permisos, debe caer a `clinical_provider=gemini`
3. nunca debe presentarse como prediagnóstico exitoso si la llamada terminó en `403`

## Archivos probables

1. backend/app/main.py
2. backend/app/services/ai/prediagnostic.py
3. frontend/src/components/clinical/StudyDocumentViewer.tsx solo si hiciera falta ajuste menor de robustez
4. checkpoint técnico de validación

## Validaciones obligatorias

### Visor inline

1. subir un PDF nuevo desde expediente
2. confirmar que el panel lateral lo embebe sin disparar descarga
3. abrir el mismo documento en nueva pestaña y confirmar render PDF, no descarga forzada
4. revalidar con al menos una imagen PNG/JPG

### MedGemma

1. consultar el estado real en `/api/v2/ai/status`
2. validar si el entorno reporta Featherless como proveedor clínico activo
3. ejecutar un caso de Audiometría o Espirometría y confirmar una de estas salidas válidas:
   - prediagnóstico exitoso con Featherless autorizado
   - fallback honesto a Gemini
   - `AI_NON_CONCLUSIVE` con razón explícita de permisos del proveedor

## Criterios de aceptación

1. el PDF vuelve a visualizarse embebido dentro del panel lateral del estudio
2. la apertura en nueva pestaña del PDF no dispara descarga automática salvo que el tipo realmente no sea previsualizable
3. el backend conserva `fileUrl` estable basado en `/api/files/{key}`
4. el incidente MedGemma queda diagnosticado y tratado como problema de autorización/configuración del proveedor, no como fallo ambiguo del panel
5. existe un camino operativo claro: acceso habilitado al modelo o fallback clínico honesto

## Criterio de éxito

El corte será exitoso cuando el expediente vuelva a comportarse como antes del cambio de storage en términos de visor embebido, y cuando la capa clínica deje de fallar en silencio: o usa MedGemma con acceso real o informa de forma controlada que el proveedor no está autorizado y cae a fallback definido.