# SPEC FIX-20260603-03 — Corrección de símbolo duplicado en CheckInModal

- ID: FIX-20260603-03
- Fecha: 2026-06-03
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación

## Objetivo

Corregir el error de build de frontend reportado por Vercel en `CheckInModal.tsx`:

`the name externalCandidates is defined multiple times`

sin alterar la lógica funcional del flujo de ingreso externo.

## Hipótesis verificada

En [frontend/src/components/CheckInModal.tsx](frontend/src/components/CheckInModal.tsx):

1. existe estado React `const [externalCandidates, setExternalCandidates] = useState<ExternalSearchCandidate[]>([])`
2. más abajo existe otra declaración local `const externalCandidates = workers ...`
3. ambas viven en el mismo scope del componente y Turbopack falla por colisión de identificador

## Archivo ancla inicial

1. [frontend/src/components/CheckInModal.tsx](frontend/src/components/CheckInModal.tsx)

## Alcance aprobado

Incluye:

1. resolver la colisión de nombres con el cambio mínimo posible
2. conservar el flujo actual de búsqueda externa y render de candidatos
3. validar build de frontend tras el ajuste

No incluye:

1. rediseño del modal
2. cambio de lógica de negocio de admisión externa
3. refactor amplio del componente

## Archivo exacto a modificar

Máximo permitido: 1 archivo.

1. [frontend/src/components/CheckInModal.tsx](frontend/src/components/CheckInModal.tsx)

## Cambio mínimo obligatorio

1. Renombrar o eliminar una de las dos declaraciones `externalCandidates` para que no haya colisión en el scope.
2. Mantener la semántica existente del listado que hoy usa `setExternalCandidates(...)` desde la búsqueda externa.
3. Ajustar el render para usar el nombre final correcto donde aplique.

## Criterios de aceptación

1. `pnpm run build` en `frontend/` deja de fallar por símbolo duplicado.
2. El modal sigue compilando y renderizando la lista de candidatos externos.
3. El cambio queda acotado al archivo ancla.

## Validación exacta esperada

```bash
cd /workspaces/Administracion-medica-industrial/frontend && pnpm run build
```

## Criterio de éxito

La iteración será exitosa cuando Vercel deje de romper en `CheckInModal.tsx` por redefinición de `externalCandidates` y el ajuste no altere el flujo de búsqueda externa existente.