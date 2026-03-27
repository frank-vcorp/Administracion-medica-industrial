## SPEC: Workspace IA de Estudios en Doble Columna con Visor y Raw Data

**ID:** `ARCH-20260327-01`
**Estado:** `Lista para implementación por SOFIA`
**Padre:** `ARCH-20260324-03`, `ARCH-20260326-16`
**Objetivo:** rediseñar el workspace de estudios documentales con IA para aprovechar mejor el ancho en escritorio, permitir calibración visual del pipeline y separar claramente operación clínica, evidencia documental y datos raw de extracción.

### Problema a resolver
- El workspace actual del estudio activo en la papeleta es demasiado vertical y desaprovecha el ancho disponible en escritorio.
- La vista de `Valores capturados` es útil para lectura humana, pero se queda corta para calibrar extracción contra el documento fuente.
- El médico necesita comparar simultáneamente:
  - archivo original
  - valores extraídos legibles
  - raw real de la extracción
  - prediagnóstico IA
  - estado clínico / revisión
- El stepper del expediente ocupa demasiado espacio visual para la frecuencia real con la que se consulta durante la revisión del estudio.

### Decisión arquitectónica
- El workspace documental con IA pasa a un **layout bifurcado de 2 columnas en desktop**.
- La columna izquierda será la **columna operativa-clínica**.
- La columna derecha será la **columna de evidencia documental y calibración**.
- La vista humana de extracción y la vista raw deben coexistir, pero con jerarquía visual distinta:
  - vista humana para lectura rápida
  - vista raw para calibración técnica, nunca como bloque dominante inicial
- El stepper global del expediente se compacta para reducir altura y devolver protagonismo al estudio activo.
- No se agregan dependencias nuevas para visor PDF; se usará render nativo del navegador con `iframe`, `object` o `embed`, y fallback a enlace externo.

### Alcance

#### Sí entra
- Reestructuración visual del workspace de estudios documentales con IA.
- Visor embebido de PDF/imagen del archivo cargado.
- Panel explícito de raw JSON del `StudyExtractionSnapshot`.
- Reubicación del dropzone y del bloque de archivo vinculado en la parte superior del workspace.
- Compactación del stepper/header del expediente.
- Mejor aprovechamiento del ancho en desktop sin romper móvil.

#### No entra
- Cambios de backend del pipeline IA.
- Cambios de Prisma o migraciones.
- Nuevas reglas clínicas o nuevos estados.
- Cambios en el dictamen final, PDF oficial o flujo de firma.
- Reescritura completa de los componentes de Examen Médico, Somatometría o Agudeza Visual.

### Principios no negociables

#### 1. Separación visual por capas
- La UI debe distinguir claramente:
  - archivo fuente
  - extracción estructurada legible
  - raw técnico de extracción
  - prediagnóstico IA
  - revisión médica
- El raw nunca debe confundirse con diagnóstico ni con dictamen médico.

#### 2. Comparación lado a lado
- En desktop, el usuario debe poder revisar el documento y la interpretación sin hacer scroll vertical excesivo entre ambos.

#### 3. Sin ambigüedad de origen
- Cada bloque debe dejar claro si la información proviene de:
  - archivo cargado
  - extracción IA
  - interpretación IA
  - revisión médica humana

#### 4. Calibración primero, polish después
- Durante esta iteración se prioriza la capacidad de inspección y ajuste del pipeline sobre una UI minimalista excesiva.
- Mostrar raw está permitido y deseado, siempre que quede relegado a una caja técnica identificada.

### Resultado esperado

#### Desktop
El estudio documental IA debe verse como un workspace de dos columnas:

**Columna izquierda (operación):**
1. Header compacto del estudio
2. Dropzone / reemplazo de archivo
3. Estado del estudio y estado IA en formato compacto
4. Valores capturados legibles
5. Prediagnóstico IA
6. Revisión médica / acciones de estado

**Columna derecha (evidencia):**
1. Archivo vinculado con nombre visible
2. Visor embebido del PDF o imagen
3. Panel de raw JSON del extraction snapshot
4. Metadatos técnicos mínimos del snapshot cuando existan

#### Mobile
- El layout debe colapsar a una sola columna.
- Orden recomendado:
  1. header del estudio
  2. archivo vinculado / visor
  3. dropzone
  4. valores capturados
  5. prediagnóstico IA
  6. raw JSON
  7. acciones
- No debe haber horizontal scroll en móvil.

### Contrato de UX detallado

#### A. Encabezado del estudio
- Mantener el nombre del estudio y badges actuales.
- No repetir información innecesaria ya visible en la cabecera persistente del worker.
- El badge de estado del estudio debe seguir visible arriba.

#### B. Upload y archivo vinculado
- En desktop, la parte superior debe repartir visualmente:
  - izquierda: dropzone / reemplazar archivo
  - derecha: nombre del archivo y acceso inmediato al visor
- Si existe archivo, el nombre del archivo debe ser visible sin abrir el panel raw.
- Si no existe archivo, la columna derecha debe mostrar un estado vacío claro: “Sin archivo vinculado”.

#### C. Valores capturados
- La vista actual de `Valores capturados` debe mantenerse, pero con mayor ancho utilizable y mejor densidad.
- No debe truncar silenciosamente información relevante.
- Debe seguir mostrando `missingFields` cuando existan.

#### D. Raw data
- Debe existir un bloque técnico visible llamado algo equivalente a:
  - `Raw de extracción`
  - `JSON técnico`
  - `Payload extraído`
- Debe renderizar el JSON completo del snapshot estructurado vigente.
- Debe usar fuente monoespaciada, fondo técnico y scroll interno.
- Puede ir dentro de un `details` expandible, pero debe quedar visible y fácil de abrir.
- Debe incluir botón o affordance de copiar si es trivial; si no, esto puede quedar fuera de scope V1.

#### E. Visor de archivo
- Si el archivo es PDF:
  - render embebido con `iframe`/`object`/`embed`
  - con altura útil, no miniatura simbólica
- Si el archivo es imagen:
  - mostrar imagen contenida y ampliable al abrir en pestaña nueva
- Si el navegador no puede renderizarlo:
  - mostrar fallback con CTA `Abrir archivo`

#### F. Stepper compacto
- El stepper del expediente en la pantalla del evento debe reducir altura visual.
- Debe conservar:
  - paso actual
  - navegación a pasos previos permitidos
- Debe perder peso visual frente al estudio activo.
- No debe usar tarjetas o círculos sobredimensionados.

### Contrato de datos

#### Requerimiento mínimo para extracción serializada
SOFIA debe asegurar que el estudio activo reciba, además de la vista legible actual:

```json
{
  "extractionSnapshot": {
    "id": "uuid",
    "version": 1,
    "extractedData": {},
    "missingFields": [],
    "rawPayload": {},
    "audit": {}
  }
}
```

#### Reglas
- `rawPayload` debe corresponder al `structuredData` completo del snapshot vigente.
- `audit` puede derivarse del raw si ya existe ahí; no inventar un contrato nuevo si no es necesario.
- Si `rawPayload` no existe, el bloque raw debe mostrar estado vacío explícito y no romper la UI.

### Archivos obligatorios a modificar

#### 1. `frontend/src/components/clinical/PapeletaWorkspace.tsx`
Cambios requeridos:
- Reestructurar `StudyPanel` a layout de dos columnas responsive.
- Mover dropzone a la parte superior de la columna izquierda.
- Mover archivo vinculado / visor a la parte superior de la columna derecha.
- Conservar `CapturedValuesPanel`, pero integrarlo en la columna izquierda.
- Agregar panel técnico de raw JSON en columna derecha.
- Agregar componente local o subcomponente para visor documental.
- Mantener comportamiento actual para estudios no documentales sin romper Examen Médico, Somatometría y Agudeza Visual.

#### 2. `frontend/src/app/events/[id]/page.tsx`
Cambios requeridos:
- Extender la serialización de `extractionSnapshot` para incluir `rawPayload` completo.
- Exponer metadatos útiles de extracción si ya existen en `structuredData.audit`.
- Compactar el stepper/header visual del expediente en esta pantalla.

### Archivos opcionales permitidos
SOFIA puede crear alguno de estos componentes si mejora claridad sin expandir scope:
- `frontend/src/components/clinical/StudyDocumentViewer.tsx`
- `frontend/src/components/clinical/StudyExtractionRawPanel.tsx`

Si decide crearlos, debe mantener la lógica principal del estudio en `PapeletaWorkspace.tsx` y usar estos archivos solo como separación presentacional.

### Restricciones de implementación
- No instalar librerías nuevas de visor PDF.
- No mover la lógica clínica a otro flujo fuera del workspace.
- No mezclar raw data con panel de prediagnóstico.
- No esconder el raw detrás de demasiados clics.
- No romper el flujo actual de `regenerateStudyAI`, upload ni revisión médica.
- No degradar móvil para mejorar desktop.

### Criterios de aceptación

#### 1. Layout
- En desktop, al abrir un estudio documental IA, el contenido principal se ve en dos columnas claras.
- La columna izquierda concentra operación clínica.
- La columna derecha concentra archivo y calibración.

#### 2. Archivo
- Si existe `fileUrl`, el archivo se puede visualizar dentro del workspace.
- El nombre del archivo es visible arriba del visor o junto a él.
- Sigue existiendo una acción clara para abrirlo en una pestaña nueva.

#### 3. Extracción humana
- Los `Valores capturados` siguen visibles y no desaparecen.
- La vista no debe perder `missingFields`.

#### 4. Raw técnico
- El raw completo del snapshot vigente es visible o expandible en el mismo workspace.
- El bloque raw usa formato legible para inspección técnica.

#### 5. Prediagnóstico
- El panel de prediagnóstico IA sigue funcionando y no se mezcla visualmente con el raw.

#### 6. Stepper
- El header/stepper del expediente ocupa menos altura que hoy.
- El estudio activo gana protagonismo visual inmediato sin scroll inicial innecesario.

#### 7. Responsive
- En móvil no hay solapamientos, horizontal scroll ni paneles inutilizables.

#### 8. No regresiones
- Examen Médico, Somatometría y Agudeza Visual mantienen su funcionamiento actual.
- El flujo de upload/reemplazo de archivo sigue operativo.
- `router.refresh()` y la serialización actual no deben romperse.

### Soft Gates para cierre
- **Gate 1 — Compilación:** `pnpm build` o `pnpm tsc --noEmit` sin errores nuevos.
- **Gate 2 — Testing/QA manual:** validar al menos un estudio documental con archivo PDF y, si es posible, uno con imagen.
- **Gate 3 — Revisión:** confirmar que la UI separa claramente humano / IA / raw / archivo.
- **Gate 4 — Documentación:** checkpoint de SOFIA con capturas o descripción de la nueva distribución.

### Checklist de implementación para SOFIA
- [ ] Serializar `rawPayload` del extraction snapshot en la página del evento.
- [ ] Rediseñar el `StudyPanel` documental a dos columnas en desktop.
- [ ] Reubicar dropzone en la parte superior izquierda.
- [ ] Reubicar archivo vinculado y visor en la parte superior derecha.
- [ ] Agregar panel raw técnico con JSON completo.
- [ ] Mantener `Valores capturados` como capa humana separada.
- [ ] Mantener `StudyAIPrediagnosisPanel` sin mezclarlo con raw.
- [ ] Compactar stepper/header del evento.
- [ ] Verificar responsive móvil.
- [ ] Validar un caso real con PDF de estudio.

### Veredicto
- La propuesta del usuario es correcta.
- No es solo un ajuste visual; mejora la calibración del pipeline IA y la velocidad de revisión clínica.
- Recomiendo tratar esta mejora como cierre natural del frente `ARCH-20260326-16` en términos operativos de UX.