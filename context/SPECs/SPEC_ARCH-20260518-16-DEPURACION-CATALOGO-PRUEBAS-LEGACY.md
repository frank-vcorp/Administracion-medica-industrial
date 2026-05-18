# SPEC ARCH-20260518-16 - Depuración de Catálogo de Pruebas Legacy No Vigentes

## 1. Objetivo

Eliminar de la selección visible del catálogo las pruebas legacy que ya no reflejan el flujo clínico operativo vigente, preservando la trazabilidad histórica y evitando borrados destructivos.

## 2. Hallazgo

El catálogo visible sigue mostrando entradas como:

- Agudeza Visual
- Somatometría (Peso, Talla, Signos Vitales)

en la superficie “Estudios Generales / Sala”, aunque la documentación operativa posterior indica que esas capturas deben integrarse dentro del flujo de Examen Médico o de sus prerrequisitos, no como pruebas que el usuario deba seguir seleccionando como estudios independientes del catálogo general.

## 3. Evidencia Relevante

### Evidencia de inconsistencia actual

- El usuario reporta entradas repetidas/no usadas en catálogo visible.
- `context/CATALOGO_IA_DOCUMENTAL_20260326.md` todavía lista:
  - `GEN-02 Agudeza Visual`
  - `GEN-01 Somatometría (Peso, Talla, Signos Vitales)`

### Evidencia de decisión operativa posterior

- `PROYECTO.md` registra una decisión previa sobre separación histórica, pero la documentación de juntas y análisis posteriores reabre la decisión operativa.
- `context/Juntas/Avances AMI_ 2026_04_08 12_50 CST - Notas de Gemini.md`
- `context/Juntas/ANALISIS_INSUMOS_AMI_2026-05-06_POSIBLES-AVANCES.md`

Esas fuentes indican que Somatometría, Agudeza Visual y signos vitales deben integrarse dentro del flujo de Examen Médico para el uso operativo real de AMI.

## 4. Restricción Arquitectónica

No se aprueba hard delete directo de registros `MedicalTest`, porque participan en:

- `MedicalProfile`
- `EventTest`
- snapshots e historial clínico

Por tanto, la solución correcta es de **depuración no destructiva**.

## 5. Decisión

Se aprueba ocultar o excluir del catálogo seleccionable las pruebas legacy no vigentes, en vez de eliminarlas físicamente de la base.

## 6. Candidatos Iniciales a Ocultar del Catálogo Visible

### Sí ocultar del catálogo general seleccionable

- `Somatometría (Peso, Talla, Signos Vitales)`
- `Agudeza Visual`

### Mantener visibles

- `Examen Médico (Exploración física)`
- `Audiometría`

### Pendiente de corroboración funcional antes de tocar

- cualquier estudio adicional que exista duplicado por naming, acentos o legado de bootstrap

## 7. Estrategia Recomendada

### Opción preferida

Agregar una señal explícita de visibilidad de catálogo, por ejemplo:

- `isSelectableInCatalog`
o
- flag JSON en `MedicalTest.options`

y filtrar el catálogo visible con esa señal.

### Opción mínima aceptable

Si no se quiere migración todavía, aplicar una exclusión controlada por código sobre los canónicos legacy definidos en SPEC, sin tocar historial ni relaciones existentes.

## 8. No Hacer

- no borrar registros `MedicalTest` históricos
- no romper perfiles ya guardados sin migración explícita
- no eliminar `EventTest` históricos
- no cambiar el flujo interno de Examen Médico en este mismo corte

## 9. Criterios de Aceptación

1. El catálogo visible deja de mostrar `Somatometría` y `Agudeza Visual` como opciones generales seleccionables.
2. `Examen Médico` y `Audiometría` permanecen visibles donde corresponde.
3. No se pierde historial ni relación histórica con `EventTest` previos.
4. No se hace hard delete de `MedicalTest` existentes.
5. La solución deja una base clara para depurar otros legacy del catálogo más adelante.

## 10. Archivos Probables

- `frontend/src/actions/medical-profiles.ts`
- superficies que listan catálogo de pruebas
- `frontend/prisma/schema.prisma` solo si se aprueba flag persistente de visibilidad

## 11. Resultado Esperado

El catálogo operativo deja de mostrar pruebas legacy no vigentes, reduce ruido para el usuario y se alinea mejor con el flujo clínico real, sin destruir historial ni configuración ya existente.