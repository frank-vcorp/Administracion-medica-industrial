# ADR-20260624-01 — Ruta pública adicional sin token para auto-alta de cliente

**Fecha:** 2026-06-24
**Estado:** [✓] Aprobada
**ID:** ARCH-20260624-01

## Contexto

El módulo Ficha de Cliente v2 (ARCH-20260623-03) implementó la ruta `/auto-alta/[token]` como único punto de entrada público para auto-alta de prospectos. El flujo asume que un vendedor/admin genera el link con `generateCompanySelfRegLink`, lo comparte con el prospecto, y el prospecto lo abre con el token en la URL.

Esto cubre el caso comercial (vendedor manda link por email/WhatsApp al prospecto). Pero hay otros casos donde se necesita una **puerta de entrada pública directa**:

1. **Demos a prospectos en reunión**: el vendedor no quiere generar un link fresco cada vez para mostrar el formulario.
2. **Landing page de marketing**: la web corporativa de AMI podría tener un botón "Solicita tu alta" que lleva directamente al formulario, sin gatekeeper de token.
3. **Generación espontánea de leads**: visitantes anónimos del sitio pueden solicitar información/alta sin contacto previo.

El usuario explícitamente pidió una URL pública adicional sin token (`quiero una url publica sin token adicional a lo de la specificacion`).

## Decisión

Agregar una **segunda ruta pública** además de la existente:

| Ruta | Gatekeeper | Caso de uso |
|---|---|---|
| `/auto-alta/[token]` | Token hash + expiración | Link generado por vendedor para prospecto específico |
| `/solicitar-alta` | **Ninguno** (URL pública directa) | Demo, landing page, captura de leads sin gatekeeper |

### D9 — Ruta pública adicional sin token

1. **Nueva ruta**: `frontend/src/app/solicitar-alta/page.tsx` (server component, sin auth).
2. **Sin token**: cualquier visitante con la URL puede acceder. No se genera ni valida token.
3. **Mismo formulario**: reusa `frontend/src/components/companies/SelfRegistrationForm.tsx` (idéntico al de `/auto-alta/[token]`).
4. **Misma server action**: reusa `submitCompanySelfRegistration` con un parámetro `origenToken: null` para distinguir el path.
5. **Mismo resultado**: crea `Company` con `origen=AUTO_ALTA`, `estado=PENDIENTE_REVISION`.
6. **Sin token no hay**: validación de expiración, cancelación, ni tracking de aperturas.

### D10 — Diferenciación del origen en el modelo

Para distinguir entre auto-alta con link y auto-alta directa, agregar campo opcional a `CompanySelfRegistration`:

```prisma
model CompanySelfRegistration {
  // ... campos existentes ...
  channel  String?  // 'VENDOR_LINK' | 'PUBLIC_DIRECT' (default: 'VENDOR_LINK')
}
```

El server action `submitCompanySelfRegistration` recibe `channel` y lo guarda. Si es `PUBLIC_DIRECT`, no requiere token (nuevo path server-side).

### D11 — Server action actualizada

Refactorizar `submitCompanySelfRegistration` para soportar ambos paths:

```ts
submitCompanySelfRegistration(
  source: 'TOKEN' | 'PUBLIC',
  payload: CompanyFullFormPayload,
  token?: string  // requerido solo si source='TOKEN'
)
```

Internamente:
- Si `source='TOKEN'`: valida token, busca `CompanySelfRegistration` por `tokenHash`, status=ACTIVE, expiresAt>NOW.
- Si `source='PUBLIC'`: omite toda validación de token. Marca el nuevo `CompanySelfRegistration` con `channel='PUBLIC_DIRECT'` y `createdByUserId=null` (no hay vendedor generador).

### D12 — Sin impacto en seguridad

El gatekeeper de fondo sigue siendo **el estado `PENDIENTE_REVISION`**. Independientemente de la ruta:

1. El cliente NO queda habilitado al enviar.
2. Aparece en `/companies?estado=PENDIENTE_REVISION` para vendedores/admin.
3. Un vendedor debe revisar, asignar vendedor, y habilitar manualmente.
4. NO se crean citas, proyectos ni eventos médicos hasta que `estado=HABILITADO`.

### D13 — Comportamiento idéntico al cliente

El formulario es idéntico: 10 secciones, validaciones Zod, subida de archivos al bucket con scope dedicado. El prospecto NO nota diferencia entre las dos rutas, excepto que en `/solicitar-alta` no necesita un link previo.

## Scope del corte

### Incluido

- Nueva ruta `frontend/src/app/solicitar-alta/page.tsx` (server component, sin auth).
- Refactor de `submitCompanySelfRegistration` para soportar `source='TOKEN' | 'PUBLIC'`.
- Refactor de `validateCompanySelfRegToken` para que `validateCompanySelfRegPublicAccess` (nueva) no requiera token.
- Migración: agregar columna `channel` a `CompanySelfRegistration` (default `'VENDOR_LINK'`).
- Actualización de `SelfRegistrationForm.tsx` para aceptar prop `source: 'TOKEN' | 'PUBLIC'` (default `'TOKEN'` por compatibilidad).
- Actualización de `CompanyFormModal.tsx` y `CompanyActionsPanel.tsx` para pasar `source` correcto.
- Badge en ficha del cliente que indique `origenCanal: VENDOR_LINK | PUBLIC_DIRECT`.

### Excluido (futuro)

- Captcha o rate limiting en `/solicitar-alta` (queda como riesgo controlado; ver sección Riesgos).
- Confirmación por email al prospecto (no hay captura de email en el formulario).
- Multi-paso con guardado parcial (la V1 sigue siendo submit atómico).
- Anti-spam heurístico o filtros de país.

## Archivos autorizados (≤10)

1. `frontend/prisma/schema.prisma` — agregar `channel` a `CompanySelfRegistration`.
2. `frontend/prisma/migrations/20260624_company_self_reg_channel/migration.sql` — nueva migración.
3. `frontend/src/app/solicitar-alta/page.tsx` — nueva ruta pública.
4. `frontend/src/services/company.service.ts` — refactor `submitCompanySelfRegistration` + nuevo `submitPublicCompanySelfRegistration`.
5. `frontend/src/actions/company.actions.ts` — nueva server action pública `submitPublicCompanySelfRegistration`.
6. `frontend/src/components/companies/SelfRegistrationForm.tsx` — agregar prop `source`.
7. `frontend/src/app/auto-alta/[token]/page.tsx` — pasar `source='TOKEN'` explícito.
8. `frontend/src/components/CompanyFormModal.tsx` — sin cambios funcionales (genera link como antes).
9. `frontend/src/components/companies/CompanyActionsPanel.tsx` — badge de origen canal.
10. `frontend/src/lib/schemas/company-full-form.ts` — agregar `channel` opcional al payload.

## Restricciones

1. NO eliminar ni reemplazar `/auto-alta/[token]`. La ruta con token sigue siendo la fuente principal de leads comerciales.
2. NO introducir captcha, rate limiting ni autenticación adicional en `/solicitar-alta` en este corte.
3. NO crear una nueva tabla ni modelo. Solo agregar campo opcional.
4. NO romper el flujo existente con token. Validación retrocompatible: `channel='VENDOR_LINK'` por default.
5. NO usar `dangerouslySetInnerHTML` ni exponer tokens en HTML.
6. Storage del bucket Railway reutilizado. Mismo scope `companies/selfreg/{tokenHash[:8]}/` si hay token, o `companies/public/{random8}/` si es público directo.

## Riesgos controlados

1. **Abuso/spam**: cualquier visitante puede enviar datos. Mitigación V1: `estado=PENDIENTE_REVISION` bloquea uso operacional. Mitigación futura: captcha + rate limit en sprint posterior.
2. **Email no confirmado**: el prospecto puede enviar datos con email incorrecto. Mitigación: el vendedor al revisar puede corregir email antes de habilitar.
3. **Sin trazabilidad del visitante**: no hay forma de saber quién envió el form si se vuelve spam. Mitigación: registrar IP en `AuditLog` al recibir submit público.
4. **Storage huérfano**: si el prospecto sube archivos pero nunca envía, quedan en el bucket. Mitigación: cron de limpieza (fuera de este corte) o scope dedicado `companies/public/{random8}/` que admin puede purgar.

## Validación

```bash
cd frontend && npm run typecheck
cd frontend && npm test -- --run
cd frontend && npm run lint
```

**Smoke test manual**:

1. Sin sesión activa, abrir `http://localhost:3000/solicitar-alta` → debe renderizar formulario.
2. Llenar 10 secciones + archivos → enviar → debe crear Company con `origen=AUTO_ALTA, estado=PENDIENTE_REVISION`.
3. Login vendedor → `/companies?estado=PENDIENTE_REVISION` → ver el nuevo cliente → revisar/habilitar.
4. Verificar que `/auto-alta/[token]` sigue funcionando idéntico (no roto).
5. Verificar que en ficha del cliente aparece `channel: PUBLIC_DIRECT` en metadata.

## Referencias

- `context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md` — spec base.
- `context/decisions/ADR-20260623-02-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md` — decisiones D1-D8.
- `frontend/src/app/auto-alta/[token]/page.tsx` — ruta existente con token.
- `frontend/src/components/companies/SelfRegistrationForm.tsx` — formulario reutilizable.