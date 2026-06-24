# Checkpoint CHK_2026-06-24_AUTO-ALTA-FIX-URL-PUBLICA

**Fecha:** 2026-06-24
**Sesión:** Fix bug link auto-alta (URL localhost en producción) + planificación feature gestión de datos completos
**Estado:** ✅ Cierre completo (2 commits mergeados y pusheados a `origin/main`)

---

## Resumen ejecutivo

Sesión bifurcada en dos entregables relacionados:

1. **FIX activo mergeado a producción**: el link de auto-alta generado por el modal "Link de auto-alta generado" ya no sale con `http://localhost:3000/...` en producción. Ahora auto-detecta el dominio público de Vercel. Adicionalmente incluye `?ref=<userId>` para identificar al usuario staff que lo emitió.

2. **SPEC documentada para próximo micro-sprint**: gestión de datos completos de empresa con dos vías (link externo para auto-servicio + edición interna solo ADMIN con `AuditLog` completo).

---

## Commits entregados

```
b3b7157 docs: SPEC + handoff ARCH-20260624-03 (gestión datos completos empresa)
18bba39 fix(auto-alta): URL pública de producción + trazabilidad de emisor (?ref=userId)
```

Ambos pusheados a `origin/main` (rama sincronizada, sin commits ahead).

---

## Archivos modificados/creados

### Commit `18bba39` (fix activo)
- **NUEVO** `frontend/src/lib/env/public-base-url.ts` (helper `getPublicBaseUrl`, 41 líneas)
- **NUEVO** `frontend/src/lib/env/public-base-url.test.ts` (9 tests)
- **MOD** `frontend/src/services/company.service.ts` (+8/-3): helper + `?ref=` con `encodeURIComponent`
- **MOD** `frontend/src/services/__tests__/company.service.test.ts` (+7 tests)
- **NUEVO** `context/SPECs/SPEC_ARCH-20260624-02-LINK-AUTO-ALTA-URL-PUBLICA-TRAZABILIDAD.md`
- **NUEVO** `context/interconsultas/HANDOFF_ARCH-20260624-02_SOFIA_LINK-AUTO-ALTA-URL-PUBLICA.md`
- **MOD** `PROYECTO.md`

### Commit `b3b7157` (documentación)
- **NUEVO** `context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md`
- **NUEVO** `context/interconsultas/HANDOFF_ARCH-20260624-03_SOFIA_EDICION-DATOS-COMPLETOS.md`
- **MOD** `PROYECTO.md`

---

## Validaciones

### `ARCH-20260624-02` (fix)
- `pnpm typecheck` ✅ exit 0
- `pnpm test` ✅ 38/38 pasaron (16 nuevos: 9 helper + 7 service)
- `pnpm lint` ⚠ 49 problemas pre-existentes en archivos no tocados; 0 nuevos en esta PR
- GEMINI auditoría (subagent_type='gemini'): **APROBADO_CON_OBSERVACIONES**, 0 bloqueadores
  - Observación 1 (nice-to-have): unificar mocking style en tests del helper
  - Observación 2 (nice-to-have): considerar renombrar `?ref=` a `?issuerId=`

### `ARCH-20260624-03` (SPEC documentada, sin implementación aún)
- Diseño validado con humano: solo ADMIN edita internamente, auditoría completa
- Migración Prisma aditiva (no rompe schema actual)
- Reutiliza `AuditLog` existente (no crea tabla nueva)

---

## Cambios de comportamiento en producción

### Antes del fix
```
http://localhost:3000/auto-alta/Y3WOzGPreWUulyS2wxCQvg8KMkdcgOvGo7AaPYLmTP4
```
→ El prospecto no podía abrir el link. Bug activo.

### Después del fix
```
https://administracion-medica-industrial.vercel.app/auto-alta/Y3WOzGPreWUulyS2wxCQvg8KMkdcgOvGo7AaPYLmTP4?ref=u_abc123
```
→ El prospecto abre el link en el dominio público correcto. El `?ref=` identifica al emisor para auditoría visual.

**Auto-detección del dominio**: el helper `getPublicBaseUrl()` consulta en orden:
1. `NEXT_PUBLIC_BASE_URL` (override manual, prioridad alta)
2. `VERCEL_PROJECT_PRODUCTION_URL` (auto en Vercel cuando configuras dominio custom)
3. `VERCEL_URL` (auto en Vercel, fallback `*.vercel.app`)
4. `http://localhost:3000` (dev)

→ Cuando Frank configure el dominio custom real en Vercel, el sistema lo auto-detecta sin tocar código ni env vars.

---

## Decisiones arquitectónicas documentadas

| ID | Decisión |
|---|---|
| ARCH-20260624-02 | URL pública con fallback jerárquico + `?ref=<userId>` para trazabilidad |
| ARCH-20260624-03 | Gestión de datos completos de empresa con dos vías (link externo + edición interna); RBAC solo ADMIN para edición; `AuditLog` completo |

---

## Pendiente para próxima sesión

### `ARCH-20260624-03` — Implementación
Estimación: 1 sesión de 8h o 2 micro-sprints.

Orden sugerido (handoff listo en `context/interconsultas/HANDOFF_ARCH-20260624-03_SOFIA_EDICION-DATOS-COMPLETOS.md`):
1. Migración Prisma (`targetCompanyId`)
2. Schemas Zod (`company-update.ts`)
3. Service — Sub-A (`generateCompanySelfRegLink` con target + `submitCompanySelfRegistrationCore` con rama UPDATE + AuditLog + optimistic locking)
4. Service — Sub-B (`updateCompany` con optimistic locking + AuditLog)
5. Actions (`generateCompanyDataCompletionLinkAction`, `updateCompanyAction`)
6. UI — Sub-A (botón en `CompanyFormModal` + sub-modal de URL)
7. UI — Sub-B (ruta `/edit`, `CompanyEditForm`, botón en ficha)
8. Tests (unit + integration + E2E)
9. GEMINI auditoría
10. Checkpoint de cierre

### Verificación post-deploy del fix actual (manual)

Una vez que Vercel redespliegue con `18bba39`:
1. Como ADMIN/VENDEDOR, generar link en `/companies`.
2. Confirmar que el link empieza con `https://administracion-medica-industrial.vercel.app/` (o el dominio custom si ya está configurado).
3. Confirmar que termina con `?ref=<userId>`.
4. Pegar en pestaña incógnito: el formulario `/auto-alta/[token]` debe cargar.
5. En Prisma Studio: `CompanySelfRegistration.createdByUserId` tiene el userId correcto.

---

## Riesgos conocidos

| Riesgo | Estado |
|---|---|
| Links previamente compartidos con `localhost` quedan muertos | Aceptable. Regenerar es 1 click en el modal. La BD mantiene token + hash. |
| `?ref=` se puede borrar al reenviar por WhatsApp | Aceptable. La trazabilidad legal está en `CompanySelfRegistration.createdByUserId` (BD). El ref es solo UX/visual. |
| Concurrencia entre staff editando y empresa enviando link (futuro `ARCH-20260624-03`) | Diseñado con optimistic locking + 409 CONFLICT explícito. |

---

## Artefactos vinculados

- **SPEC fix**: `context/SPECs/SPEC_ARCH-20260624-02-LINK-AUTO-ALTA-URL-PUBLICA-TRAZABILIDAD.md`
- **Handoff fix**: `context/interconsultas/HANDOFF_ARCH-20260624-02_SOFIA_LINK-AUTO-ALTA-URL-PUBLICA.md`
- **SPEC feature**: `context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md`
- **Handoff feature**: `context/interconsultas/HANDOFF_ARCH-20260624-03_SOFIA_EDICION-DATOS-COMPLETOS.md`
- **Diario**: `PROYECTO.md` (entradas 2026-06-24 ARCH-20260624-02 y ARCH-20260624-03)
