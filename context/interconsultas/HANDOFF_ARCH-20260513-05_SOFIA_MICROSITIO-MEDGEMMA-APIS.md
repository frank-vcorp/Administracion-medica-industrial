# HANDOFF ARCH-20260513-05 a SOFIA — Micrositio Estatico MEDGEMMA APIS

- ID: ARCH-20260513-05
- Fecha: 2026-05-13
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion

## Objetivo

Construir una carpeta separada `medgemma-apis-site/` con un micrositio estatico comercial, listo para subirse a un repo nuevo de GitHub y desplegarse en Vercel o GitHub Pages.

## Fuente de verdad

1. `context/SPECs/SPEC_ARCH-20260513-05-MICROSITIO-ESTATICO-MEDGEMMA-APIS.md`
2. `MEDGEMMA APIS/04-LANDING-PAGE-BRIEF-Y-COPY.md`
3. `MEDGEMMA APIS/03-PRICING-Y-PAQUETES.md`
4. `MEDGEMMA APIS/05-CASOS-DE-USO-Y-MODALIDADES.md`
5. `MEDGEMMA APIS/08-FAQ-COMERCIAL-Y-OPERATIVO.md`

## Restricciones

1. no acoplar el micrositio al backend del repo principal
2. no usar SSR ni runtime complejo
3. dejar CTA a WhatsApp con placeholder configurable
4. el sitio debe ser compatible con despliegue estatico
5. priorizar claridad comercial sobre complejidad tecnica

## Entregables minimos

1. `medgemma-apis-site/index.html`
2. `medgemma-apis-site/styles.css`
3. `medgemma-apis-site/main.js`
4. `medgemma-apis-site/README.md`
5. `medgemma-apis-site/.gitignore`
6. `medgemma-apis-site/vercel.json` si hace falta

## Criterios de aceptacion

1. la pagina comunica valor en menos de 5 segundos
2. la landing incluye hero, dolor, transformacion, demo, pricing, FAQ y cierre
3. el CTA principal abre WhatsApp con mensaje prellenado
4. el sitio puede publicarse como repo separado sin dependencias adicionales
5. el README explica como subirlo a GitHub y conectarlo a Vercel