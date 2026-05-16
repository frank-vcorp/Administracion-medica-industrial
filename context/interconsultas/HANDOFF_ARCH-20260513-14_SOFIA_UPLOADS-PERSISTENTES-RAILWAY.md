# HANDOFF ARCH-20260513-14 a SOFIA — Persistencia de Uploads en Railway

- ID: ARCH-20260513-14
- Fecha: 2026-05-13
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion

## Objetivo

Implementar y validar persistencia real de archivos en el backend Python desplegado en Railway para que las URLs `/uploads/<filename>` no regresen `404` despues de reinicios o redeploys.

## Punto de entrada real

1. `backend/app/main.py`
2. `backend/Dockerfile` si hiciera falta ajuste menor
3. configuracion del servicio backend en Railway

## Regla de arquitectura

Se mantiene el contrato actual:

1. el backend sigue sirviendo archivos por `/uploads/*`
2. `fileUrl` en base de datos no cambia de formato
3. la persistencia se resuelve con Railway Volume montado en `/uploads`

## Acciones obligatorias

1. crear o conectar un Railway Volume al servicio backend Python
2. mount path: `/uploads`
3. ajustar resolucion de ruta en backend con prioridad `UPLOAD_DIR` -> `RAILWAY_VOLUME_MOUNT_PATH` -> `/uploads`
4. asegurar `os.makedirs(upload_dir, exist_ok=True)` sobre la ruta efectiva
5. validar upload y relectura del archivo despues de restart o redeploy

## Entregables minimos

1. backend leyendo la ruta efectiva de uploads con fallback correcto
2. volume operativo en Railway montado en `/uploads`
3. evidencia de que una URL `/uploads/<archivo>` responde `200` antes y despues de restart
4. checkpoint tecnico con nombre del archivo probado y resultado de persistencia

## Validacion minima obligatoria

1. subir un PDF desde expediente real o flujo de prueba controlado
2. abrir la URL publica del archivo y confirmar render
3. reiniciar o redeployar backend
4. reabrir la misma URL y confirmar que sigue viva
5. comprobar que el iframe del estudio ya no muestra `{"detail":"Not Found"}`

## No resolver en este corte

1. buckets externos
2. CDN
3. reestructuracion de storage por tenant
4. correccion del bug de asociacion incorrecta de archivo a estudio, salvo que aparezca como defecto local y evidente del mismo slice