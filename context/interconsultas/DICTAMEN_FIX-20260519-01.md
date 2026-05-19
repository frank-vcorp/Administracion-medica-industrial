# DICTAMEN TÉCNICO: Desalineamiento vigente del renderer de Audiometría contra el payload revalidado
- **ID:** FIX-20260519-01
- **Fecha:** 2026-05-19
- **Solicitante:** INTEGRA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz

El comportamiento visible actual no apunta a una falla del bloque visual de tablas, sino a un desacople de contrato entre el payload revalidado y el schema de presentación del frontend.

Hallazgos forenses confirmados:

1. El commit `122660c` dejó el frontend de Audiometría cableado a la forma `va/vo/pta_visible/notas_calidad.descripcion/paciente_detalle` en `frontend/src/components/clinical/extraction-presentation-schemas.ts`.
2. El renderer no transforma ni normaliza el payload antes de pintar: recibe `extracted_data` prácticamente crudo desde snapshot/DB y delega toda la decisión de render a ese schema.
3. El bloque de tablas bilaterales sí existe y funciona, pero retorna `null` cuando las rutas configuradas no existen en `extractedData`.
4. Si el payload revalidado real ahora llega como `oido_derecho.via_aerea`, `oido_derecho.via_osea`, `oido_izquierdo.via_aerea`, `oido_izquierdo.via_osea`, `notas_calidad` como arreglo de strings y `condiciones.PTA_general`, entonces el schema vigente no encuentra:
   - `oido_derecho.va`
   - `oido_izquierdo.va`
   - `oido_derecho.vo`
   - `oido_izquierdo.vo`
   - `oido_derecho.pta_visible`
   - `oido_izquierdo.pta_visible`
   - `notas_calidad.descripcion`

Con ese desacople, la UI conserva solo las secciones cuyos campos sí siguen existiendo y las tablas comparativas desaparecen. Eso coincide exactamente con el síntoma reportado: se ve paciente/estudio/resumen técnico, pero no las tablas esperadas.

Clasificación del problema:

- **Falla inmediata:** frontend
- **Causa sistémica:** contrato entre capas inestable/no versionado
- **Riesgo adicional:** datos persistidos históricos o snapshots creados con distintas versiones del payload, porque `extracted_data` se guarda crudo y luego se re-renderiza sin migración ni normalización

### B. Justificación de la Solución

La corrección mínima no debe tocar backend ni el bloque visual de tablas.

La superficie exacta a corregir es el schema de presentación de Audiometría del frontend, porque ese archivo define las rutas concretas que el renderer intenta resolver. Mientras ese schema siga apuntando a `va/vo/pta_visible/notas_calidad.descripcion`, cualquier snapshot nuevo que venga en la forma `via_aerea/via_osea/notas_calidad[]/condiciones.PTA_general` seguirá degradándose visualmente.

Recomendación mínima de corrección:

1. Reajustar el schema de Audiometría en `frontend/src/components/clinical/extraction-presentation-schemas.ts` para el payload realmente vigente.
2. Si se busca estabilidad y no solo apagar este caso puntual, soportar alias duales para ambas formas (`via_aerea`/`va`, `via_osea`/`vo`, `PTA_general`/`pta_visible`, `notas_calidad[]`/`notas_calidad.descripcion`) en lugar de volver a hardcodear una sola versión.
3. Mantener `ClinicalExtractionRenderer.tsx` sin cambios salvo que se decida introducir resolución de múltiples rutas candidatas; con la infraestructura actual, el problema principal no está ahí.

### C. Instrucciones de Handoff para SOFIA

1. Verificar en el snapshot real revalidado cuáles claves exactas trae `structuredData.extracted_data` para Audiometría.
2. Corregir primero y solo el schema en `frontend/src/components/clinical/extraction-presentation-schemas.ts`.
3. Como validación discriminante mínima, confirmar que las rutas configuradas en el schema existan literalmente en el payload revalidado antes de tocar cualquier otro archivo.
4. Si se confirma coexistencia de snapshots con dos formas de payload, implementar compatibilidad dual en la capa de presentación en vez de seguir alternando entre una forma y otra.
5. No tocar backend salvo evidencia nueva de que el payload debería normalizarse en origen.