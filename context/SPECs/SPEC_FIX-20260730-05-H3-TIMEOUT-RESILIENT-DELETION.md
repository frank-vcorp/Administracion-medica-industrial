# SPEC_FIX-20260730-05-H3 — TIMEOUT-RESILIENT BULK COMPANY DELETION

**ID:** FIX-20260730-05-H3
**Tipo:** Fix arquitectónico
**Prioridad:** P1
**Stack:** Next.js 16 (App Router) + Prisma + PostgreSQL + Vercel Hobby
**Autor:** INTEGRA (2026-07-30)
**Dependencia:** ARCH-20260730-01 (eliminación masiva de empresas)
**Estado:** READY para SOFIA

## 1. Problema

`CompanyService.deleteCompanies` ejecuta hasta 10 empresas en un solo `prisma.$transaction` con 14 ops por empresa. Esto excede el timeout de Vercel Hobby (10s).

## 2. Decisión: chunks de 5 con commit intermedio

Procesamiento inline en server action, chunks de 5 con `prisma.$transaction` independiente por chunk.

**Semántica:** antes batch all-or-nothing → ahora per-chunk. Si timeout en chunk 2, chunk 1 ya commitido. Cliente detecta vía `router.refresh()`.

**Por qué 5:** 5 × 14 ops × ~35ms ≈ 2.5s/chunk, margen 7.5s contra timeout Vercel. Constante `DELETE_CHUNK_SIZE = 5` configurable.

## 3. Alcance

### Dentro
- Modificar `CompanyService.deleteCompanies`: loop de chunks
- Quitar límite visible "máximo 10 empresas por operación" (los chunks internos aceptan cualquier N)
- Manejar timeout con `try/catch + router.refresh()` en UI

### Fuera (NO TOCAR)
- `company.actions.ts` — la signature pública `deleteCompaniesAction` se preserva
- Schema Prisma
- backend FastAPI
- `vercel.json`
- Route Handlers nuevos

## 4. Diseño

### 4.1 `company.service.ts`

```ts
const DELETE_CHUNK_SIZE = 5

export async function deleteCompanies(args) {
  // Validaciones existentes (sin cambios)
  // Captura de nombres pre-delete (sin cambios)

  const deletedIds: string[] = []

  for (let i = 0; i < companyIds.length; i += DELETE_CHUNK_SIZE) {
    const chunk = companyIds.slice(i, i + DELETE_CHUNK_SIZE)

    await prisma.$transaction(async (tx) => {
      for (const companyId of chunk) {
        // 14 pasos por empresa (orden de ARCH-20260730-01 §3.3)
        await tx.companySellerHistory.deleteMany({ where: { companyId } })
        await tx.companySelfRegistration.deleteMany({
          where: { OR: [{ submittedCompanyId: companyId }, { targetCompanyId: companyId }] },
        })
        await tx.company.update({ where: { id: companyId }, data: { allowedBranches: { set: [] } } })
        await tx.user.updateMany({ where: { companyId }, data: { companyId: null } })
        await tx.jobPosition.updateMany({ where: { companyId }, data: { companyId: null } })
        await tx.medicalProfile.updateMany({ where: { companyId }, data: { companyId: null } })
        await tx.worker.updateMany({ where: { companyId }, data: { companyId: null } })
        await tx.appointment.updateMany({ where: { companyId }, data: { companyId: null } })
        await tx.medicalEvent.updateMany({ where: { billingCompanyId: companyId }, data: { billingCompanyId: null } })
        await tx.project.updateMany({ where: { companyId }, data: { companyId: null } })
        await tx.labOrder.updateMany({ where: { companyId }, data: { companyId: null } })
        await tx.company.update({ where: { id: companyId }, data: { defaultBranchId: null } })
        await tx.company.delete({ where: { id: companyId } })
      }

      // Audit log por chunk
      const chunkCompanies = companies.filter((c) => chunk.includes(c.id))
      await tx.auditLog.create({
        data: {
          userId: args.actorUserId,
          action: 'COMPANIES_HARD_DELETE',
          entity: 'Company',
          entityId: chunk.join(','),
          details: {
            deletedCompanyIds: chunk,
            deletedCompanyNames: chunkCompanies.map((c) => c.name),
            companyCount: chunk.length,
            reason: args.reason ?? null,
          } as Prisma.InputJsonValue,
        },
      })
    }, { timeout: 30000, maxWait: 10000 })

    deletedIds.push(...chunk)
  }

  return { ok: true, deletedCount: deletedIds.length, deletedCompanyIds: deletedIds }
}
```

### 4.2 `DeleteCompaniesButton.tsx`

```tsx
const handleConfirm = () => {
  setError(null)
  startTransition(async () => {
    try {
      const result = await deleteCompaniesAction({
        companyIds: selectedNames.map((s) => s.id),
        reason: reason.trim() || undefined,
      })
      if (result.ok) {
        setOpen(false)
        setReason('')
        setConfirmed(false)
        onClearSelection()
        router.refresh()
      } else {
        setError(`${result.code}: ${result.error}`)
      }
    } catch (err) {
      // Timeout o error de red. Chunks anteriores pueden estar commitidos.
      router.refresh()
      setOpen(false)
      onClearSelection()
      setError(
        'La operación pudo haber eliminado algunas empresas. ' +
        'La página se actualizó. Verifique la lista y re-intente con las restantes.'
      )
    }
  })
}
```

## 5. Archivos a modificar (4)

| Archivo | Cambio |
|---|---|
| `frontend/src/services/company.service.ts` | Refactor `deleteCompanies` con loop de chunks + `DELETE_CHUNK_SIZE` |
| `frontend/src/services/__tests__/company.service.delete.test.ts` | Tests para 3, 5, 10 empresas + error en chunk 2 |
| `frontend/src/components/companies/DeleteCompaniesButton.tsx` | try/catch + router.refresh() |
| `frontend/src/actions/company.actions.ts` | **Quitar el guard `> 10` y el `> 100`**. Solo mantener validación de array no vacío y validación Zod existente. |

## 6. Tests esperados

- 3 empresas → 1 `$transaction`, 1 audit log
- 5 empresas → 1 `$transaction`, 1 audit log
- 10 empresas → 2 `$transaction`, 2 audit logs
- 25 empresas → 5 `$transaction`, 5 audit logs
- 11 empresas → 5 `$transaction` (5+5+1), 3 audit logs
- Error en chunk 2 → chunk 1 persistido

El test CA-D2 actual (espera '10' en mensaje de error) **debe eliminarse o reescribirse** porque ya no hay límite visible.

## 7. Validaciones

```bash
cd frontend
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
./node_modules/.bin/eslint .
git diff --check
```

## 8. NO hacer

- NO commitear ni pushear.
- NO añadir schema nueva.
- NO tocar `vercel.json`.
- NO añadir Route Handlers nuevos.
- NO usar `qodo` (sunset).
- NO cambiar la signature pública de `deleteCompaniesAction`.

## 9. Self-review

- ¿El código refleja la SPEC?
- ¿Los tests cubren chunks 1, 2, error en chunk N?
- ¿Riesgo de regresión sobre ARCH-20260730-01?
- ¿Eliminó el guard `> 10` / `> 100` del action?

## Reporte

- 4 archivos modificados con líneas finales.
- Resultado de los 4 gates.
- Output de grep para confirmar que no quedó ningún `> 10` o `> 100` en código activo.
- Self-review completo.
- Recomendación de GEMINI para segunda mano de validación antes de merge.
