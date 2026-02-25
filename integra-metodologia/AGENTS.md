# AGENTS.md - Metodología INTEGRA v2.4.0

## Ecosistema de Agentes IA

### Agentes Disponibles
| Agente | Descripción | Modelo | Puede Escalar a |
|--------|-------------|--------|-----------------|
| **INTEGRA - Arquitecto** | Define qué construir, prioriza backlog y toma decisiones de arquitectura | Gemini 3 Pro | SOFIA, GEMINI, Deby, CRONISTA |
| **SOFIA - Builder** | Implementa código, escribe tests y genera checkpoints de cada entrega | Claude Haiku 4.5 | INTEGRA, GEMINI, Deby, CRONISTA |
| **GEMINI-CLOUD-QA** | Configura hosting (Vercel/GCP), valida Soft Gates y revisa código | Gemini 3 Pro | SOFIA, Deby, CRONISTA |
| **Deby** | Analiza errores complejos, identifica causa raíz y genera dictámenes técnicos | Claude Opus 4.5 | ❌ (Solo recibe, no escala) |
| **CRONISTA-Estados-Notas** | Mantiene PROYECTO.md actualizado, sincroniza estados y detecta inconsistencias | GPT-5.1 | Todos (notificaciones) |

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
runSubagent(agentName='[NOMBRE-EXACTO]', prompt='ID:[tu-ID] Contexto:[descripción]')
```

### Triggers de Escalamiento
| Situación | Agente a Invocar |
|-----------|------------------|
| Error no resuelto en 2 intentos | `Deby` |
| Decisión arquitectónica | `INTEGRA - Arquitecto` |
| Implementación de SPEC | `SOFIA - Builder` |
| Auditoría de calidad | `GEMINI-CLOUD-QA` |
| Sincronizar PROYECTO.md | `CRONISTA-Estados-Notas` |

### Artefactos de Interconsulta
- **Dictámenes:** `context/interconsultas/DICTAMEN_FIX-[ID].md`
- **ADRs:** `context/decisions/ADR-[NNN]-[titulo].md`
- **Handoffs:** `context/HANDOFF-[FEATURE].md`

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
