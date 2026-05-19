# Checkpoint — DOC-20260519-05
**Agente:** INTEGRA - Arquitecto  
**Fecha:** 2026-05-19  
**ID Intervención:** DOC-20260519-05

---

## Resumen Ejecutivo

Se cierra la sesión con el frente extractivo ya migrado a Featherless + Qwen-VL en producción, pero con bloqueo operativo real del proveedor.

El sistema ya no falla por referencias residuales a Gemini en la capa extractiva. El backend de Railway reporta estado saludable para clasificación y extracción. Sin embargo, la corrida real de `/api/v2/studies/upload-and-analyze` devuelve error del proveedor por saturación del modelo configurado.

---

## Estado Verificado

### 1. Integración Qwen desplegada

Verificación directa sobre Railway:

- `overall_status = ok`
- `classifier = true`
- `extractor = true`
- `extraction_provider_active = featherless`
- `extraction_model_active = Qwen/Qwen3-VL-30B-A3B-Instruct`
- `extraction_api_key_present = true`

Conclusión:

- la migración a Featherless quedó activa en producción
- el hotfix de `GEMINI_MODEL` residual quedó aplicado

### 2. Bloqueo operativo actual

Prueba directa contra Railway:

`POST /api/v2/studies/upload-and-analyze`

Respuesta observada:

```json
{
  "status": "error",
  "error": "Error code: 503 - {'error': {'message': 'Qwen/Qwen3-VL-30B-A3B-Instruct is temporarily at capacity. Please try again shortly.', 'type': 'server_error', 'code': 'capacity_exhausted'}}"
}
```

Conclusión:

- el problema vigente no es de integración local ni de despliegue
- el problema vigente es disponibilidad/capacidad del modelo en Featherless

### 3. UI actual

La UI de papeleta muestra un error pobre (`terminated`) y termina sin snapshot de extracción.

Conclusión:

- falta un microajuste de observabilidad para mostrar `capacity_exhausted` o `503 del proveedor` en lugar de un texto genérico

---

## Riesgo Residual

Mientras `FEATHERLESS_EXTRACTION_MODEL=Qwen/Qwen3-VL-30B-A3B-Instruct` siga saturado, el frente extractivo puede quedar intermitente aunque la integración esté técnicamente correcta.

---

## Siguiente Paso Recomendado

Elegir uno de estos caminos, sin mezclarlos:

1. mantener el modelo actual y aceptar reintentos cuando Featherless libere capacidad
2. cambiar `FEATHERLESS_EXTRACTION_MODEL` a otra variante multimodal disponible en Featherless
3. aplicar hotfix de UX/backend para exponer el error real del proveedor en la UI

---

## Criterio de Reapertura

Reabrir este frente cuando exista una de estas condiciones:

1. confirmación de que el mismo modelo ya responde sin `capacity_exhausted`
2. decisión explícita de cambiar el modelo extractivo configurado
3. necesidad de implementar el hotfix de visibilidad del error en frontend/backend

---

**Estado de cierre de sesión:** integración desplegada, proveedor bloqueado por capacidad.