# DICTAMEN TÉCNICO: Incoherencias de UI/Navegación que hacen parecer incompleto el sistema
- **ID:** FIX-20260324-01
- **Fecha:** 2026-03-24
- **Solicitante:** Usuario
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
1. La navegación global en [frontend/src/app/layout.tsx](frontend/src/app/layout.tsx#L23-L46) es estática y se renderiza para toda la app, incluyendo la pantalla pública de login. Al mismo tiempo, [frontend/src/middleware.ts](frontend/src/middleware.ts#L33-L40) restringe `/admin/*` y `/portal/*` por rol. Resultado observable: el usuario ve módulos que aparentan existir para su sesión, pero al entrar es redirigido o bloqueado; eso se percibe como sistema incompleto o inconsistente, no como control de acceso.
2. En [frontend/src/app/companies/page.tsx](frontend/src/app/companies/page.tsx#L74-L83) existe un CTA visible de `Editar` sin `href` ni `onClick`, mientras el segundo CTA solo dice `Puestos de Trabajo`. Sin embargo, la vista destino [frontend/src/app/companies/[id]/page.tsx](frontend/src/app/companies/[id]/page.tsx#L69-L79) también administra sucursales permitidas y perfiles ligados a puestos. Resultado observable: la tarjeta de empresa promete una edición que no ocurre y además oculta que el detalle resuelve más de un submódulo.
3. El punto de entrada por defecto sigue sesgado al módulo histórico de trabajadores: [frontend/src/app/login/page.tsx](frontend/src/app/login/page.tsx#L21) usa `/workers` como `callbackUrl` por defecto y [frontend/src/app/page.tsx](frontend/src/app/page.tsx#L3-L4) redirige `/` a `/workers`. Resultado observable: aun cuando ya existen Dashboard, Empresas, Perfiles y flujo de Citas más completo, la primera impresión aterriza siempre en un solo módulo y refuerza la idea de que faltan opciones.
4. La unificación reciente de perfiles no terminó de consolidarse en nombres y puntos de entrada. La ruta oficial queda declarada en [frontend/src/app/admin/profiles/page.tsx](frontend/src/app/admin/profiles/page.tsx#L2-L5), pero en el flujo de citas el campo visible `Perfil Médico` sigue enviándose como `serviceProfileId` en [frontend/src/components/AppointmentFormModal.tsx](frontend/src/components/AppointmentFormModal.tsx#L443-L454). Esto no siempre rompe la UI, pero sí delata una migración incompleta y explica por qué varias piezas aún “se sienten” desalineadas.
5. Hay funciones reales que quedaron expuestas solo de forma contextual y no en la navegación lateral. Ejemplo verificable: la vista de `3 Agendas` existe en [frontend/src/app/appointments/page.tsx](frontend/src/app/appointments/page.tsx#L158-L167), pero el sidebar de [frontend/src/app/layout.tsx](frontend/src/app/layout.tsx#L23-L46) solo muestra `Gestión de Citas`. Lo mismo ocurre con la configuración detallada por empresa: existe, pero solo se descubre entrando a una tarjeta específica.

### B. Justificación de la Solución
No hay evidencia de ausencia real de módulos en los puntos revisados. El problema dominante es de exposición y coherencia:
- hay funcionalidades existentes pero escondidas detrás de rutas profundas;
- hay CTAs visibles que no hacen nada;
- la navegación no distingue contexto de autenticación ni rol;
- el sistema sigue aterrizando en un módulo antiguo como si fuera el centro único del producto;
- la nomenclatura de perfiles quedó a medio migrar.

En conjunto, eso produce una regresión de percepción: el usuario interpreta “faltan módulos” cuando en realidad varias capacidades sí están implementadas pero no están bien anunciadas, etiquetadas o habilitadas según contexto.

### C. Instrucciones de Handoff para SOFIA/GEMINI/INTEGRA
1. Corregir primero el bug visible de CTA roto en [frontend/src/app/companies/page.tsx](frontend/src/app/companies/page.tsx#L77): o conectar `Editar` a una acción real o retirarlo temporalmente.
2. Hacer la navegación lateral y el chrome dependientes de contexto mínimo:
   - ocultar sidebar/header en `/login`;
   - ocultar entradas no autorizadas por rol, especialmente `Portal de Empresas` para usuarios no `COMPANY_CLIENT` y módulos `admin` para roles no `ADMIN`.
3. Reetiquetar el acceso de empresa para reflejar lo que realmente contiene la ruta [frontend/src/app/companies/[id]/page.tsx](frontend/src/app/companies/[id]/page.tsx): algo equivalente a `Configurar empresa` o `Ver configuración`, sin rediseño mayor.
4. Cambiar el punto de entrada por defecto desde `/workers` a una vista más representativa del sistema actual, idealmente `dashboard` para staff autenticado. Si no se quiere tocar lógica de roles aún, al menos evitar que `/` y el post-login envíen siempre a `workers`.
5. Completar la limpieza semántica de perfiles: mantener `MedicalProfile/Perfil Médico` como nombre visible y eliminar restos de `serviceProfile` en formularios, mensajes y referencias de UI para reducir la sensación de módulo duplicado o migración incompleta.
6. Como ajuste mínimo de discoverability, añadir accesos secundarios visibles a funciones ya existentes pero profundas, empezando por:
   - configuración detallada de empresas desde la tarjeta de empresa;
   - vista `3 Agendas` desde navegación secundaria de citas o desde el sidebar si el negocio la considera módulo estable.

### Nota Forense
Se intentó obtener segunda opinión con Qodo CLI en modo solo lectura, pero la herramienta reportó que fue retirada del entorno y no estuvo disponible para esta revisión.