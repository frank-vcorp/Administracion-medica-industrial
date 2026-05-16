# SPEC ARCH-20260513-15 — Integracion de Railway Storage Bucket para archivos clinicos

- ID: ARCH-20260513-15
- Fecha: 2026-05-13
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementacion
- Sustituye como ruta activa a: `context/SPECs/SPEC_ARCH-20260513-14-UPLOADS-PERSISTENTES-RAILWAY.md`

## Objetivo

Mover la persistencia de archivos clinicos del filesystem efimero del backend Python a un Railway Storage Bucket S3-compatible ya provisionado, evitando `404 Not Found` y conservando trazabilidad de estudios, snapshots y regeneracion IA.

## Contexto nuevo confirmado

El usuario ya provisiono un bucket S3-compatible en Railway.

Configuracion no sensible confirmada para este corte:

1. endpoint: `https://t3.storageapi.dev`
2. region: `auto`
3. bucket: `shelved-pod-d66dcokrpe-ik`

La credencial de acceso fue compartida por el usuario y debe tratarse como secreto operativo:

1. no se registra en archivos del repo
2. debe cargarse como variable segura en Railway para el servicio backend
3. cualquier secret key asociada debe mantenerse fuera de chat y fuera de git

Hallazgos de infraestructura y codigo:

1. el bucket existe, pero es privado por defecto
2. el backend actual sigue guardando binarios en `/uploads` local y devolviendo `file_url` relativo desde `api/v1/upload-only`
3. el frontend aun asume que `fileUrl` es una ruta relativa del backend y compone la URL como `apiBase + fileUrl`
4. Railway documenta tres patrones validos para buckets privados:
   - upload directo desde servicio
   - entrega via backend proxy
   - entrega via presigned URLs

## Problema a resolver

Aunque el bucket ya existe, el sistema actual no lo usa.

Por tanto, si no se cambia el flujo:

1. los uploads seguiran yendo al disco local efimero
2. `fileUrl` seguira apuntando a `/uploads/<archivo>`
3. el bucket no aportara persistencia real al expediente

## Decisión de arquitectura

La ruta activa aprobada es:

1. el backend sube el archivo al Railway Storage Bucket usando API S3-compatible
2. la base de datos conserva una referencia estable del objeto almacenado
3. el frontend deja de depender de `/uploads/*` como storage real
4. la entrega del archivo al navegador se hace por una ruta backend de proxy o redirect controlado

## Decisión de entrega al frontend

Para no romper de golpe el contrato de la UI actual, la V1 autorizada debe usar una ruta backend de lectura controlada.

Patron recomendado:

1. `fileUrl` deja de ser una URL publica inventada del bucket
2. `fileUrl` pasa a almacenar una ruta estable del producto, por ejemplo `/api/files/<key>` o equivalente
3. esa ruta backend valida la solicitud y responde de una de estas dos formas:
   - redirect temporal a presigned URL del bucket
   - proxy binario desde backend

Se prefiere redirect a presigned URL porque:

1. evita servir archivos grandes desde el backend
2. bucket egress es gratis en Railway
3. mantiene el bucket privado sin exponer credenciales

## Alcance aprobado

Incluye:

1. cliente S3-compatible en backend Python para Railway Storage Bucket
2. subida de archivos desde el backend al bucket
3. ruta backend para entrega controlada de archivos
4. ajuste de `fileUrl` para que apunte a una ruta estable del producto, no a `/uploads/*`
5. compatibilidad con visor embebido, apertura en nueva pestaña y regeneracion IA
6. validacion de persistencia real despues de restart o redeploy

No incluye:

1. bucket publico sin control
2. migracion masiva historica de archivos viejos ya perdidos
3. rediseño del flujo clinico
4. rediseño de base de datos

## Reglas obligatorias

1. no exponer credenciales S3 en frontend ni logs
2. no guardar como `fileUrl` una URL presignada efimera
3. `fileUrl` debe seguir siendo reutilizable por el expediente y por `regenerateStudyAI()`
4. el sistema debe soportar restart o redeploy sin perder acceso al archivo
5. no romper `upload-only`, `upload-and-analyze` ni la regeneracion de IA

## Diseño tecnico autorizado

### Backend storage

El backend debe resolver una abstraccion minima de storage con dos operaciones:

1. `put_file(bytes, filename) -> stable_product_path`
2. `resolve_file(fileUrl_or_key) -> redirect o stream`

Variables de entorno esperadas:

1. `STORAGE_S3_ENDPOINT=https://t3.storageapi.dev`
2. `STORAGE_S3_REGION=auto`
3. `STORAGE_S3_BUCKET=shelved-pod-d66dcokrpe-ik`
4. `STORAGE_S3_ACCESS_KEY` cargada como secreto seguro
5. `STORAGE_S3_SECRET_KEY` cargada como secreto seguro

Nota:

Los nombres exactos de variables pueden ajustarse en implementacion, pero la separacion entre valores no sensibles y secretos debe mantenerse.

### Ruta estable de producto

Se autoriza una ruta del backend tipo:

1. `/api/files/{object_key}`

Comportamiento esperado:

1. recibe la key del objeto
2. genera una presigned URL corta
3. responde con redirect o stream

### Frontend

El frontend debe tolerar dos casos:

1. `fileUrl` relativo del producto, que compone con `apiBase`
2. `fileUrl` absoluto `http` si en algun punto de transicion hiciera falta

## Archivos probables de implementacion

1. `backend/app/main.py`
2. `backend/requirements.txt`
3. `frontend/src/actions/event-test.actions.ts`
4. `frontend/src/actions/ai-prediagnosis.actions.ts`
5. `frontend/src/components/clinical/PapeletaWorkspace.tsx`
6. cualquier helper nuevo de storage en backend

## Validaciones obligatorias

1. subir un PDF y confirmar que el objeto aparece en bucket
2. abrir el estudio en la UI y verificar render del visor
3. abrir el archivo en nueva pestaña y verificar acceso
4. reiniciar o redeployar backend
5. reabrir la misma vista y confirmar que el archivo sigue disponible
6. ejecutar regeneracion IA desde `fileUrl` y confirmar que sigue pudiendo descargar el binario

## Criterios de aceptacion

1. los archivos nuevos ya no dependen del filesystem local de Railway
2. el expediente deja de mostrar `{"detail":"Not Found"}` para archivos nuevos validos
3. la lectura del documento sigue funcionando en visor embebido y nueva pestaña
4. `regenerateStudyAI()` sigue pudiendo descargar el archivo usando `fileUrl`
5. restart o redeploy ya no elimina el acceso al archivo

## Riesgos controlados

1. si se guarda una URL presignada efimera en DB, el archivo volvera a romperse horas o dias despues
2. si el backend cambia `fileUrl` a una key cruda sin ruta estable, el frontend actual fallara al componer URLs
3. si se mezcla migracion historica con nuevo flujo, se ampliara innecesariamente el slice

## Criterio de exito

El cambio sera exitoso cuando un archivo subido hoy al expediente quede almacenado en el bucket Railway, visible desde la UI y reusable por el pipeline IA aun despues de restart o redeploy.

## Referencias

1. `backend/app/main.py`
2. `frontend/src/actions/event-test.actions.ts`
3. `frontend/src/components/clinical/PapeletaWorkspace.tsx`
4. `https://docs.railway.com/storage-buckets/uploading-serving`