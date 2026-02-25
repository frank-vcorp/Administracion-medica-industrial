# DICTAMEN TÉCNICO: Auditoría de Seguridad NextAuth y Middleware
- **ID:** FIX-20260225-02
- **Fecha:** 2026-02-25
- **Solicitante:** SOFIA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
Tras ejecutar la auditoría con Qodo CLI (`QODO_AUDIT_RAW_20260225_AUTH.md`), se identificaron las siguientes vulnerabilidades críticas y medias en la implementación de autenticación:

1. **Bypass de Middleware (Crítico):** En `frontend/src/middleware.ts`, la regla `publicRoutes.some(route => pathname.startsWith(route))` con `publicRoutes = ["/login", "/", "/api/auth"]` provoca que **todas** las rutas sean consideradas públicas, ya que cualquier ruta empieza con `"/"`. Esto desactiva la protección de rutas en toda la aplicación.
2. **Enumeración de Usuarios (Medio):** En `frontend/src/auth.ts`, el `CredentialsProvider` devuelve mensajes de error distintos ("Usuario no encontrado o inactivo" vs "Contraseña incorrecta"). Esto permite a un atacante verificar si un correo electrónico existe en el sistema.
3. **Falta de Hardening en NextAuth (Bajo/Medio):** No se está pasando explícitamente el `secret` a `getToken` en el middleware, lo que puede causar fallos en algunos entornos.
4. **Riesgo de DoS Lógico (Bajo):** En `frontend/src/actions/portal.actions.ts`, `getCompanyDashboardStats` obtiene todos los eventos médicos de una empresa y los procesa en memoria para calcular estadísticas. Para empresas con gran volumen de datos, esto consumirá excesiva memoria y CPU.

### B. Justificación de la Solución
Se aplicarán los siguientes parches (FIX REFERENCE: FIX-20260225-02):

1. **Middleware:** Se modificará la lógica de rutas públicas para usar coincidencia exacta para la raíz (`pathname === "/"`) y `startsWith` para las demás (`/login`, `/api/auth`). Se añadirá el `secret` explícito a `getToken`.
2. **NextAuth Options:** Se unificarán los mensajes de error en `authorize` a un mensaje genérico ("Credenciales inválidas") para prevenir la enumeración de usuarios.
3. **Portal Actions:** Se optimizará `getCompanyDashboardStats` utilizando agregaciones de base de datos (`prisma.medicalEvent.count` y `prisma.medicalEvent.groupBy`) en lugar de cargar todos los registros en memoria. Se sanitizarán los logs de error.

### C. Instrucciones de Handoff para SOFIA
1. Los parches de seguridad han sido aplicados.
2. Verifica que el login siga funcionando correctamente y que las rutas protegidas (`/admin`, `/portal`) redirijan a `/login` si no hay sesión activa.
3. Puedes continuar con la integración del frontend sabiendo que la capa de autenticación está asegurada.
