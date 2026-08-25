# SPEC-HANDOFF — FEATURE-20260825-01

Origen: ATLAS
SPEC: `context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md`

Implementar PDF validado de Espirometría y perfil médico. Frank autorizó migración Prisma. Reutilizar PDF/actions existentes cuando sea seguro. Perfil: cédula profesional y firma autógrafa. Revisión accepted/edited debe congelar identidad/firma/cédula en la evidencia generada; rejected no genera PDF. Membrete AMI arriba derecha con logo proporcionado y pie institucional AMI.

Inspeccionar primero `frontend/prisma/schema.prisma`, `DoctorStudyReview`, `StudyAIPrediagnosisPanel`, `ai-prediagnosis.actions.ts`, `MedicalDictamenPDF.tsx` y rutas PDF. Añadir schema/migración, perfil UI mínimo, generación server-side o patrón PDF existente, URL/descarga protegida y tests. No tocar extracción, cuestionario, criterios ni aptitud general.

Validar V1/V2; devolver IMPL-REPORT. No commit/push/deploy durante implementación SOFIA.
