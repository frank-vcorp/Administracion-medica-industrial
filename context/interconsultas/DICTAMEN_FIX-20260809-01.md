# DICTAMEN TÉCNICO: Baseline rota — 4 bloqueadores pre-IMPL (SPEC_ARCH-20260809-05)

- **ID:** FIX-20260809-01
- **Fecha:** 2026-08-09
- **Solicitante:** SOFIA / INTEGRA (IMPL-20260809-01 bloqueado antes de implementar `SPEC_ARCH-20260809-05-AI-KEYS-PROBE-CONEXION-DEFAULT-EXTRACCION.md`)
- **Estado:** ✅ VALIDADO (causa raíz verificada empíricamente en los 4 bloqueadores; fixes candidatos probados sin tocar el repo)
- **Autor:** DEBY (debugger)
- **Tipo:** L1/L2 — **NO requiere escalamiento L3** (ningún bloqueador exige decisión arquitectónica; hay 2 decisiones operativas pendientes de Frank, marcadas abajo)

> **Alcance de este dictamen:** solo diagnóstico + propuesta. **No se aplicó ningún fix.** Frank decide.

---

## Resumen ejecutivo

| # | Bloqueador | Causa raíz | Nivel | Fix | ¿Decisión de Frank? |
|---|---|---|---|---|---|
| 1 | Vitest: 27× `Unknown system error -122: write` | Cuota de usuario agotada en tmpfs `/tmp` (EDQUOT=122) por `/tmp/sync_hermes_backup` (9.1 GB, cron hermes sin rotación) | L1 (env) | Workaround `TMPDIR` (verificado) o limpieza de `/tmp` | Sí (borrar backups) |
| 2 | pytest: `ModuleNotFoundError: matplotlib` | Dependencia declarada en `requirements.txt:25` pero **no instalada** en el entorno local (Python 3.14) | L1 (env) | `pip install --user --break-system-packages "matplotlib>=3.5.0"` | Sí (política pip) |
| 3 | ESLint: 10 errores + 12 warnings | Deuda baseline: 8× comillas `"` sin escapar (4 archivos ajenos a la SPEC), 1× import sin usar, 1× error en alcance SPEC (→ #4), 12× directivas disable huérfanas (auto-fixables) | L1 | Mecánico (~15 líneas) + `eslint --fix` | Sí (¿incluir en este IMPL?) |
| 4 | `react-hooks/set-state-in-effect` en `AIProviderKeyManager.tsx:76` | La regla nueva (plugin react-hooks 7.1.1 vía eslint-config-next) marca el fetch-on-mount; el codebase ya usa disable-directives en 12 archivos | L1 | 1 línea: disable directive (verificado por empírico) | No |

**Orden recomendado de aplicación:** 1 → 2 → 4 → 3 → re-run gates → iniciar IMPL.

---

## A. Análisis de Causa Raíz (por bloqueador)

### A.1 Vitest — `Unknown system error -122: write` (27 errores, 0 tests ejecutados)

**Síntoma:** `pnpm test` (vitest 2.1.9) aborta con 27 "unhandled errors" `Unknown system error -122: write` en `resolveConfig.rBxzbVsl.js:6643 → writeFileHandle`. Frank verificó 162 GB libres y 3% inodos → **no es el disco general**.

**Hallazgo forense (evidencia):**

1. **errno -122 = `EDQUOT` (Disk quota exceeded)** — confirmado: `python3 -c "import errno; print(errno.EDQUOT)"` → `122`. No es ENOSPC (28). Node/libuv reporta el errno negativo sin mapear a nombre → "Unknown system error".
2. **`/tmp` NO está en el disco general:** es un **tmpfs de 12 GB montado con `usrquota`**:
   ```
   tmpfs on /tmp type tmpfs (rw,nosuid,nodev,size=12039512k,nr_inodes=1048576,inode64,usrquota)
   tmpfs  12G  9.2G  2.3G  80% /tmp     ← df -h
   ```
   Frank midió `/dev/sda1` (162 GB libres), que es un filesystem distinto al que usa Node para temporales.
3. **El consumidor:** `/tmp/sync_hermes_backup` = **9.1 GB, 1216 subdirectorios** timestamped (desde 2026-08-04 22:45, uno cada 5 min), owner `frank`.
4. **Prueba definitiva de cuota agotada:** `dd if=/dev/zero of=/tmp/probe.bin bs=1M` → `dd: IO error: Disk quota exceeded` con archivo de **0 bytes** — la cuota de usuario de frank en `/tmp` está 100% agotada; **cualquier** escritura a `/tmp` falla al instante. Escritura equivalente en `/dev/shm` (tmpfs sin cuota): OK a 889 MB/s.
5. **Origen del backup descontrolado:** cron `*/5 * * * * /home/frank/.hermes/scripts/sync_hermes.sh pull` (crontab de frank). El script (`~/.hermes/scripts/sync_hermes.sh:129-151`) usa `rsync --delete --backup --backup-dir=<ts>` **sin rotación**: cada archivo sobrescrito/borrado se acumula para siempre. Esta máquina es `vps-contabo`; el directorio local `~/.local/state/sync_hermes_backup` pesa solo 13 M (pull local), así que los 9.1 GB en `/tmp` provienen del **`push` que corre en la laptop** (dest remoto = este VPS → `--backup-dir=/tmp/...` se materializa aquí). Efecto colateral: con la cuota agotada, el mecanismo de backup del sync ya está fallando silenciosamente.
6. **Por qué 27 errores:** uno por escritura interna fallida de Vitest (caché/IPC por test file); no son 27 tests fallando — **no llegó a ejecutar ninguno**.

**Causa raíz:** `os.tmpdir()` = `/tmp` (tmpfs con cuota por usuario) + backup de hermes sin rotación agotó la cuota → EDQUOT en toda escritura a `/tmp` → Vitest (que escribe temporales/transform cache en tmpdir) aborta. **No es bug de Vitest, ni de watchers, ni de permisos, ni de la config `vitest.config.ts` (que es correcta).**

**Verificación del workaround (sin tocar el repo):**
```
TMPDIR=/dev/shm pnpm test
→ Test Files  27 passed (27) | Tests  460 passed (460) | Duration 6.06s
```
**Los 460 tests pasan.** El baseline de tests frontend está sano; solo el entorno lo bloquea.

---

### A.2 pytest backend — `ModuleNotFoundError: No module named 'matplotlib'`

**Síntoma:** `pytest tests -q` aborta en collection:
```
tests/test_pdf_ebook_writer.py:28: in <module>
    from app.services.reports.pdf_ebook_writer import generar_ebook
app/services/reports/pdf_ebook_writer.py:80: in <module>
    import matplotlib
E   ModuleNotFoundError: No module named 'matplotlib'
```

**Hallazgo forense:**

1. **Es import directo de módulo, NO opcional:** `pdf_ebook_writer.py:80-83`:
   ```python
   import matplotlib
   matplotlib.use("Agg")  # CRÍTICO: backend non-interactive
   import matplotlib.pyplot as plt
   ```
   El módulo completo renderiza mini-gráficas con matplotlib (líneas 549-700+); no es un import accesorio.
2. **La dependencia SÍ está declarada:** `backend/requirements.txt:25` → `matplotlib>=3.5.0` (añadida por IMPL-20260701-01). **El entorno local está desincronizado con requirements.txt** — no es un problema de código.
3. **Entorno:** Python 3.14.4 del sistema, paquetes en `~/.local/lib/python3.14/site-packages` (PEP 668 — requiere `--break-system-packages`; así se instalaron fastapi/reportlab/etc. ya presentes). `pip show matplotlib` → no instalado; `import matplotlib` → falla.
4. **Instalabilidad confirmada (dry-run):** `pip install --dry-run --user --break-system-packages "matplotlib>=3.5.0"` → `Would install contourpy-1.3.3 cycler-0.12.1 kiwisolver-1.5.0 matplotlib-3.11.1` (wheels cp314 disponibles).
5. **La app está protegida; los tests no:** `massive_report.py:308-309` hace import lazy de `pdf_ebook_writer` ("Import local: pdf_ebook_writer importa matplotlib/reportlab pesados"), así que el arranque de la API no cae. Pero `test_pdf_ebook_writer.py:28` importa directo → collection error.
6. **Estado del resto de la suite** (`pytest --ignore=tests/test_pdf_ebook_writer.py`): **289 passed, 5 failed**:
   - 3× `test_reports.py::test_generar_reporte_masivo_{both,ebook,legacy_pdf}` → mismo `ModuleNotFoundError` vía import lazy al ejecutar el path ebook. **Se curan con el install.**
   - 2× `test_pdf_services.py::TestReportService` → **fallos de contrato preexistentes, NO relacionados con matplotlib** (ver §A.2.bis).

**Causa raíz:** dependencia declarada pero nunca instalada en el entorno local actual (Python 3.14). **Descartado** el refactor try/except: matplotlib es dependencia dura del módulo (se usa en ~10 funciones de render), requirements ya lo declara, y hacerlo opcional enmascararía la dependencia real con degradación silenciosa de los PDFs.

#### A.2.bis — Hallazgo adicional: 2 tests obsoletos preexistentes (fuera de alcance SPEC)

`backend/tests/test_pdf_services.py` (2 fallos que sobrevivirán al install de matplotlib):

1. **`test_generate_json_report_empty_data`** (`test_pdf_services.py:162`): espera `status=="error"` con lista vacía; la implementación (`app/services/pdf/reporter.py:121-160`) no tiene guard de vacío y retorna `"success"` con `records_count: 0` (comportamiento consistente y válido). **Test obsoleto vs. implementación actual.**
2. **`test_batch_process_success`** (`test_pdf_services.py:205`): asserts `result["records_count"] == 3 or result.get("total_records") == 3`; `batch_process` (`reporter.py:262+`) retorna `{status, generated_files, errors, batch_id}` sin propagar `records_count`/`total_records` al nivel batch (esos keys existen solo en los resultados por-formato, líneas 102/142/155/250). **KeyError — el test espera un contrato que batch_process nunca cumple.**

Ambos son ajenos a la SPEC_ARCH-20260809-05 (reportes PDF, no AI keys). Ver §B.2 para opciones de fix.

---

### A.3 ESLint — 10 errores + 12 warnings (inventario completo)

Config: `eslint.config.mjs` con `eslint-config-next` (core-web-vitals) → plugin `react-hooks` **7.1.1** (incluye la regla nueva `react-hooks/set-state-in-effect`). Baseline ya documentado en el config (`FIX-20260729-01-BASELINE`).

**Errores (10):**

| Archivo | Línea(s) | Regla | ¿Alcance SPEC-05? |
|---|---|---|---|
| `src/components/admin/AIProviderKeyManager.tsx` | 76:10 | `react-hooks/set-state-in-effect` | **SÍ** (la SPEC extiende este componente) |
| `src/app/branches/page.tsx` | 68:56, 68:74 | `react/no-unescaped-entities` (`"Mostrar inactivas"`) | No |
| `src/app/companies/[id]/CompanyMedicalProfilesPanel.tsx` | 645:49, 645:62 | `react/no-unescaped-entities` (`"{testSearch}"`) | No |
| `src/components/companies/SelfRegistrationForm.tsx` | 987:60, 987:76 | `react/no-unescaped-entities` (`"Alta de Cliente"`) | No |
| `src/components/mobile-units/MobileUnitManager.tsx` | 125:56, 125:66 | `react/no-unescaped-entities` (`"inactivas"`) | No |
| `tests/branches-debug.spec.ts` | 1:16 | `@typescript-eslint/no-unused-vars` (`expect` importado sin usar) | No |

Los 8 errores de unescaped-entities son comillas literales `"` en texto JSX; render-identicas si se escapan como `&quot;`. El archivo de debug es un spec Playwright residual: `import { test, expect, chromium } from '@playwright/test'` sin usar `expect`.

**Warnings (12):** todos idénticos — `Unused eslint-disable directive (no problems were reported from 'react-hooks/set-state-in-effect')` en 12 archivos (`appointments/overview/page.tsx:71`, `appointments/page.tsx:102`, `LabOrderAutocomplete.tsx:50`, `LabOrderForm.tsx:187`, `LabOrdersList.tsx:77`, `PendingOrdersTable.tsx:45`, `AppointmentFormModal.tsx:85`, `ProjectFormModal.tsx:96`, `AntecedentesForm.tsx:99`, `PapeletaWorkspace.tsx:340`, `TraceabilidadLigera.tsx:148`, `MobileUnitSelector.tsx:37`). Son directivas disable añadidas cuando la regla disparaba ahí; la heurística del plugin 7.1.1 ya no dispara en esos puntos y quedaron huérfanas. **Auto-fixables:** el propio ESLint reporta `0 errors and 12 warnings potentially fixable with the --fix option` (elimina los comentarios muertos; cero cambio de comportamiento).

**Nota de gate:** AC-16 exige "0 errores nuevos" en lint, pero `pnpm lint` exitúa 1 por el baseline aunque el código nuevo sea limpio. Si el gate corre `pnpm lint` plano, fallará igual → conviene sanear el baseline completo (ver §B.3).

---

### A.4 `set-state-in-effect` en `AIProviderKeyManager.tsx:76`

**Patrón actual** (líneas 64-77):
```tsx
const reload = useCallback(async () => {
  setError(null)                      // ← setState síncrono antes del await
  const result = await listAIProviderKeys()
  if (!result.ok || !result.providers) { setError(...); setProviders([]); return }
  setProviders(result.providers)
}, [])

useEffect(() => {
  void reload()                       // ← 76:10 — la regla marca aquí
}, [reload])
```

La regla (nueva en react-hooks 7.x, era React 19) marca setState alcanzable síncronamente desde el cuerpo del effect. Es el patrón fetch-on-mount clásico; el codebase ya lo maneja con disable-directives en 12 archivos (convención establecida).

**Matriz empírica de fixes** (verificado con `eslint --stdin --stdin-filename=...` sobre copias parcheadas en `/dev/shm`, sin tocar el repo):

| Variante | Cambio | Resultado |
|---|---|---|
| Original | — | ❌ error 76:10 |
| **A: disable directive** | +1 línea `// eslint-disable-next-line react-hooks/set-state-in-effect -- ...` | ✅ **0 problems** |
| B: mover `setError(null)` después del `await` | 2 líneas movidas | ❌ sigue disparando |
| C: quitar `void` a la llamada | 1 carácter | ❌ sigue disparando |
| D: `reload` como function declaration en vez de useCallback | refactor | ❌ sigue disparando |
| E: fetch inline en el effect con guard de cancelación (`let cancelled`) | +11 líneas, duplica lógica de reload | ✅ 0 problems |

**Conclusión:** la heurística de la regla no se satisface con reordenar setStates en este caso; solo la directiva (A) o el patrón textbook con cancelación (E) limpian el error. E duplica la lógica que `reload` ya centraliza (reutilizado en `onSaved`/`onDeleted`, líneas 108/119) y añade 11 líneas; A es 1 línea, cero cambio de comportamiento, y es exactamente la convención del codebase.

---

## B. Justificación de la Solución (quick-fixes propuestos, NO aplicados)

### B.1 Vitest (L1 env — reversible, riesgo cero)

**Workaround inmediato (recomendado para desbloquear el IMPL ya):**
```bash
mkdir -p "$HOME/tmp" && TMPDIR="$HOME/tmp" pnpm test     # disco real, sin cuota
# alternativa verificada: TMPDIR=/dev/shm pnpm test      # 460/460 pass en 6s
```
- Si se quiere permanente sin depender de la env por comando: añadir `TMPDIR=$HOME/tmp` al script `test` de `package.json` o al entorno del agente. **No se recomienda** fijarlo en `vitest.config.ts` (no es un problema del proyecto, es del entorno).
- **Riesgo de regresión: cero.** Los 460 tests ya pasan con el workaround; es una variable de entorno acotada.

**Fix de raíz (requiere OK de Frank — destructivo + infra):**
1. Limpiar `/tmp/sync_hermes_backup` (9.1 GB de snapshots rsync de `~/.hermes`; los archivos vivos siguen en `~/.hermes`, los backups son versiones sobrescritas recuperables de la laptop). Sugerencia: conservar solo últimos 7 días.
2. Añadir rotación: el bug de diseño está en `sync_hermes.sh` (líneas 137-143: `--backup-dir` sin pruning). Opciones: cron de pruning en el VPS (`find /tmp/sync_hermes_backup -maxdepth 1 -mtime +7 -delete`) o parchear el script para rotar. **Ojo:** el path `/tmp/...` lo decide el script que corre en la **laptop** (push), así que el fix estructural toca ese nodo; el pruning en VPS es suficiente como mitigación. Además, backups en tmpfs se pierden en reboot → moverlos a disco si se quieren conservar. → **Ticket INFRA separado**, no parte de esta SPEC.

### B.2 matplotlib (L1 env — aditivo, riesgo ~cero)

```bash
pip install --user --break-system-packages "matplotlib>=3.5.0"
```
- Instalación aditiva de una dependencia **ya declarada** en `requirements.txt:25`; dry-run confirma wheels cp314 (matplotlib 3.11.1 + contourpy/cycler/kiwisolver).
- **Rechazado** mover el import a try/except: dependencia dura del módulo; enmascararla degradaría los PDFs silenciosamente y contradice requirements.txt.
- **Riesgo de regresión: ~cero** (paquete nuevo, sin tocar código). Tras el install: collection se cura + 3 fallos de `test_reports.py` se curan.
- **Observación secundaria (no bloquea):** el entorno local también carece de `uvicorn` y `prisma` (cliente Python, `requirements.txt:40`). No afectan a pytest hoy, pero si el IMPL necesita arrancar el backend local, instalar también: `pip install --user --break-system-packages uvicorn "prisma==0.15.0"`.

**Los 2 tests obsoletos de `test_pdf_services.py` (§A.2.bis)** requieren decisión menor de Frank/SOFIA durante el IMPL (no bloquean collection):
- Opción recomendada para `test_batch_process_success`: añadir 1 línea aditiva en `batch_process` → `results["records_count"] = len(data_list)` (cumple el contrato que el test espera, sin cambiar nada más).
- Para `test_generate_json_report_empty_data`: actualizar el test a `status=="success"` + `records_count==0` (comportamiento implementado y consistente), **o** añadir guard de vacío en la implementación si Frank prefiere el contrato original del test. Recomendación: actualizar el test (cero cambio de runtime).

### B.3 ESLint baseline (L1 mecánico — decidir si entra en este IMPL)

**En alcance SPEC (obligatorio para el IMPL):**
- `AIProviderKeyManager.tsx:76` → ver B.4.

**Fuera de alcance (recomendado para dejar `pnpm lint` verde; ~15 líneas mecánicas):**
1. 4 archivos con `"` literales → reemplazar por `&quot;` (render idéntico):
   - `branches/page.tsx:68` — `toggle "Mostrar inactivas" arriba`
   - `CompanyMedicalProfilesPanel.tsx:645` — `coincide con "{testSearch}"`
   - `SelfRegistrationForm.tsx:987` — `la presente "Alta de Cliente"`
   - `MobileUnitManager.tsx:125` — `filtradas como "inactivas"`
2. `tests/branches-debug.spec.ts:1` → quitar `expect` del import (1 línea). Alternativa: borrar el spec de debug residual (requiere OK explícito — no lo recomiendo sin confirmación).
3. 12 warnings de directivas huérfanas → `pnpm exec eslint --fix` (elimina comentarios muertos; el propio ESLint los declara fixables). Cero riesgo.
- **Riesgo de regresión: cero** (escapado de entidades render-identico, import sin uso, comentarios).

### B.4 set-state-in-effect (L1 — 1 línea, convención del codebase, verificado)

En `AIProviderKeyManager.tsx`, dentro del `useEffect` (línea 75-77):
```tsx
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del listado de keys; setState solo tras await de server action (FIX-20260809-01).
  void reload()
}, [reload])
```
- **Por qué A y no E:** E (fetch inline + cancelación) es el patrón textbook pero duplica la lógica de `reload` (+11 líneas) que el componente reutiliza en `onSaved`/`onDeleted`; A es la convención existente en 12 archivos del repo, 1 línea, cero cambio de comportamiento. Principio del Cañón y la Mosca.
- **Riesgo de regresión: cero** (comentario).
- Nota: como SOFIA va a editar este archivo de todos modos para la SPEC (botón probe + selector de default, §8 de la SPEC), el fix se integra en la misma edición sin coste adicional.

---

## C. Instrucciones de Handoff

### C.1 Orden recomendado de aplicación

1. **B.1 workaround** (`TMPDIR`) — desbloquea gate vitest inmediatamente, 0 riesgo. *(Fix de raíz de /tmp: Frank decide; ticket INFRA aparte.)*
2. **B.2 install matplotlib** (+ opcional uvicorn/prisma) — desbloquea gate pytest.
3. **B.4 disable directive** en `AIProviderKeyManager.tsx` (1 línea) — cura el único error lint en alcance SPEC.
4. **B.3 saneado baseline** (8 comillas + 1 import + `eslint --fix`) — si Frank aprueba incluirlo en este IMPL.
5. **B.2.bis** tests obsoletos de `test_pdf_services.py` — según decisión de Frank (recomendado: 1 línea aditiva en `batch_process` + actualizar assert del test de vacío).
6. **Re-run gates completos:** `TMPDIR=… pnpm test` · `pytest tests -q` · `pnpm lint` · `pnpm typecheck` (typecheck ya pasa hoy: 0 errores).
7. Iniciar IMPL-20260809-01 de la SPEC_ARCH-20260809-05.

### C.2 Para SOFIA (cuando Frank apruebe)

- El baseline de tests frontend está **sano** (460/460 con TMPDIR): cualquier fallo nuevo durante el IMPL es regresión real, no ruido de entorno.
- Usa `TMPDIR` en TODA corrida de vitest hasta que Frank limpie `/tmp` (también aplica a Playwright y cualquier herramienta que escriba en `/tmp`).
- No "arregles" el import de matplotlib con try/except; la dependencia es dura y está declarada.
- El fix de `AIProviderKeyManager.tsx:76` va integrado en la edición del feature (mismo archivo).
- Los tests nuevos de la SPEC en `src/**/__tests__/` tienen `react-hooks/set-state-in-effect: off` por config (`eslint.config.mjs:73`) — no heredarán el problema.

### C.3 Decisiones pendientes de Frank

1. **¿Borrar/prunar `/tmp/sync_hermes_backup` (9.1 GB)?** (destructivo; los backups son versiones viejas de `~/.hermes`, recuperables de la laptop). Sin esto, el workaround TMPDIR basta para el IMPL.
2. **¿Instalar con `--break-system-packages`?** (política de entorno; es como ya están instalados el resto de paquetes del backend).
3. **¿El saneado lint fuera de alcance (B.3) y los 2 tests obsoletos (B.2.bis) entran en este IMPL o se difieren a ticket propio?** Recomendación: incluirlos (son ~20 líneas mecánicas en total y dejan los 4 gates verdes de verdad).

### C.4 Validación del dictamen (autocrítica vs. SPEC-CODIGO)

- ✅ Fact-forcing: todos los archivos relevantes leídos completos antes de proponer (`AIProviderKeyManager.tsx` 473 líneas, `vitest.config.ts`, `eslint.config.mjs`, `package.json`, `sync_hermes.sh`, `reporter.py`, SPEC completa).
- ✅ Evidencia empírica en cada causa raíz (errno 122=EDQUOT, dd 0-bytes, TMPDIR→460 pass, dry-run pip, matriz eslint --stdin 5 variantes).
- ✅ Ningún fix aplicado; repo verificado con `git status` sin modificaciones.
- ✅ Cañón y mosca: todos los fixes propuestos son ≤10 líneas y reversibles.
- ✅ Sin qodo (sunset); sin delegación a otros agentes.

---

**DEBY terminó dictamen** — Baseline rota por 4 causas independientes, todas L1/L2 sin escalamiento arquitectónico: (1) cuota EDQUOT agotada en tmpfs `/tmp` por backup hermes sin rotación de 9.1 GB → workaround `TMPDIR` verificado (460/460 tests pasan); (2) matplotlib declarado en requirements pero no instalado → `pip install` (wheels cp314 confirmados); (3) 9 errores lint baseline mecánicos + 12 warnings auto-fixables, solo 1 error en alcance SPEC; (4) `set-state-in-effect` en `AIProviderKeyManager.tsx:76` → disable directive de 1 línea (convención del codebase, verificado empíricamente; los refactors alternativos NO curan la regla). Dictamen en: `context/interconsultas/DICTAMEN_FIX-20260809-01.md`. Estado: ✅ VALIDADO. Acción sugerida: Frank aprueba orden de aplicación (§C.1) y las 3 decisiones de §C.3; SOFIA ejecuta fixes y re-run de gates antes de iniciar IMPL-20260809-01.
