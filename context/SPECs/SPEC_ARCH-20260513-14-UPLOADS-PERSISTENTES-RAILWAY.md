# SPEC ARCH-20260513-14 — Persistencia de Uploads en Railway con Volume en /uploads

- ID: ARCH-20260513-14
- Fecha: 2026-05-13
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementacion

## Objetivo

Eliminar la perdida de archivos PDF e imagenes subidos al backend Python desplegado en Railway, garantizando que los archivos servidos en `/uploads/*` permanezcan disponibles despues de reinicios y redeploys.

## Problema observado

Durante la validacion operativa del expediente `c31afc56-ed85-43a9-9b0c-e5454bd53a71` se observo el siguiente patron:

1. el estudio acepta el archivo y la extraccion IA genera snapshot y valores estructurados
2. la URL publica del archivo queda registrada como `/uploads/<archivo>`
3. al intentar visualizar el PDF, Railway responde `404 Not Found`
4. el iframe del frontend muestra `{"detail":"Not Found"}`

La evidencia tecnica del repo indica que el backend escribe en filesystem local del contenedor:

1. `UPLOAD_DIR = _read_env_var("UPLOAD_DIR") or "/uploads"`
2. `app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")`
3. el `Dockerfile` solo crea la carpeta `/uploads`, pero no prueba ni exige un volumen persistente

## Hipotesis controladora

El backend esta guardando binarios en disco local efimero del servicio Railway. La base de datos conserva la referencia `fileUrl`, pero el archivo deja de existir fisicamente tras un reinicio, cambio de contenedor o despliegue.

## Decisión de arquitectura

La solucion V1 autorizada es montar un Railway Volume directamente en `/uploads` para el servicio backend Python, manteniendo sin cambios el contrato actual de URLs publicas `/uploads/<filename>`.

Se evita por ahora migrar a bucket externo porque:

1. el problema principal es persistencia, no distribucion global
2. el contrato actual del sistema ya depende de `/uploads/*`
3. el cambio con volume es el corte mas corto, reversible y compatible con el flujo vigente

## Alcance aprobado

Incluye:

1. configurar un Railway Volume montado en `/uploads` para el backend
2. endurecer el backend para que use `UPLOAD_DIR` y, si aplica, soporte `RAILWAY_VOLUME_MOUNT_PATH`
3. validar que el archivo quede accesible por URL inmediatamente despues del upload
4. validar que el mismo archivo sobreviva a restart o redeploy del servicio
5. conservar el contrato publico `/uploads/<filename>`

No incluye:

1. migracion a S3, GCS o bucket externo
2. versionado de archivos o CDN
3. cambios al esquema Prisma o a la base de datos
4. rediseño de la UI de estudios

## Reglas obligatorias

1. no romper endpoints `api/v1/upload-only`, `api/v1/upload-and-analyze` ni `api/v2/studies/upload-and-analyze`
2. no cambiar la estructura de `fileUrl` persistida en base de datos
3. no depender de una ruta distinta entre local, Docker y Railway sin fallback explicito
4. si no existe volumen en desarrollo local, el sistema debe seguir funcionando con `/uploads`

## Diseño tecnico autorizado

### Infraestructura Railway

1. crear un Volume en Railway y conectarlo al servicio backend Python
2. mount path obligatorio: `/uploads`
3. si Railway expone `RAILWAY_VOLUME_MOUNT_PATH`, el backend puede usarlo como fallback cuando `UPLOAD_DIR` no este definido

### Backend

El backend debe resolver la carpeta de uploads con esta prioridad:

1. `UPLOAD_DIR`
2. `RAILWAY_VOLUME_MOUNT_PATH`
3. `/uploads`

La ruta resultante debe:

1. existir en startup
2. montarse como static files en `/uploads`
3. usarse para escritura fisica en todos los endpoints de upload y firmado PDF

### Compatibilidad

Local y Docker siguen operando con `/uploads`.

En Railway, la persistencia real depende de que el volume este efectivamente montado en ese path.

## Archivos objetivo de implementacion

1. `backend/app/main.py`
2. `backend/Dockerfile` solo si se requiere ajuste menor de bootstrap o permisos
3. documentacion operativa o checkpoint de validacion final

## Validaciones obligatorias

1. subir un PDF desde el flujo de expediente y confirmar que `/uploads/<archivo>` responde `200`
2. abrir el mismo archivo en nueva pestana y verificar que el PDF renderiza
3. reiniciar o redeployar el servicio backend en Railway
4. reabrir la misma URL y confirmar que sigue respondiendo `200`
5. confirmar que el estudio sigue mostrando `Archivo vinculado` sin `Not Found`

## Criterios de aceptacion

1. un archivo subido al backend queda visible por URL publica inmediatamente
2. el mismo archivo permanece accesible despues de restart o redeploy en Railway
3. el frontend deja de mostrar `{"detail":"Not Found"}` para archivos validos recien subidos
4. el flujo actual de estudios no cambia para el usuario
5. no se introduce cambio de contrato en `fileUrl`

## Riesgos controlados

1. si el volumen se monta en otra ruta distinta a `/uploads`, las URLs seguiran existiendo pero el binario no se servira correctamente
2. si el backend no prioriza correctamente la ruta, local y produccion pueden divergir
3. si el frontend sigue asociando el archivo al estudio equivocado, la persistencia resolvera el 404 pero no la trazabilidad clinica

## Criterio de exito

El cambio sera exitoso cuando un PDF cargado en un estudio permanezca disponible y visible por URL publica aun despues de reiniciar o redeployar el servicio backend en Railway.

## Referencias

1. `backend/app/main.py`
2. `backend/Dockerfile`
3. `frontend/src/actions/event-test.actions.ts`
4. `https://docs.railway.com/volumes`