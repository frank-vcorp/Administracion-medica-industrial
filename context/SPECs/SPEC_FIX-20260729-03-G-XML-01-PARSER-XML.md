# SPEC-FIX-20260729-03 — Parser XML directo de audiometría no se está invocando (G-XML-01)

**ID:** `FIX-20260729-03-G-XML`
**Fecha:** 2026-07-29
**Prioridad:** P1 (Alta)
**Tipo:** Fix funcional (gap detectado por IMPL-20260729-02)
**Estado:** [~] Pendiente de aprobación INTEGRA / Frank

---

## 1. Problema

Durante la ejecución E2E `IMPL-20260729-02` (TC-09), al subir `context/PACIENTES/JESSICA GABRIELA.xml` en la papeleta de audiometría:

- El archivo XML llega al servidor.
- La acción lo encamina al pipeline IA V2 / Gemini.
- Backend responde `HTTP 400 Bad Request`.
- No se persiste `fileUrl`/`snapshot` utilizable.
- No aparecen las frecuencias `250`, `500`, `1000` en la papeleta.
- El parser XML directo (`audiometry_xml_parser.py`, <100 ms, 100% exacto, 0 tokens) NO se ejecuta.

Esto contradice:

- `context/SPECs/SPEC_ARCH-20260715-06-EXTRACCION-DIRECTA-XML-AUDIOMETRO.md` (cierre `1e7265d`): "Endpoint de calibración modificado para aceptar PDF o XML con prioridad: XML (parser directo, <100ms, 100% exacto, 0 tokens) > PDF (IA calibrada, 5-10s, ±5 dB, ~2000 tokens)."
- `context/SPECs/SPEC_IMPL-20260729-FLUJO-END-TO-END.md` §7.1: cuando el archivo es XML, invocar el parser directo.

## 2. Causa probable

La acción frontend `uploadEventTestFile` (o equivalente) o el server action que dispara el pipeline probablemente:

- No detecta el MIME type / extensión `.xml` antes de invocar el extractor IA.
- O el extractor V2/Gemini no tiene un guard que redirija a `audiometry_xml_parser.py` cuando el contenido es XML.
- O la ruta tomada omite el branch de detección de XML.

**Pendiente diagnóstico**: leer los archivos `frontend/src/actions/event-test.actions.ts`, `backend/app/services/event_service.py` (o `backend/app/api/v1/event_tests.py`) y el código de calibración/extractor V2 para localizar el punto exacto.

## 3. Solución esperada

1. **Detección previa de XML** en el camino de upload, antes de invocar IA:
   - Validar MIME type `application/xml` / `text/xml` o extensión `.xml`.
   - Validar opcionalmente un header mínimo (`<?xml`).
2. **Ruteo al parser directo**:
   - Llamar `audiometry_xml_parser.parse_audiometry_xml(content)` para extraer las 8 frecuencias × 2 oídos + PTA OD/OI.
   - Persistir en `EventTest.fileUrl`, snapshot en `aiCalibration` o en la columna correspondiente del modelo.
3. **Render bilateral**:
   - Asegurar que la papeleta muestre las 16 mediciones (8 frecuencias × 2 oídos) y PTA por oído.
4. **Prediagnóstico posterior** (separado):
   - Tras parsear XML correctamente, invocar el pipeline clínico (DR7.ai) sobre los umbrales extraídos.
5. **Trazabilidad**:
   - Mantener `parserVersion` en el snapshot (`XML_PARSER_V2`).
   - Mantener el orden clínico completo: `125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000`.

## 4. Alcance

**Incluido:**

- Archivos de actions/server actions que reciben uploads de `EventTest`.
- Archivos del backend FastAPI que enrutan el extractor de audiometría.
- Ajustes de UI si la tabla bilateral no se renderiza tras el fix.
- Reejecución de TC-09..TC-12 en `flujo-completo.spec.ts` (desbloqueo serial).

**Excluido:**

- Cambios al parser XML mismo (`audiometry_xml_parser.py` ya cerrado en `1e7265d`).
- Cambios al modelo Prisma.
- Cambios al frontend de presentación clínica (más allá de la tabla bilateral).
- Cambios al pipeline de espirometría.

## 5. Definition of Ready

- [x] Evidencia E2E documentada (TC-09 con upload real, error 400, sin snapshot).
- [x] SPEC firmada.
- [ ] Aprobación de Frank para abrir lote nuevo.
- [ ] Baseline frontend en verde (ya confirmado en `efd26fe`).

## 6. Definition of Done

- TC-09 E2E: el archivo `JESSICA GABRIELA.xml` se persiste con `fileUrl`, snapshot bilateral completo visible (8 × 2 frecuencias), PTA calculado OD=67 dB / OI=83 dB (según parser vigente), prediagnóstico clínico posterior generado.
- TC-10 E2E: reejecutar sin regresión (espirometría PDF intacta).
- TC-11 E2E: desbloqueado, ejecuta muestra de laboratorio.
- TC-12 E2E: desbloqueado, ejecuta dictamen final.
- Gates verdes: `npm run typecheck`, `npm test`, `npm run lint` siguen en 0/273/0.
- Commit + push autorizado por Frank.
- PROYECTO.md actualizado con cierre G-XML-01.

## 7. Estimación

| Tarea | Tiempo |
|---|---|
| Diagnóstico (lectura de actions + extractor V2) | 1 h |
| Implementación detección + ruteo | 1.5 h |
| Validación E2E TC-09..TC-12 | 1 h |
| Documentación y checkpoint | 0.5 h |
| **Total** | **~4 h** |

## 8. Riesgos

- **R1**: el camino actual puede tener un branch de detección que falla por validación de `Buffer`/`base64`. Diagnosticar primero.
- **R2**: el extractor V2 puede asumir que cualquier archivo es PDF/imagen; ajustar guardia.
- **R3**: el orden de las frecuencias puede alterarse en la persistencia; verificar con caso real Jessica Gabriela.

## 9. Estado

[~] Pendiente aprobación Frank
**Gating**: Independiente de IMPL-20260729-02 (puede ejecutarse en lote posterior).
**Próxima acción**: INTEGRA confirma con Frank; de aprobarse, abrir lote nuevo con handoff a SOFIA.
