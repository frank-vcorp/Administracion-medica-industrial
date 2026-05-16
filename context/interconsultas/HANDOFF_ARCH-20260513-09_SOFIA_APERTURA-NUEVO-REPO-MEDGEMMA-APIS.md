# HANDOFF ARCH-20260513-09 a SOFIA — Apertura de Nuevo Repo MEDGEMMA APIS

- ID: ARCH-20260513-09
- Fecha: 2026-05-13
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para usarse al abrir un repo nuevo

## Objetivo

Usar este handoff cuando el usuario abra un repositorio nuevo para separar el frente MEDGEMMA APIS del repo principal AMI.

La meta no es redescubrir nada, sino continuar implementacion con base en el trabajo ya definido en este workspace.

## Lo que ya esta listo y no debe replantearse

1. ya existe tesis de producto para Copiloto Clinico Ocupacional
2. ya existe paquete comercial completo en `MEDGEMMA APIS/`
3. ya existe micrositio estatico local en `medgemma-apis-site/`
4. ya existe integracion backend de MedGemma via Featherless usando SDK compatible de OpenAI
5. ya existe decision de arquitectura de dos momentos: Gemini para extraccion y MedGemma para interpretacion
6. ya existe definicion comercial para modalidad plataforma, micrositio y API B2B

## Fuente de verdad que debes leer primero

1. `MEDGEMMA APIS/09-TODO-SEGUIMIENTO.md`
2. `MEDGEMMA APIS/10-MODELO-COMERCIAL-Y-OPERATIVO.md`
3. `MEDGEMMA APIS/11-MODELO-API-B2B-Y-FEATHERLESS.md`
4. `context/SPECs/SPEC_ARCH-20260513-05-MICROSITIO-ESTATICO-MEDGEMMA-APIS.md`
5. `context/SPECs/SPEC_ARCH-20260513-08-MEDGEMMA-OPENAI-SDK-FEATHERLESS.md`
6. `context/interconsultas/HANDOFF_ARCH-20260513-05_SOFIA_MICROSITIO-MEDGEMMA-APIS.md`
7. `context/interconsultas/HANDOFF_ARCH-20260513-08_SOFIA_MEDGEMMA-OPENAI-SDK.md`

## Que puede hacer SOFIA inmediatamente en el nuevo repo

### Frente 1. Repo del micrositio comercial

1. mover o recrear `medgemma-apis-site/` como repo independiente
2. ajustar branding final
3. conectar WhatsApp real
4. dejar deploy listo en Vercel o GitHub Pages
5. documentar push, dominio y publicacion

### Frente 2. Repo de API o backend comercial

1. separar el backend relevante desde AMI o recrear una version minima enfocada
2. conservar pipeline de dos momentos
3. mantener Gemini en extraccion
4. mantener MedGemma via Featherless en interpretacion clinica
5. exponer endpoint compuesto o API B2B segun el corte del nuevo repo

### Frente 3. Demo comercial

1. construir demo simple con dos estudios y consolidado
2. elegir variante comercial inicial
3. dejar caso limpio para ventas

## Lo que NO debe volver a debatirse sin nueva instruccion del usuario

1. MedGemma va por Featherless usando SDK OpenAI-compatible
2. Gemini sigue siendo la capa de extraccion
3. no se vende acceso directo al modelo como producto principal
4. el frente comercial inicial excluye Campimetria y Riesgo Cardiovascular

## Lo que sigue pendiente y debe validarse en el nuevo repo

1. variables reales de entorno
2. prueba real con URL y API key reales de Featherless
3. decision de si el nuevo repo sera solo micrositio, solo API o ambos
4. validacion del flujo clinico con estudios reales o muestra controlada
5. definicion de la primera oferta comercial exacta

## Insumos que el usuario debe entregar a SOFIA al abrir el nuevo repo

### Obligatorios

1. objetivo del repo: micrositio, API, demo o stack completo
2. URL real de Featherless compatible OpenAI
3. API key real de Featherless cargada como variable segura, no pegada en chat
4. modelo exacto a usar en `FEATHERLESS_MODEL`
5. numero real de WhatsApp para CTA

### Muy recomendables

1. nombre final del repo
2. dominio o subdominio si ya existe
3. logotipo, colores o identidad visual si ya existen
4. combinacion comercial inicial de estudios
5. si quiere Vercel, GitHub Pages o ambos

## Combinaciones recomendadas segun objetivo

### Si el nuevo repo es solo para vender rapido

1. prioriza micrositio estatico
2. conectar WhatsApp
3. dejar demo visual o capturas

### Si el nuevo repo es para integrar clientes tecnicos

1. prioriza API B2B
2. documentar endpoints
3. validar Featherless real

### Si el nuevo repo es para demo comercial completa

1. unir landing + demo simple
2. usar Examen Medico + Audiometria o Examen Medico + Laboratorio como narrativa comercial

## Riesgos y aclaraciones para SOFIA

1. no asumir que las credenciales reales ya estan cargadas
2. no prometer despliegue final sin probar Featherless real
3. no reabrir el debate de arquitectura ya resuelto
4. no mezclar piloto tecnico con oferta comercial si el usuario no lo pide

## Cierre esperado del primer corte en el nuevo repo

SOFIA debe poder devolver al usuario una respuesta de este tipo:

1. el repo ya tiene estructura base
2. el despliegue o scaffold ya esta listo
3. estos son los env vars faltantes
4. esta es la prueba real pendiente con Featherless
5. esta es la siguiente accion minima para salir a produccion o a venta

## Nota operativa final

Si el usuario abre un repo nuevo y pide continuar, este handoff debe tomarse como punto de arranque preferente para no perder contexto y evitar repetir discovery.