# SPEC: Portal B2B Empresarial

- **ID:** ARCH-20260224-02
- **Autor:** INTEGRA
- **Estado:** ✅ COMPLETADO

## 📌 Contexto
La Fase 1 (Core Médico, Expedientes e Inteligencia Artificial) se completó con éxito. Ahora se requiere exponer un subconjunto de estos datos hacia el Cliente Final: Las Empresas que envían a sus trabajadores.

## 🎯 Objetivo (Micro-Sprint 2)
Implementar un "Portal B2B" en el frontend `/dashboard` o `/companies/[id]/portal` (a definir por SOFIA) que permita a un administrador de empresa consultar a sus empleados, el estado de sus expedientes (En proceso, Finalizado) sin ver detalles médicos confidenciales, solo el "Apto" o "No Apto".

## 🚧 Requerimientos de Construcción (@SOFIA)
1. **Rutas Sugeridas**:
   - `/portal`: Vista general (simulando que el usuario logueado es la Empresa 'X').
   - `/portal/workers`: Listado de empleados de su nómina.
   - `/portal/events`: Histórico de citas/chequeos de su personal.
2. **Tablas Base a Consultar (Prisma)**:
   - Traer `MedicalEvent` donde `worker.companyId` sea el de la empresa.
   - Mostrar el `finalDiagnosis` (o un campo derivado de `Apto/No Apto`) del modelo `MedicalVerdict`.
3. **Capa de Abstracción (Componentes)**:
   - Crear componentes reutilizables tipo `CompanyStatCard` y `WorkerStatusTable`.
4. **Restricción**: 
   - No exponer las URIs estáticas de los PDFs (`upload`) por privacidad. Solo mostrar un placeholder simulando "Descargar Dictamen Legal".

## 🚪 Criterios de Aceptación (Gates de Calidad)
- [x] SOFIA debe construir el UI con ShadCN/Tailwind alineándose a la estética limpia (Teal/Blue) del proyecto.
- [x] Omitir auth compleja por ahora (MIP - Mínima Intervención). Hardcodear "Empresa 1" o pasar el `companyId` por URL.
- [x] **Al terminar, SOFIA deberá notificar a DEBY para QA Forense.**
