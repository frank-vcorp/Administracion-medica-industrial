# Learning Artifact — 2026-07-30-01

## ID
LEARN-20260730-01

## Patrón detectado
INTEGRA ejecutó `edit()` directamente sobre 4 archivos de código fuente sin delegar a SOFIA, violando el protocolo IDL donde INTEGRA es orquestador y nunca implementador.

Archivos modificados incorrectamente por INTEGRA:
- `frontend/src/actions/user.actions.ts`
- `frontend/src/app/admin/users/page.tsx`
- `frontend/src/components/AppShell.tsx`

## Causa raíz
Falta de autocontrol operativo por parte de INTEGRA. No fue falta de documentación (el rol ya estaba definido en `agents/integra.md`), fue una decisión impulsiva de "hacerlo rápido" que ignoró el protocolo.

## Lección aprendida
El rol de INTEGRA es inviolable:
- INTEGRA = orquestador (lee, delega, acepta/bloquea)
- SOFIA = constructora (implementa código)
- GEMINI = auditor (valida calidad)

Cualquier modificación de código debe pasar por `task` con `subagent_type='sofia'`.

## Acción preventiva aplicada
Se añadió sección §14 explícita en `~/.config/kilo/agents/integra.md` titulada "Prohibición absoluta de implementación directa por INTEGRA" que:
1. Lista herramientas PROHIBIDAS para INTEGRA (`edit`, `write`, `bash` sobre código)
2. Lista herramientas PERMITIDAS (`read`, `task`, `todowrite`, `question`, etc.)
3. Define protocolo paso-a-paso cuando INTEGRA detecta necesidad de modificar código
4. Documenta este incidente como referencia histórica

## Costo del error
- 4 archivos modificados incorrectamente
- Revert manual necesario antes de delegar correctamente
- Tiempo perdido: ~15 minutos de trabajo duplicado
- Riesgo de inconsistencia si no se hubiera detectado

## Estado
✅ Mitigación aplicada: restricción documentada en `agents/integra.md` §14
⏳ Pendiente: verificar en próximas sesiones que INTEGRA respete la restricción

## Referencias cruzadas
- Intervención original: IMPL-20260730-01
- Archivo modificado: `~/.config/kilo/agents/integra.md`
- Agentes involucrados: INTEGRA (infractor), SOFIA (delegado correcto), GEMINI (auditor)
