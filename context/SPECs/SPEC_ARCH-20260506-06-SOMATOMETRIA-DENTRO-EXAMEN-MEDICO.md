## SPEC: Reintegracion de Somatometria, Signos Vitales y Agudeza Visual como pestañas dentro de Examen Medico

**ID:** ARCH-20260506-06  
**Estado:** Lista para implementacion por SOFIA  
**Padre:** SPEC_ARCH-20260325-05-SEPARACION-SOMATOMETRIA-AGUDEZA-EXAMEN.md  
**Motivo de reapertura:** Ajuste clinico-operativo derivado de la observacion presencial y de la forma real en que AMI usa estos datos dentro del dictamen.

### Objetivo

Corregir el flujo actual para que Somatometria, Signos Vitales y Agudeza Visual dejen de percibirse como estudios separados y pasen a vivir como pestañas internas dentro de Examen Medico, preservando que el medico use esos datos dentro de su proceso real de revision, interpretacion y aptitud.

## Contexto estrategico

Este ajuste no es solo de UX. Es prerequisito para que la futura capa de apoyo clinico basada en la IA medica de Google, ya comunicada a AMI, opere sobre un flujo clinico que el medico reconozca como propio.

## Problema a resolver

- La arquitectura vigente separo Somatometria y Agudeza Visual como estudios independientes.
- Operativamente, AMI utiliza Somatometria, Signos Vitales y Agudeza Visual como parte natural del examen que alimenta el dictamen medico.
- Mantenerlos completamente separados puede provocar friccion semantica, duplicidad de pasos o una experiencia que no refleja la practica real del medico ocupacional.

## Inventario actual de datos existentes

Hoy los datos de Somatometria y Agudeza Visual **si existen** en el sistema. No estan dentro del bloque visible de Examen Medico; estan capturados y persistidos por fuera, en flujos separados.

### Campos actualmente usados en Somatometria y Signos Vitales
- peso_kg
- talla_m
- imc
- complexion
- ta_sistolica
- ta_diastolica
- fc_min
- fr_min
- temperatura
- perimetro_cintura
- perimetro_cadera

### Campos actualmente usados en Agudeza Visual
- vision_lejana_od
- vision_lejana_oi
- vision_cercana_od
- vision_cercana_oi
- lejana_corregida_od
- lejana_corregida_oi
- cercana_corregida_od
- cercana_corregida_oi
- reflejos
- test_ishihara
- campimetria

### Dónde viven hoy
- Se validan con `SomatometriaVitalesSchema`.
- Se guardan en `MedicalExam.somatometryData`.
- Se muestran desde el formulario especializado `SomatometriaStudy` dentro de la Papeleta.
- Se enlazan al `EventTest` de Somatometria para estatus y prediagnostico IA.
- Agudeza Visual se valida con `AgudezaVisualSchema`.
- Agudeza Visual se guarda en `MedicalExam.eyeAcuityData`.
- Agudeza Visual se muestra desde el formulario especializado `AgudezaVisualStudy` dentro de la Papeleta.
- Agudeza Visual se enlaza a su `EventTest` propio para estatus y prediagnostico IA.

### Lectura arquitectonica
- La data no esta perdida ni falta modelado base.
- El problema actual es de ubicacion funcional y experiencia clinica.
- Incluso existe `vitalSignsData` en el modelo, pero el flujo vigente concentra la captura efectiva en `somatometryData`.

## Decisión propuesta

- **Somatometria**, **Signos Vitales** y **Agudeza Visual** deben reintegrarse a Examen Medico como pestañas internas del estudio.
- El medico debe poder revisar y usar estos datos sin salir del flujo de Examen Medico.

## Orden objetivo de pestañas

El flujo objetivo dentro de Examen Medico debe quedar asi:

1. Somatometria
2. Signos Vitales
3. Agudeza Visual
4. Examen Medico

### Regla de dependencia
- Las pestañas 1, 2 y 3 son independientes entre si para captura y guardado.
- Ninguna de esas tres depende de otra para poder llenarse.
- Pero **no se debe permitir pasar a la pestaña 4. Examen Medico** si Somatometria, Signos Vitales y Agudeza Visual no estan terminadas.
- El bloqueo debe ser visible y entendible para el medico o capturista.

## Alcance de esta iteracion

### Sí entra
- Reestructurar UI de Examen Medico para incluir tres pestañas previas: Somatometria, Signos Vitales y Agudeza Visual.
- Mover captura/lectura de peso, talla, IMC y signos vitales al estudio Examen Medico.
- Mover captura/lectura de Agudeza Visual al estudio Examen Medico.
- Ajustar flujo visible de la Papeleta para que estas tres piezas dejen de mostrarse como estudios separados en la experiencia principal.
- Implementar regla de bloqueo para impedir acceso a Examen Medico mientras las tres pestañas previas no esten completas.
- Mantener compatibilidad de persistencia mientras no sea imprescindible migrar modelo.

### No entra
- Rehacer toda la arquitectura del Examen Medico.
- Cambiar longitudinalidad del historial clinico.
- Redefinir por completo criterios clinicos de Agudeza Visual mas alla de reubicarla correctamente en el flujo.

## Criterios de aceptación

1. Examen Medico muestra cuatro pestañas principales en este orden: Somatometria, Signos Vitales, Agudeza Visual y Examen Medico.
2. Somatometria, Signos Vitales y Agudeza Visual pueden capturarse por separado sin depender una de otra.
3. La pestaña Examen Medico permanece bloqueada hasta que las tres pestañas previas esten completas.
4. Peso, talla, IMC y signos vitales se capturan o visualizan dentro del flujo de Examen Medico.
5. Agudeza Visual se captura o visualiza dentro del flujo de Examen Medico.
6. Somatometria, Signos Vitales y Agudeza Visual dejan de aparecer como estudios aislados en la experiencia principal si hoy estan duplicados.
7. El medico puede dictaminar sin sentir que estas piezas viven en un flujo ajeno.
8. No se rompe la persistencia actual ni la transicion a validacion.

## Implicaciones técnicas esperadas

- Revisar [frontend/src/components/clinical/ExamenMedicoEstudio.tsx](../../frontend/src/components/clinical/ExamenMedicoEstudio.tsx)
- Revisar [frontend/src/components/clinical/PapeletaWorkspace.tsx](../../frontend/src/components/clinical/PapeletaWorkspace.tsx)
- Revisar acciones actuales de captura de Somatometria y Agudeza Visual y compatibilidad con `MedicalExam`
- Verificar si los estudios especializados de Somatometria y Agudeza Visual pueden reutilizarse como subcomponentes internos
- Definir el criterio tecnico de “completado” para habilitar la pestaña Examen Medico sin introducir ambigüedad de estados

## Riesgos a vigilar

- Reintroducir duplicidad visual entre estudio independiente y bloque interno.
- Romper el acuerdo previo de separacion sin dejar clara la nueva regla.
- Generar un bloqueo confuso si el usuario no entiende que falta para habilitar Examen Medico.
- Mezclar criterio de completado visual con criterio de completado clinico sin dejar regla explicita.

## Validación esperada

- Validacion manual del flujo clinico con un evento que requiera Examen Medico.
- Confirmar que el medico ve y usa Somatometria, Signos Vitales y Agudeza Visual dentro de Examen Medico.
- Confirmar que Examen Medico no se habilita mientras falte cualquiera de las tres pestañas previas.
- Confirmar que la navegacion y estados del expediente no se rompen.

## Handoff a SOFIA

- Implementar el cambio minimo y coherente para reintegrar Somatometria, Signos Vitales y Agudeza Visual a Examen Medico.
- Respetar la independencia de captura entre las tres pestañas previas.
- Implementar bloqueo claro antes de Examen Medico mientras falte cualquiera de las tres.
- Evitar refactorizaciones amplias no necesarias.
- Preservar compatibilidad de datos y centrar la correccion en UX/flujo clinico.