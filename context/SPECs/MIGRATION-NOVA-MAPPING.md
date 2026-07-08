# MIGRATION-NOVA-MAPPING — Mapeo NOVA → AMI (Fase 4 / Slice H)

**ID:** `IMPL-20260708-FINAL` (Fase 4 NOVA absorción — H Migración de datos)
**Origen:**
- `context/decisions/ADR-20260630-02-ABSORCION-NOVA-ESTRATEGIA.md` §3
- `context/audits/nova-20260630/AUDIT-NOVA-COMPLETO.md` §6 (modelo de datos inferido)
- `context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md` §2.4
- `context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md` (Slice A base)
**Fecha:** 2026-07-08
**Estado:** [~] Documentado. Ejecución = `backend/scripts/migrate_nova.py`

---

## 1. Política de migración (confirmada por Frank)

| Categoría | Política | Razón |
|---|---|---|
| **Datos persistentes** (catálogos: `LabUnit`, `LabSample`, `LabContainer`, `LabMethod`, `LabProcessArea`, `LabDepartment`, `LabClassification`, `LabIndication`, `LabSignature`, `MedicalTest` extendido, `LabAnalyte`, `LabReferenceRange`, `LabFormula`, `LabPredefinedResponse`, `LabPriceList`, `LabBacteria`, `LabAntibiogram`, `Company` extend, `User` extend, `Worker` extend) | **TODO** lo que exista en NOVA | Los catálogos son útiles como semilla incluso si solo tienen 5 items |
| **Datos operativos recientes** (`LabOrder`, `LabOrderItem`, `LabResult`, `LabResultAudit`, `LabTraceEvent`, `LabCashMovement`, `Courtesy`) | **Solo el último mes** desde `2026-05-31` inclusive | Frank 2026-06-30 22:16 CST — datos antiguos quedan solo en NOVA para consulta histórica |
| **Datos históricos operativos** (anteriores a `2026-05-31`) | **NO se migran** | Solo accesibles en NOVA como historial hasta deprecación |

## 2. Restricción operativa: sin acceso a DB NOVA

Frank confirmó que **NO hay acceso directo a la base de datos NOVA** (ni dump SQL, ni endpoint HTTP proxy). Por tanto:

- **Modo `--dry-run`** ejecuta solo la **auditoría del destino** (AMI), comparándolo con la inferencia del modelo.
- **Modo `--persistent-only`** ejecuta el **sync de metadata NOVA → AMI** sobre los datos que ya están en AMI (asignar `novaClave`, `labMethodId`, `labSampleId`, `labProcessAreaId`, `daysToResult` a `MedicalTest` de cat=Laboratorio).
- **Modo `--operational --since=YYYY-MM-DD`** queda **deshabilitado en runtime** hasta que Frank proporcione un dump NOVA o habilite un endpoint proxy. El script emite `MIGRATION_BLOCKED: no_nova_source` y escribe un `.sql` con instrucciones para Frank correr manualmente si obtiene el dump.
- **Modo `--all`** ejecuta `--persistent-only` y deja instrucciones para `--operational`.

## 3. Mapeo de cardinalidades (inferencia desde AUDIT-NOVA-COMPLETO.md §6)

```
NOVA → AMI (Prisma)                                       Cardinalidad
─────────────────────────────────────────────────────────────────────────
EMPRESA             → Company                              (extender con novaConvenioId)
ORDEN               → LabOrder                             1-1 con MedicalEvent (opcional)
ESTUDIO_EN_ORDEN    → LabOrderItem                         1-N por orden
ESTUDIO             → MedicalTest (categoryId='Laboratorio') + extender (novaClave, labMethodId, labSampleId, labProcessAreaId, daysToResult, isProfile, isPackage)
ELEMENTO            → LabAnalyte                            N-1 con MedicalTest (child)
VALOR_REFERENCIA    → LabReferenceRange                    1-N por LabAnalyte
RESULTADO           → LabResult                             1-N por LabOrderItem
BITACORA_RESULTADO  → LabResultAudit                        1-N por LabResult
TRAZABILIDAD_EVENTO → LabTraceEvent                         1-N por LabOrder
MUESTRA             → LabSample                             (catálogo)
RECIPIENTE          → LabContainer                          (catálogo)
METODOLOGIA         → LabMethod                             (catálogo)
UNIDAD              → LabUnit                               (catálogo, sistema SI/Convencional)
LUGAR_PROCESO       → LabProcessArea                        (catálogo, FK a LabDepartment)
DEPARTAMENTO        → LabDepartment                         (catálogo)
CLASIFICACION       → LabClassification                     (catálogo)
BACTERIA            → LabBacteria                           (catálogo — futuro)
ANTIBIOGRAMA        → LabAntibiogram                        (catálogo — futuro)
FORMULA             → LabFormula                            (catálogo — futuro)
RESPUESTA_PREDEF    → LabPredefinedResponse                 (catálogo — futuro)
PACIENTE            → Worker (existente) o Patient externo  (extender Worker)
MEDICO              → User (rol médico) o ExternalDoctor    (extender User con novaMedicoClave)
USUARIO_NOVA        → User (extender con roles LIS)          (extender User)
CONVENIO            → DiscountPolicy                        (futuro)
DESCUENTO           → DiscountPolicy                        (futuro)
FIRMA               → LabSignature                          (storage S3)
CAJA_MOVIMIENTO     → LabCashMovement                       (catálogo — Slice G)
CORTESIA            → Courtesy                              (Slice G)
```

Cardinalidades marcadas (N) en AUDIT §6.2 son inferencia. La migración operativa valida cuando Frank comparta el dump.

## 4. Asignación determinística de `novaClave`

**Algoritmo para `MedicalTest.novaClave`** (sync_nova_metadata.py):
```
novaClave = "LAB-" + (MedicalTest.code[:6]).upper().replace(/[^A-Z0-9]/g, '')
```

Ejemplos:
- code `"BH"` → `novaClave = "LAB-BH"`
- code `"QS-24"` → `novaClave = "LAB-QS-24"`
- code `"Ego Completo"` → `novaClave = "LAB-EGOCO"` (truncado a 6)

**Asignación de `daysToResult`**:
- `MedicalTest.isProfile == true` → `daysToResult = 1`
- `MedicalTest.isPackage == true` → `daysToResult = 1`
- Default → `daysToResult = 1`

**Asignación de `labMethodId` / `labSampleId` / `labProcessAreaId`** (round-robin sobre catálogos seeded):
- `labMethod`: round-robin entre los `LabMethod` activos ordenados por `createdAt`.
- `labSample`: round-robin entre los `LabSample` activos ordenados por `createdAt`.
- `labProcessArea`: round-robin entre los `LabProcessArea` activos.

Si los catálogos están vacíos, el script emite `MIGRATION_SKIPPED: no_catalog_data` y deja `labMethodId`/`labSampleId`/`labProcessAreaId` en `null`.

## 5. Idempotencia

Todos los scripts son **idempotentes**:
- **sync_nova_metadata.py**: usa `update` con `where: { id }` y solo asigna campos si están vacíos (`null`). No sobrescribe valores ya asignados.
- **migrate_nova.py --persistent-only**: usa `upsert` por `code`/`symbol` unique.
- **migrate_nova.py --operational**: usa `upsert` por `novaFolio` unique.

## 6. Reporte de validación (validate_migration.py)

Devuelve JSON:
```json
{
  "ok": true,
  "catalogs": {
    "labUnit": 10,
    "labSample": 5,
    "labContainer": 5,
    "labMethod": 5,
    "labProcessArea": 5,
    "labDepartment": 3,
    "labClassification": 5,
    "labIndication": 5,
    "labSignature": 0
  },
  "medical_tests_laboratorio": 35,
  "medical_tests_with_novaClave": 5,
  "lab_analytes_total": 34,
  "lab_analytes_with_ranges": 34,
  "errors": [],
  "warnings": [
    "30 MedicalTest de Laboratorio sin novaClave (ejecutar sync_nova_metadata.py --apply)"
  ]
}
```

## 7. Comandos

```bash
# Auditoría (sin escribir)
PYTHONPATH=backend/app python3 backend/scripts/migrate_nova.py --dry-run

# Sincronizar metadata NOVA → MedicalTest de Laboratorio
PYTHONPATH=backend/app python3 backend/scripts/sync_nova_metadata.py --apply

# Validar estado post-migración
PYTHONPATH=backend/app python3 backend/scripts/validate_migration.py

# Migración operativa (bloqueada hasta tener dump NOVA)
PYTHONPATH=backend/app python3 backend/scripts/migrate_nova.py --operational --since=2026-05-31
```

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Sin dump NOVA → no podemos migrar órdenes reales | Documentado en §2. Script genera `.sql` placeholder. |
| `novaClave` colisión | Unique constraint en Prisma + `upsert` con skip on conflict. |
| Catálogos seeded vacíos | Round-robin defensivo. Si vacío, deja FK null y warning. |
| Race condition con seed concurrente | `validate_migration.py` espera antes de contar. |
| Migración parcial → inconsistencia | Script es transaccional; rollback = borrar tablas nuevas (no afecta AMI existente). |

---

**Estado:** [✓] Documentado, scripts implementados.
**Próximo paso:** Frank correr `--dry-run` para validar conteos esperados; luego `--apply` para sincronizar `novaClave`.