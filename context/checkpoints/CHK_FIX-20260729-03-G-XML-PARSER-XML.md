# CHK_FIX-20260729-03-G-XML — Cierre SOFIA: Parser XML directo en papeleta

**ID intervención:** IMPL-20260729-03 (SOFIA)
**Fecha:** 2026-07-29 08:15 CST
**Responsable:** SOFIA
**Aprobación:** Frank aprobó `FIX-20260729-03-G-XML-01-PARSER-XML`

---

## 1. Resumen ejecutivo

| SPEC                                | Estado        | Resultado                                                |
| ----------------------------------- | ------------- | -------------------------------------------------------- |
| Detección XML en `uploadEventTestFile` | ✅ Implementado | Helper `isXmlFile` con 3 capas (MIME + ext + magic bytes) |
| Endpoint backend XML directo        | ✅ Implementado | `POST /api/v2/event-tests/upload-xml-audiometry`        |
| Persistencia snapshot `data_source="xml_direct"` | ✅ Implementado | `modelName='xml_parser'`, `promptVersion='xml_direct_v1'` |
| Prediagnóstico posterior (DR7.ai)   | ✅ Implementado | Reusa `prediagnostic_svc` vigente                       |
| Contrato público preservado         | ✅ Cumple     | `extractionSnapshotData` + `aiAnalysis` shape intactos  |
| Gates frontend verdes               | ✅ PASS       | typecheck 0 / vitest 273/273 / lint 0                   |
| TC-09..TC-12 E2E contra prod        | ⏳ Bloqueado | Cambios locales; deploy por INTEGRA pendiente           |

## 2. Archivos modificados

1. `backend/app/main.py` (+336)
   - Nuevo endpoint `v2_event_test_upload_xml_audiometry`
   - Helper `_sanitize_xml_options` (réplica local mínima para no acoplar al router de calibración)
   - Helper `_list_xml_missing_fields` para `missing_fields` del snapshot
   - Import añadido: `tempfile`

2. `frontend/src/actions/event-test.actions.ts` (+368/-1)
   - Helper `isXmlFile(file)` con detección MIME/ext/magic-bytes
   - Helper `uploadXmlAudiometryDirect(...)` para llamar al nuevo endpoint
   - Helper `persistXmlDirectSnapshots(...)` que persiste `StudyExtractionSnapshot` + `AIPrediagnosisSnapshot` con misma semántica de supersedencia que V2
   - Rama XML en `uploadEventTestFile` antes del flujo V2
   - Import añadido: `Prisma` desde `@prisma/client`

**Total: 2 archivos de producto.** Cumple el límite de 4 archivos backend/frontend.

## 3. Validaciones

| Gate                  | Comando                        | Resultado |
| --------------------- | ------------------------------ | --------- |
| typecheck             | `cd frontend && npm run typecheck` | PASS (0 errores) |
| vitest                | `cd frontend && npm test`      | PASS (273/273) |
| lint                  | `cd frontend && npm run lint`  | PASS (0 errores / 0 warnings) |
| parser XML directo    | `parse_audiometry_xml(JESSICA GABRIELA.xml)` | OK — OD PTA=67, OI PTA=83 (matches SPEC §6) |
| E2E prod (TC-01..TC-12) | `npx playwright test flujo-completo.spec.ts --project=chromium --timeout=300000 --reporter=line` | TC-01..TC-08 PASS (8/8); TC-09 FAIL (gap funcional aún visible en prod, esperado — fix local no desplegado); TC-10..TC-12 NOT RUN por serial gating. |

Audits en:
- `context/audits/g-xml-01-after-typecheck.txt`
- `context/audits/g-xml-01-after-vitest.txt`
- `context/audits/g-xml-01-after-lint.txt`
- `context/audits/g-xml-01-after-e2e.txt`

## 4. Diseño

### 4.1 Backend (`POST /api/v2/event-tests/upload-xml-audiometry`)

Pipeline:
1. Validar file (extensión `.xml` + magic bytes `<?xml` / `<LocalSession`)
2. Validar `event_test_id` y resolver `EventTest` → `MedicalTest` para extraer `aiCalibration`
3. Persistir archivo en `/uploads` (o S3 si está habilitado)
4. `parse_audiometry_xml(local_path)` → extracción pura (~50 ms, 0 tokens)
5. `prediagnostic_svc.generate_prediagnosis('Audiometria', extracted, ai_calibration)` → DR7.ai (~5-10 s)
6. Retornar shape idéntico a `v2_upload_and_analyze` con:
   - `data_source: "xml_direct"` (trazabilidad)
   - `extraction_snapshot.audit.model_name: "xml_parser"`
   - `extraction_snapshot.audit.prompt_version: "xml_direct_v1"`

Manejo defensivo:
- Si `parse_audiometry_xml` falla → 400 con detalle + cleanup del archivo
- Si `prediagnostic_svc` no inicializado → snapshot con `clinical_state: AI_PENDING_REVIEW` + nota de auditoría `xml_direct_no_ai` (revisión médica manual posible)
- Si DR7.ai falla → snapshot con `clinical_state: AI_PENDING_REVIEW` + nota `xml_direct_prediagnosis_failed` (extracción XML sí persiste)

### 4.2 Frontend (`uploadEventTestFile`)

Flujo de decisión:
1. Cargar EventTest desde Prisma → resolver `canonicalType`
2. **NUEVO:** Si `isAIEligible && canonicalType === 'Audiometria' && isXmlFile(file)`:
   - Llamar `uploadXmlAudiometryDirect(apiBase, eventTestId, file, triggeredByUserId)`
   - Si success: `persistXmlDirectSnapshots(...)` → `prisma.eventTest.update` → retornar shape compatible con V2
   - Si fallo: retornar error sin caer a Gemini (causa original del gap)
3. Si no es XML o no es audiometría: continuar al flujo V2 existente (sin cambios)

Contrato preservado:
- `success: boolean`
- `fileUrl: string`
- `extractionSnapshotData: { id, version, extractedData, missingFields, rawPayload }`
- `aiAnalysis: { extractionSnapshotId, prediagnosisSnapshotId, clinicalState, summary, confidence }`

Sin cambios en `PapeletaWorkspace.tsx`.

## 5. Riesgos / desviaciones

- **R1 (cierre):** El backend actualmente en producción NO tiene el endpoint nuevo. Hasta que INTEGRA commitee y Vercel/Railway redespliegue, TC-09 seguirá fallando con el gap original. **Mitigación:** código listo, gates verdes, auditoría reproducible. Deploy pendiente de INTEGRA.
- **R2:** `prediagnostic_svc` puede estar caído en algunos entornos. El endpoint XML maneja este caso retornando un snapshot con `clinical_state: AI_PENDING_REVIEW` y nota de auditoría — la extracción XML queda persistida igual para que el médico revise manualmente.
- **R3:** Si el navegador reporta `file.type=''` para un XML (caso raro pero posible), la detección cae al extension check y al magic bytes. 3 capas defensivas cubren los escenarios comunes.
- **R4:** Si llega un XML que NO es del audiómetro DD65 V2 (otro formato XML médico), el parser `parse_audiometry_xml` puede lanzar `ValueError`. El endpoint retorna 400 con detalle — el frontend NO reintenta Gemini, propagando el error al usuario para diagnóstico.

## 6. Pendientes INTEGRA

1. **Commit + push** del branch actual (Frank lo autoriza).
2. **Verificar redespliegue** de Railway (backend) y Vercel (frontend) automático.
3. **Reejecutar E2E** `frontend/tests/flujo-completo.spec.ts --project=chromium --timeout=300000 --reporter=line` para confirmar TC-09..TC-12 PASS post-deploy.
4. **Actualizar PROYECTO.md** con cierre de G-XML-01.
5. **Cerrar SPEC** `SPEC_FIX-20260729-03-G-XML-01-PARSER-XML.md`.

## 7. Notas de rollback (recomendadas, no ejecutadas)

Si el endpoint nuevo causa regresión:
1. Revertir `backend/app/main.py` → elimina endpoint (cambio aditivo, no toca código existente).
2. Revertir `frontend/src/actions/event-test.actions.ts` → restaura imports y elimina helpers + rama XML.

Ambos cambios son aditivos (no modifican código existente del flujo V2), por lo que el rollback es seguro.

## 8. Self-review

| Aspecto                                  | Cumplido |
| ---------------------------------------- | -------- |
| Código refleja exactamente la SPEC       | ✅       |
| No IDs/marcas de agua en código          | ✅       |
| Cobertura de criterios SPEC §3           | ✅ (5/5) |
| Casos borde: archivo vacío, MIME raro, magic bytes | ✅ (3 capas) |
| Casos borde: parser falla, IA caída      | ✅ (cleanup + fallback defensivo) |
| Riesgos de regresión: contrato V2 intacto | ✅ (shape compatible verificado) |
| Contratos no tocados: schema Prisma, parser XML, calibration.py | ✅ (solo lectura / additive) |
| Gates frontend verdes                    | ✅ (0/273/0) |

