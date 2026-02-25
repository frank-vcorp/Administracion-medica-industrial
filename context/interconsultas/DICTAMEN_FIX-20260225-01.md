# DICTAMEN TÉCNICO: Auditoría Módulo Portal B2B
- **ID:** FIX-20260225-01
- **Fecha:** 2026-02-25
- **Solicitante:** USER
- **Estado:** ❌ REQUIERE ACCIÓN (Riesgo Crítico de Seguridad)

### A. Análisis de Causa Raíz
Tras ejecutar una auditoría profunda de seguridad, performance y buenas prácticas sobre el código construido para el Sprint 2 (Portal B2B), empleando *Qodo CLI* como doble factor forense, se han detectado vulnerabilidades arquitectónicas críticas:

1. **Simulación de Sesión y Fuga de Datos Multi-Tenant (Severidad Crítica):** Las páginas del portal (`/portal/page.tsx`, `/portal/workers`, `/portal/events`) utilizan `await prisma.company.findFirst()` para determinar la empresa actual. Aunque útil como MVP local, en producción esto expondrá los datos de "la primera empresa del sistema" a **cualquier visitante** de la URL, constituyendo una vulnerabilidad de Acceso Inadecuado a Datos.
2. **Broken Access Control en Server Actions (Severidad Crítica):** Las acciones `getCompanyDashboardStats`, `getCompanyWorkersWithStatus` y `getCompanyEventsHistory` reciben `companyId` como parámetro del cliente sin validar si quien invoca pertenece realmente a dicha empresa. En un escenario vivo, un usuario podría inyectar el ID de otra corporación y extraer su historial médico.
3. **Exposición de PII/PHI (Severidad Media):** Se abusa de `include: { worker: true, verdict: true }`. Al traer la entidad completa del trabajador, se cargan a memoria datos sensibles (PII) que no se van a mostrar o que no deberían estar en el contexto corporativo B2B.

### B. Justificación de la Solución
No podemos dar por finalizado el Handoff y el despliegue del Sprint 2 con estas vulnerabilidades abiertas, especialmente tratando con historiales médicos laborales. 
Antes de invitar a empresas reales, se debe implementar una capa de Autenticación, restringir el parámetro `companyId` al tenant real del usuario logueado, y minimizar la carga útil de Prisma (mediante `select`).

### C. Instrucciones de Handoff para SOFIA
1. SOFIA, debes eliminar la lógica de "Mínima Intervención" (`findFirst()`) en el Frontend B2B.
2. Configurar la capa de Autenticación (se recomienda *NextAuth* / *Auth.js* si aún no existe, o Supabase Auth) para determinar el tenant corporativo (`companyId`) desde la Sesión Asegurada en Servidor (JWT).
3. Modificar `frontend/src/actions/portal.actions.ts` para que extraiga el `companyId` de la sesión segura del servidor, en vez de aceptarlo ciegamente desde el Cliente.
4. Optimizar las peticiones a Prisma Prisma reemplazando en lo posible los excesivos `include: { ... }` por bloque de datos limitados `select`.
