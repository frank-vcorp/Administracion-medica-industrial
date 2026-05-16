# SPEC ARCH-20260516-11: RAW de Prediagnóstico Siempre Visible

## 1. Objetivo
Garantizar que el panel de `RAW de entrada clínica` siempre sea visible en la papeleta con el mismo lenguaje visual técnico del `RAW de extracción`, incluso cuando el snapshot actual no traiga `input_debug`.

## 2. Problema Observado
- El usuario espera ver un cuadro técnico equivalente al `RAW de extracción`.
- Hoy `StudyPrediagnosisRawPanel` retorna `null` cuando `input_debug` no existe.
- Ese comportamiento hace que el panel desaparezca por completo y se interprete como ausencia de implementación, cuando en realidad puede tratarse de un snapshot viejo o de un prediagnóstico generado antes del corte de observabilidad clínica.

## 3. Hipótesis Local
La causa controladora de la mala UX actual no es solo el estilo visual, sino que el panel depende de la existencia de `input_debug` para siquiera renderizarse. Si el panel mantiene presencia constante y muestra un estado vacío explícito cuando falte ese payload, el usuario podrá distinguir entre:
- panel existente con datos
- panel existente sin datos históricos

## 4. Decisión Arquitectónica
Se aprueba un ajuste de UX/observabilidad mínimo:
- `StudyPrediagnosisRawPanel` debe renderizarse siempre.
- Cuando exista `input_debug`, debe mostrarse como panel técnico oscuro ya homologado al RAW de extracción.
- Cuando no exista `input_debug`, debe seguir mostrando el mismo contenedor técnico, pero con un estado vacío explícito y honesto indicando que el snapshot no contiene RAW clínico persistido.
- El mensaje no debe culpar al usuario ni prometer datos inexistentes; debe orientar a regenerar el prediagnóstico con el pipeline actual si se requiere observabilidad clínica.

## 5. Alcance
### Incluye
- Mantener visible el contenedor `RAW de entrada clínica` dentro del panel de prediagnóstico.
- Renderizar estado vacío técnico cuando `input_debug` sea `null` o `undefined`.
- Conservar la UI oscura, monoespaciada y con affordances equivalentes al RAW de extracción.

### No incluye
- Cambios a persistencia backend.
- Cambios al contrato clínico.
- Reprocesamiento automático de snapshots históricos.

## 6. Criterios de Aceptación
1. El usuario siempre ve el panel `RAW de entrada clínica` en el bloque de prediagnóstico.
2. Si hay `input_debug`, se muestran `extracted_data`, `medical_calibration` y `rendered_prompt` como hoy.
3. Si no hay `input_debug`, el panel no desaparece: muestra estado vacío con explicación breve y accionable.
4. El estado vacío conserva paridad visual con el `RAW de extracción` y no rompe snapshots viejos.

## 7. Validación Esperada
- Abrir un estudio reciente con `input_debug` y confirmar que el panel técnico se ve y expone el payload clínico.
- Abrir un estudio viejo sin `input_debug` y confirmar que el panel sigue visible con mensaje de ausencia de snapshot clínico.
- Confirmar que el usuario puede ubicar el panel sin depender de si hay datos o no.

## 8. Resultado Esperado
El `RAW de entrada clínica` deja de desaparecer silenciosamente. La UI comunica claramente si el dato existe o no, manteniendo el mismo lenguaje visual técnico del RAW de extracción.