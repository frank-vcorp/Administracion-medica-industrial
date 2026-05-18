# SPEC ARCH-20260518-14 - Extensión del Renderer Clínico General a Audiometría

## 1. Objetivo

Agregar Audiometría al renderer clínico general ya implementado, manteniendo la estrategia incremental de crecer estudio por estudio sobre la misma base visual.

## 2. Decisión

Sí: el roadmap correcto es **estudio por estudio**.

Eso implica:

- conservar un único renderer base
- agregar un schema de presentación por cada estudio nuevo
- evitar crear componentes clínicos completamente independientes salvo que el layout lo exija de forma extrema

## 3. Contexto Técnico Confirmado

El contrato backend existente de `AudiometriaData` ya define:

- `paciente`
- `fecha_estudio`
- `oido_derecho`
- `oido_izquierdo`
- `frecuencias_detectadas`
- `completitud_documental`
- `notas_calidad`
- `faringe`
- `cad`
- `cai`
- `mtd`
- `mti`

Referencias de respaldo:

- `backend/app/schemas/medical.py`
- `context/SPECs/SPEC_ARCH-20260516-07-AUDIOMETRIA-EXTRACCION-CAMPOS-FUENTE-DIAGNOSTICOS.md`

## 4. Problema a Resolver

Audiometría todavía cae al fallback genérico del renderer y se sigue viendo como lista técnica azul. Eso es funcional, pero no clínicamente legible.

## 5. Alcance

### Incluye

- agregar schema `Audiometria` en el registro del renderer clínico
- presentar los umbrales por oído en formato tabular claro
- mostrar metadata y campos fuente documentales cuando existan
- preservar fallback genérico para estudios no soportados todavía

### No incluye

- cambios al contrato backend de extracción
- rediseño total de la UI clínica
- interpretación clínica o diagnóstico en esta vista

## 6. Presentación Requerida para Audiometría

### 6.1 Resumen del estudio

- paciente
- fecha del estudio
- completitud documental
- notas de calidad

### 6.2 Tabla audiométrica principal

Renderizar una tabla por frecuencia con columnas mínimas:

- Frecuencia
- Oído derecho
- Oído izquierdo

La tabla debe construirse uniendo las claves de:

- `oido_derecho`
- `oido_izquierdo`

Orden sugerido de frecuencias:

- 250
- 500
- 1000
- 2000
- 3000
- 4000
- 6000
- 8000

Si aparecen otras frecuencias, deben mostrarse después sin perder datos.

### 6.3 Campos fuente del formato

Si existen, mostrar en sección separada:

- faringe
- cad
- cai
- mtd
- mti

## 7. Reglas de UX

1. La tabla debe ser legible para médico y comparable entre ambos oídos.
2. En móvil debe admitir scroll horizontal controlado.
3. No se deben inventar frecuencias faltantes.
4. Si uno de los oídos no trae cierto valor, la celda debe mostrarse vacía o con guion.
5. El panel raw técnico debe seguir existiendo como superficie secundaria DEV/QA.

## 8. Hipótesis Local de Implementación

La infraestructura actual del renderer ya soporta `keyValue`, `table`, `badges` y `note`, pero Audiometría requiere una tabla derivada de dos mapas (`oido_derecho` y `oido_izquierdo`).

Por tanto, el cambio mínimo plausible es:

- extender el renderer con un nuevo tipo de bloque reutilizable para pares bilaterales por frecuencia
o
- precomputar una tabla normalizada para Audiometría dentro del mismo renderer antes de renderizar secciones

La validación discriminante más barata es un `tsc --noEmit` del frontend tras agregar el nuevo schema y bloque.

## 9. Archivos Probables

- `frontend/src/components/clinical/extraction-presentation-schemas.ts`
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`
- posiblemente `frontend/src/components/clinical/PapeletaWorkspace.tsx` solo si el contrato del renderer cambia

## 10. Criterios de Aceptación

1. Audiometría deja de caer al fallback genérico cuando `studyType` es `Audiometria`.
2. Los valores de ambos oídos se ven en tabla comparativa por frecuencia.
3. Los campos `faringe`, `cad`, `cai`, `mtd`, `mti` aparecen si existen.
4. No se modifica el payload backend.
5. El panel raw técnico permanece disponible.
6. El frontend compila sin errores.

## 11. Resultado Esperado

El mismo renderer clínico general ahora soporta al menos dos estudios reales:

- Espirometría
- Audiometría

y queda validada la estrategia incremental de crecer la UI extractiva estudio por estudio.