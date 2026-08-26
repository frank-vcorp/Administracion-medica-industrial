# SPEC-HANDOFF — FEATURE-20260825-04 ZIP de cierre clínico

Origen: ATLAS
SPEC activa: `context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md`
Objetivo: implementar rápidamente un endpoint autenticado para descargar ZIP consolidado por Event.
Incluye: dictamen general, dictamen por estudio aplicable, fuente original por estudio cuando exista y `manifest.txt`.
Permisos: sólo SUPERADMIN/DOCTOR_GENERAL/DOCTOR_VALIDATOR; COMPANY_CLIENT=403.
Integridad: resolver todo por eventId; no mezclar pacientes; ausencias declaradas.
Reutilización: usar rutas/helpers/PDF existentes; sin migración ni almacenamiento nuevo.
Validación: mínima y dirigida; no suite completa. Ejecutar lint/typecheck focal, un test/smoke de estructura y build si aplica.
No inferir: archivos fuente inexistentes, estudios no pertenecientes al Event ni permisos adicionales.
Estado: READY_FOR_SOFIA
