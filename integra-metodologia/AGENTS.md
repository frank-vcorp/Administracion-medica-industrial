# AGENTS.md - Metodología INTEGRA v3.0.0 (Edición VS Code - 5 Agentes)

## Ecosistema de Agentes IA

### Filosofía de Distribución (VS Code vs Antigravity)

| Entorno | Agentes | Razón |
|---------|---------|-------|
| **VS Code** | 5 (INTEGRA, SOFIA, GEMINI, DEBY, CRONISTA) | Más especialización: QA/Infra separado de Debugging, Estados separado de Arquitectura |
| **Antigravity** | 3 (INTEGRA, SOFIA, DEBY) | DEBY absorbe QA+Infra, INTEGRA absorbe Estados+Diario |

### Agentes Disponibles

| Agente | Rol | Prefijos | Puede Escalar a |
|--------|-----|----------|-----------------|
| **INTEGRA - Arquitecto** | Arquitecto / Product Owner. Define qué construir, prioriza backlog, toma decisiones de arquitectura y genera SPECs. | `ARCH`, `DOC` | SOFIA, GEMINI, Deby, CRONISTA |
| **SOFIA - Builder** | Builder / Implementadora. Construye código, UI y tests. Sigue SPECs y genera checkpoints de entrega. | `IMPL` | INTEGRA, GEMINI, Deby, CRONISTA |
| **GEMINI-CLOUD-QA** | QA / Infra / Hosting. Configura hosting (Vercel/GCP), valida Soft Gates, revisa código y gestiona CI/CD. | `INFRA` | SOFIA, Deby, CRONISTA |
| **Deby** | Forense / Debugger. Analiza errores complejos, identifica causa raíz y genera dictámenes técnicos. | `FIX` | ❌ (Solo recibe, no escala) |
| **CRONISTA-Estados-Notas** | Administrador de Estado. Mantiene PROYECTO.md actualizado, sincroniza estados y detecta inconsistencias. | `DOC` | Todos (notificaciones) |

### Mapa de Interconsultas

```
       ┌──────────┐
 ┌────►│  DEBY    │◄────┐  (Consultor - Solo recibe)
 │     │(Forense) │     │
 │     └──────────┘     │
 │                      │
┌┴─────────────┐  ┌─────┴────────┐
│   INTEGRA    │◄►│    SOFIA     │  (Bidireccional)
│ (Arquitecto) │  │  (Builder)   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       │  ┌──────────┐   │
       └─►│  GEMINI  │◄──┘  (Ambos pueden llamar)
          │(QA/Infra)│
          └────┬─────┘
               │
          ┌────▼─────┐
          │ CRONISTA │  (Cualquiera puede llamar)
          │(Estados) │
          └──────────┘
```

### Cómo Invocar una Interconsulta

```javascript
runSubagent(
  agentName='[NOMBRE-EXACTO]', 
  prompt='ID:[tu-ID] Contexto:[descripción] Problema:[qué resolver] Expectativa:[qué esperas]'
)
```

**Nombres exactos:** `INTEGRA - Arquitecto`, `SOFIA - Builder`, `GEMINI-CLOUD-QA`, `Deby`, `CRONISTA-Estados-Notas`

### Triggers de Escalamiento

| Situación | Agente a Invocar | Trigger |
|-----------|------------------|---------|
| Planificación, Priorización, Arquitectura | `INTEGRA - Arquitecto` | Inicio de tarea o duda de diseño |
| Implementación de Código, UI y Tests | `SOFIA - Builder` | SPEC autorizada |
| Auditoría de Calidad, Hosting, CI/CD | `GEMINI-CLOUD-QA` | Código listo para QA o deploy |
| Error no resuelto en 2 intentos, Debugging | `Deby` | Automático tras 2 fallos |
| Sincronizar estados en PROYECTO.md | `CRONISTA-Estados-Notas` | Al cambiar estado de tarea |

### Artefactos de Interconsulta

| Tipo | Ubicación | Genera |
|------|-----------|--------|
| Dictámenes | `context/interconsultas/DICTAMEN_FIX-[ID].md` | DEBY |
| ADRs | `context/decisions/ADR-[NNN]-[titulo].md` | INTEGRA |
| Handoffs | `context/HANDOFF-[FEATURE].md` | INTEGRA |
| Checkpoints | `context/checkpoints/CHK_YYYY-MM-DD_HHMM.md` | SOFIA / CRONISTA |
| Auditorías | Comentarios en PR o Checkpoint | GEMINI |

### Commits por Agente

| Agente | Prefijo típico | Ejemplo |
|--------|---------------|---------|
| INTEGRA | `docs`, `feat` | `docs: crear SPEC de facturación` |
| SOFIA | `feat`, `fix`, `refactor` | `feat(clientes): IMPL-20260126-01` |
| GEMINI | `chore`, `docs`, `ci` | `chore(infra): configurar Vercel` |
| DEBY | `fix` | `fix(api): FIX-20260126-01 - resolver timeout` |
| CRONISTA | `docs` | `docs(proyecto): sincronizar estados del sprint` |

---

## Dev environment tips
- Use `pnpm dlx turbo run where <project_name>` to jump to a package instead of scanning with `ls`.
- Run `pnpm install --filter <project_name>` to add the package to your workspace.
- Check the name field inside each package's package.json to confirm the right name.

## Testing instructions
- Find the CI plan in the .github/workflows folder.
- Run `pnpm turbo run test --filter <project_name>` to run every check.
- Fix any test or type errors until the whole suite is green.
- Add or update tests for the code you change, even if nobody asked.

## PR instructions
- Title format: [<project_name>] <Title>
- Always run `pnpm lint` and `pnpm test` before committing.
