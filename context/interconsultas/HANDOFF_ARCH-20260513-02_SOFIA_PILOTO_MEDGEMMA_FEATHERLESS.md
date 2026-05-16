# HANDOFF DE IMPLEMENTACION

- ID: ARCH-20260513-02
- Fecha: 2026-05-13
- Agente origen: INTEGRA - Arquitecto
- Agente destino: SOFIA - Builder
- Estado: Listo para implementacion
- SPEC fuente: context/SPECs/SPEC_ARCH-20260513-02-PILOTO-MEDGEMMA-FEATHERLESS.md
- Dependencia funcional: context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md

## Objetivo

Implementar el piloto de MedGemma 27B via Featherless como proveedor de prediagnostico clinico en modo sombra, sin tocar la capa de extraccion multimodal ya asignada a Gemini 2.5.

## Decision no negociable del corte

1. Gemini 2.5 mantiene la extraccion documental
2. MedGemma 27B Text entra solo en la capa clinica
3. no se envia a MedGemma el archivo crudo, PDF ni imagenes
4. el piloto se limita a Audiometria y Espirometria

## Entregable demostrable

1. proveedor clinico configurable para usar Featherless con `google/medgemma-27b-text-it`
2. flujo de prediagnostico funcionando sobre datos estructurados ya extraidos
3. fallback claro al proveedor generalista actual si MedGemma falla o no esta habilitado
4. auditoria visible del proveedor clinico realmente usado
5. demo reproducible con Audiometria y Espirometria

## Alcance obligatorio

### 1. Integracion de proveedor clinico

1. agregar integracion API con Featherless para la capa de prediagnostico
2. modelar configuracion por entorno sin hardcodear secretos
3. registrar `clinical_provider` y `clinical_model_used`
4. mantener fallback funcional

### 2. Conservacion de arquitectura actual

1. no mover Gemini fuera de extraccion
2. no mezclar extraccion y prediagnostico en una sola llamada opaca
3. no redisenar la papeleta ni el flujo clinico

### 3. Validacion del piloto

1. probar al menos un caso nominal de Audiometria
2. probar al menos un caso nominal de Espirometria
3. probar un caso de error o indisponibilidad del proveedor clinico
4. dejar evidencia del comportamiento de fallback

## Restricciones

1. no montar infraestructura propia
2. no implementar MedGemma 4B en esta iteracion
3. no ampliar el piloto a otros estudios sin evidencia positiva de este corte
4. no ocultar limites reales del proveedor o del plan

## Anclas tecnicas probables

1. backend/app/services/ai/prediagnostic.py
2. backend/app/services/ai/base.py o nuevo wrapper de proveedor clinico
3. backend/tests/test_ai_pipeline.py
4. frontend/src/actions/ai-prediagnosis.actions.ts
5. cualquier snapshot o metadata donde hoy se registra el modelo clinico

## Criterios de aceptacion minimos

1. el archivo crudo sigue entrando solo a Gemini para extraccion
2. MedGemma recibe solo payload textual o estructurado
3. Audiometria y Espirometria pueden correr el piloto sin romper el flujo actual
4. el sistema deja trazado si uso MedGemma o fallback
5. el prediagnostico sigue siendo modo sombra y revision medica obligatoria
6. la implementacion no requiere infraestructura propia ni despliegue self-hosted

## Nota de ejecucion

Si Featherless no puede quedar operativo por credenciales o restriccion externa, no simular exito. Dejar el punto de integracion, el fallback y la evidencia clara del bloqueo real para decision posterior.
