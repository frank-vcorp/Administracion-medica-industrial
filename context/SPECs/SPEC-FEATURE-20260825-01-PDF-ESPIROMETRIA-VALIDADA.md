# SPEC-FEATURE-20260825-01 — PDF de Espirometría validada

- **Estado:** READY_FOR_SOFIA
- **Autorización:** Frank autorizó migración Prisma y solicitó implementación inmediata.

## Objetivo

Al aceptar o editar el prediagnóstico de Espirometría, generar un PDF descargable con la versión validada por el médico, firma, cédula y membrete AMI.

## Alcance

- Agregar a `User`: `professionalLicense String?`, `signatureImageUrl String?` o payload equivalente seguro, sin exponer firma a otros usuarios no autorizados.
- Agregar a `DoctorStudyReview`: referencia opcional al PDF validado (`validatedPdfUrl`), fecha de generación y hash si el patrón existente lo permite.
- El PDF se genera sólo para `REVIEWED_ACCEPTED` y `REVIEWED_EDITED`; rechazado no genera PDF.
- Contenido: paciente/estudio, extracción clínica relevante, criterios de repetibilidad, impresión sugerida validada, recomendaciones validadas, nombre completo del usuario de sesión, cédula, firma y fecha/hora.
- Logo AMI arriba a la derecha: `https://medicaindustrial.com/sites/default/files/logo-2023.fw_.png`; preferir descarga/cache local o fuente remota segura según infraestructura existente.
- Pie: datos institucionales AMI del documento clínico: evaluaciones médicas/outsourcing/capacitación/ergonomía/fisioterapia/nutrición; Circuito del Mesón #135 Col. Del Prado C.P. 76030; (442) 225-52-67; www.medicaindustrial.com.
- Botón de descarga desde el Event/revisión.

## Contratos protegidos

No modificar extracción M3, repetibilidad, criterios AMI, prompt clínico, cuestionario ni dictamen de aptitud general. La impresión IA y recomendaciones no se copian del texto fuente; el PDF usa la versión validada por el médico.

## Criterios

- Perfil permite guardar/editar nombre, cédula y firma con validación.
- Aceptar/editar crea revisión y PDF; el PDF queda asociado y descargable.
- La firma/cédula usada queda congelada en la revisión/PDF aunque el perfil cambie después.
- Errores de generación son visibles y no marcan revisión como PDF listo.
- Rechazo no genera PDF.
- Playwright verifica perfil → revisión → descarga y contenido/headers básicos.

## Validación

V1 typecheck/tests PDF/actions/schema; V2 suite; V3 Playwright del flujo.

## Migración

Aditiva y nullable; aplicar Prisma en Railway después de validar localmente. No borrar datos existentes.
