# HANDOFF ARCH-20260513-15 a SOFIA — Integracion Railway Storage Bucket

- ID: ARCH-20260513-15
- Fecha: 2026-05-13
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion

## Objetivo

Conectar el backend Python al Railway Storage Bucket S3-compatible ya provisionado para que los archivos clinicos dejen de depender de `/uploads` local y sobrevivan a restart o redeploy.

## Contexto confirmado

1. el bucket ya existe
2. el bucket es privado
3. el backend actual guarda en `/uploads` local
4. el frontend actual consume `fileUrl` como ruta relativa del producto

Configuracion no sensible ya confirmada:

1. endpoint: `https://t3.storageapi.dev`
2. region: `auto`
3. bucket: `shelved-pod-d66dcokrpe-ik`

La credencial compartida por el usuario debe tratarse como secreto:

1. no copiarla en codigo ni markdown del repo
2. cargarla solo como variable segura del servicio backend en Railway
3. si falta `secret key`, pedirla solo por el canal seguro de Railway, no por chat

## Regla de arquitectura

No guardar en base de datos una URL presignada temporal.

La base debe guardar una referencia estable del producto, y el backend debe resolverla a bucket privado cuando el usuario abra el archivo.

## Acciones obligatorias

1. agregar cliente S3-compatible en backend Python
2. hacer que `upload-only` y flujos equivalentes suban al bucket en vez de escribir solo a disco local
3. exponer una ruta backend estable para leer archivos del bucket
4. mantener compatibilidad con visor embebido, enlace externo y regeneracion IA
5. validar persistencia real despues de restart o redeploy
6. usar como base la configuracion confirmada del bucket ya provisionado

## Punto de entrada real

1. `backend/app/main.py`
2. `backend/requirements.txt`
3. `frontend/src/actions/event-test.actions.ts`
4. `frontend/src/actions/ai-prediagnosis.actions.ts`
5. `frontend/src/components/clinical/PapeletaWorkspace.tsx`

## Entregables minimos

1. upload hacia bucket operativo
2. `fileUrl` estable y reutilizable por el producto
3. lectura del archivo funcionando en la UI
4. evidencia de que el archivo sigue accesible tras restart o redeploy
5. checkpoint tecnico con nombre de archivo, key almacenada y resultado de persistencia

## Validacion minima obligatoria

1. subir un archivo real desde expediente
2. confirmar render del visor
3. abrir en nueva pestaña
4. reiniciar o redeployar backend
5. revalidar acceso al mismo archivo
6. revalidar `regenerateStudyAI()` sobre ese mismo archivo

## No resolver en este corte

1. migracion historica de archivos perdidos
2. bucket publico
3. CDN
4. rediseño del bug de asociacion equivocada entre estudio y archivo, salvo que aparezca en el mismo slice como defecto evidente