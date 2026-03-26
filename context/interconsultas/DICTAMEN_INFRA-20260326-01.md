# Dictamen de Auditoría de Especificación

**ID de Dictamen:** `INFRA-20260326-01`
**ID de SPEC Auditada:** `ARCH-20260326-16`
**Agente Auditor:** GEMINI-CLOUD-QA
**Fecha:** 2026-03-26

## 1. Resumen Ejecutivo

La especificación `ARCH-20260326-16` es conceptualmente sólida, con un excelente enfoque en la seguridad del paciente, la gobernanza de la IA y la trazabilidad. Sin embargo, presenta ambigüedades significativas en áreas técnicas clave que impedirían una implementación directa y sin fricciones por parte del agente SOFIA. Se requieren definiciones explícitas en persistencia, gestión de evidencia, flujo de errores y contratos de API/UI.

## 2. Hallazgos y Recomendaciones

| # | Área | Hallazgo | Riesgo de Ambigüedad | Recomendación para INTEGRA |
|---|---|---|---|---|
| 1 | **Persistencia de Datos** | La SPEC define las estructuras JSON pero no el esquema de la base de datos (tablas, relaciones, columnas) para almacenarlas. | **Alto** | Proveer un diff del `schema.prisma` o un diagrama ERD que muestre cómo se relacionarán las nuevas entidades (`StructuredParameter`, `AIPrediagnosis`, `DoctorReview`) con el modelo `ClinicalStudy` existente. |
| 2 | **Corpus de Evidencia** | Se exige un "corpus controlado y versionado" para las citas clínicas, pero no se define su implementación técnica. | **Alto** | Definir el formato (ej. tabla `ClinicalEvidenceSource` en la DB), el proceso de carga/actualización de fuentes y el endpoint para que la IA lo consulte. |
| 3 | **Manejo de Errores y Confianza Baja** | El flujo para un prediagnóstico "no concluyente" no está detallado a nivel de UI/UX. | **Medio** | Especificar el estado visual que debe renderizar el frontend cuando la confianza de la IA es baja o la extracción falla. Incluir mensajes de cara al usuario. |
| 4 | **Contrato de API** | Faltan las definiciones de los nuevos endpoints del backend necesarios para el flujo CRUD (Crear, Leer, Actualizar, Eliminar) de las nuevas entidades. | **Alto** | Definir las rutas de la API (ej. `POST /api/studies/{id}/prediagnosis`), los métodos HTTP, y los esquemas Zod para los cuerpos de solicitud y respuesta. |
| 5 | **Diseño de UI/UX** | La integración de los nuevos elementos en el frontend se menciona a nivel de archivo, pero sin guía visual. | **Medio** | Adjuntar un boceto simple o wireframe para `PapeletaWorkspace.tsx` que muestre la disposición de la vista de parámetros, el prediagnóstico IA y el formulario de feedback del médico. |
| 6 | **Soft Gates** | La SPEC no define los criterios de prueba específicos (Soft Gates) para esta funcionalidad. | **Bajo** | Añadir una sección "Criterios de Aceptación Técnica (Soft Gates)" que incluya: 1. **Compilación:** Sin errores. 2. **Testing:** Tests unitarios para los nuevos servicios de IA y endpoints. Test E2E para el flujo de validación médica. 3. **Revisión:** Adherencia a los nuevos esquemas. 4. **Documentación:** JSDoc para los nuevos componentes y servicios. |

## 3. Veredicto de Viabilidad

La especificación es **viable conceptualmente** pero **no implementable directamente** en su estado actual. Se requiere una nueva iteración por parte de INTEGRA para resolver las ambigüedades técnicas antes de asignarla a SOFIA.

**Acción recomendada:** Devolver la SPEC a INTEGRA con este dictamen para su refinamiento.
