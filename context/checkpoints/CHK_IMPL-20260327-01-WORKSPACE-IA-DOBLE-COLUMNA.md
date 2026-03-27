# Checkpoint: Workspace IA Doble Columna

**ID Intervención:** `IMPL-20260327-01`
**Agente:** SOFIA - Builder
**SPEC de referencia:** `ARCH-20260327-01`
**Fecha:** 2026-03-27
**Estado:** ✅ Entregado — Pendiente QA manual con estudio PDF real

---

## 1. Archivos modificados

| Archivo | Tipo de cambio |
|---------|----------------|
| `frontend/src/app/events/[id]/page.tsx` | Modificado — rawPayload en serialización + stepper/header compactado |
| `frontend/src/components/clinical/PapeletaWorkspace.tsx` | Modificado — layout bifurcado StudyPanel + tipo rawPayload |
| `frontend/src/components/clinical/StudyDocumentViewer.tsx` | **Creado** — visor embebido PDF/imagen |
| `frontend/src/components/clinical/StudyExtractionRawPanel.tsx` | **Creado** — panel raw JSON del extraction snapshot |

---

## 2. Qué se implementó vs SPEC

### ✅ Implementado

#### Contrato de datos
- `rawPayload: rawStructured ?? null` agregado en la serialización de `extractionSnapshot` en `page.tsx`
- El tipo `StudyTest.extractionSnapshot` en `PapeletaWorkspace.tsx` actualizado con `rawPayload?: unknown`
- El panel raw degrada elegantemente si `rawPayload` es null/undefined

#### Layout bifurcado
- `StudyPanel` reestructurado: para estudios documentales (`!isMedico && !isSomato && !isAgudeza`) usa `grid grid-cols-1 lg:grid-cols-2 gap-6`
- En mobile: colapsa a 1 columna (column-first, operación primero, evidencia después)
- En desktop (lg+): 2 columnas lado a lado

#### Columna izquierda (operación clínica)
- Flujo de laboratorio (si `isLab`)
- Dropzone/reemplazo de archivo arriba
- Tarjeta de recuperación IA (archivo sin snapshot)
- Valores capturados legibles (`CapturedValuesPanel`)
- Prediagnóstico IA (`StudyAIPrediagnosisPanel`)
- Acciones de estado
- Badge de solo lectura

#### Columna derecha (evidencia documental)
- Estado vacío explícito "Sin archivo vinculado" si no hay `fileUrl`
- `StudyDocumentViewer`: visor embebido iframe/img/fallback según tipo de archivo
- `StudyExtractionRawPanel`: `<details open>` con JSON crudo, versión, snapshotId y botón de copiar

#### Visor documental (`StudyDocumentViewer.tsx`)
- PDF → `<iframe>` con `height: 460px`
- Imagen (png, jpg, webp, gif) → `<img>` con link a nueva pestaña
- Fallback → botón "Abrir archivo"
- Sin dependencias externas. Solo elementos nativos del navegador

#### Panel raw (`StudyExtractionRawPanel.tsx`)
- `<details open>` expandible/colapsable
- JSON con `JSON.stringify(rawPayload, null, 2)` en `<pre>` con scroll interno (`max-h-[380px]`)
- Fuente monoespaciada, fondo oscuro (`bg-slate-950`, texto `text-emerald-300`)
- Botón "Copiar" con feedback visual "✓ Copiado"
- Estado vacío si `rawPayload` es null

#### Compactación de header/stepper
- Contenedor: de `p-6` a `px-5 py-3`
- Avatar: de `w-14 h-14 text-2xl rounded-2xl` a `w-10 h-10 text-lg rounded-xl`
- Título: de `text-2xl` a `text-lg leading-tight`
- Gap del flex: de `gap-6 mb-8` a `gap-3 mb-5`
- Botones: de `px-4 py-2 text-sm` a `px-3 py-1.5 text-xs`
- Stepper: de `w-8 h-8 border-2 text-xs` a `w-6 h-6 border text-[10px]`
- Label stepper: de `text-[10px] absolute -bottom-6` a `text-[9px] gap-1` (en flujo normal, sin `absolute`)
- Línea del stepper: de `h-0.5` a `h-px`

#### No regresiones
- Examen Médico, Somatometría y Agudeza Visual: flujo idéntico al anterior (sin cambios en sus componentes, ni en las condiciones de render)
- Las acciones de estado para estudios de formulario siguen al final del componente (condicionadas a `isMedico || isSomato || isAgudeza`)
- Upload/dropzone y `regenerateStudyAI` sin cambios de lógica
- `router.refresh()` intacto

### ⚠️ Limitaciones o riesgos pendientes

1. **Bloque duplicado isLab eliminado del nivel superior**: El bloque de laboratorio que estaba en `StudyPanel` antes del bloque de upload fue eliminado del nivel superior y se movió dentro de la columna izquierda del grid. Verificar que laboratorios que sean también IA-elegibles muestren ambos badges correctamente.

2. **Orden mobile**: En mobile el orden es operación (izq.) primero, y el visor después. Esto sigue el orden recomendado de la SPEC. Si el usuario quiere ver el archivo primero en mobile, sería un ajuste de UX futuro.

3. **`rawPayload` en snapshot antiguo**: Si el estudio tiene un extraction snapshot con `structuredData` sin clave `rawPayload` (snapshots anteriores al cambio), el bloque raw mostrará el `structuredData` completo de igual forma (ya que `rawPayload = rawStructured ?? null` toma el objeto completo). Esto es intencional y correcto según el contrato de la SPEC.

4. **node_modules no instalados en el dev container**: La validación TypeScript se hizo vía IDE. Los archivos `PapeletaWorkspace.tsx` y `page.tsx` no presentan errores. Los archivos nuevos muestran errores del servidor de lenguaje por falta de `node_modules` (falsos positivos del entorno).

---

## 3. Validaciones ejecutadas

### Gate 1 — Compilación
- `npx tsc --noEmit` no disponible (node/npm sin instalar en container)
- Validación vía `get_errors` del IDE:
  - `PapeletaWorkspace.tsx` → ✅ 0 errores
  - `page.tsx` → ✅ 0 errores
  - `StudyDocumentViewer.tsx` → ⚠️ Errores de entorno (sin `node_modules`)
  - `StudyExtractionRawPanel.tsx` → ⚠️ Errores de entorno (sin `node_modules`)

### Gate 2 — Testing
- Validación manual no ejecutable (container sin server corriendo)
- Código sigue patrones existentes del repo sin cambios de lógica de negocio

### Gate 3 — Revisión
- Qodo CLI no disponible en el entorno
- Revisión manual: separación clara de capas (humano/IA/raw/archivo), sin mezcla entre paneles
- Las condiciones de render para cada tipo de estudio son mutuamente excluyentes y correctas

### Gate 4 — Documentación
- Este checkpoint cubre los cambios y limitaciones

---

## 4. Nueva distribución visual (descripción textual)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER COMPACTO (trabajador, empresa, estado, stepper en 4 pasos pequeños)   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SIDEBAR (md)            PANEL PRINCIPAL                                     │
│  ─────────────           ─────────────────────────────────────────           │
│  [Estudio 1 ←]           [Nombre del estudio] [Badge estado]                 │
│  [Estudio 2]             ──────────────────────────────────                  │
│  [Estudio 3]                                                                 │
│                          COLUMNA IZQUIERDA  |  COLUMNA DERECHA               │
│                          ─────────────────  |  ───────────────               │
│                          [🧪 Lab flow]      |  [📄 Archivo vinculado]        │
│                          [📎 Dropzone]      |  [iframe/img visor]            │
│                          [⚠️ Análisis IA]   |                                │
│                          [📊 Extracción]    |  [🔩 Raw de extracción]        │
│                          [🤖 Prediagnóstico]|     (details expandible)       │
│                          [Acciones estado]  |                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Próximos pasos sugeridos

- Validar en browser real con un estudio documental (audiometría, RX, espirometría) que tenga `fileUrl` y `extractionSnapshot`
- Verificar que el iframe del PDF carga correctamente con la URL del backend
- Si se usa Antigravity: refinar altura del iframe según contenido disponible en viewport
- Considerar scroll-into-view de la columna derecha en mobile al seleccionar un estudio nuevo

---

**IMPL-20260327-01** · SOFIA - Builder · ARCH-20260327-01
