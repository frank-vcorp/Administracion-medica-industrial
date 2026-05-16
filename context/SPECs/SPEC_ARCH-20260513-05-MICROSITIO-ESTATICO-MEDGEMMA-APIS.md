# SPEC ARCH-20260513-05 — Micrositio Estatico MEDGEMMA APIS para Repo Separado

- ID: ARCH-20260513-05
- Fecha: 2026-05-13
- Agente: INTEGRA - Arquitecto
- Estado: Planificado para implementacion
- Carpeta objetivo local: `medgemma-apis-site/`
- Repo sugerido: `medgemma-apis-site`

## Objetivo

Definir un micrositio comercial estatico, separado del repo principal, listo para ser subido a un repositorio nuevo de GitHub y desplegado en Vercel o GitHub Pages sin depender del producto AMI en runtime.

## Decisiones de arquitectura

1. el sitio sera estatico, no SSR
2. el sitio vivira en carpeta separada y repo separado
3. el sitio debe poder abrirse localmente sin backend propio
4. el CTA principal ira a WhatsApp
5. el formulario puede ser simulado o resolverse con WhatsApp prellenado en V1
6. el despliegue debe ser compatible con Vercel y GitHub Pages

## Razon del enfoque

El usuario pidio una pagina fija en GitHub y lista para Vercel. La solucion mas robusta y portable es un sitio estatico puro, con cero dependencia server-side y sin necesidad de acoplarlo al repo monolitico actual.

## Alcance V1

Incluye:

1. landing page comercial completa
2. copy basado en `MEDGEMMA APIS/04-LANDING-PAGE-BRIEF-Y-COPY.md`
3. secciones de hero, problema, transformacion, demo, casos de uso, pricing, FAQ y cierre
4. CTA a WhatsApp con placeholder configurable
5. estructura repo-ready para GitHub
6. configuracion simple para despliegue en Vercel
7. compatibilidad de publicacion como sitio estatico en GitHub Pages

No incluye:

1. backend de leads
2. login
3. integracion directa con AMI
4. demo funcional conectada a backend clinico real

## Tecnologia recomendada

Para este corte se prioriza simplicidad operativa.

Stack recomendado:

1. HTML estatico
2. CSS estatico
3. JavaScript minimo para navegacion y CTA

Motivo:

1. minimiza friccion para GitHub Pages
2. tambien despliega sin problema en Vercel
3. evita complejidad innecesaria para un micrositio de conversion

## Estructura minima esperada

1. `index.html`
2. `styles.css`
3. `main.js`
4. `assets/` para imagenes o placeholders
5. `README.md`
6. `vercel.json` si se requiere configuracion explicita
7. `.gitignore`

## Criterios de aceptacion

1. existe carpeta local separada `medgemma-apis-site/`
2. el sitio puede abrirse como pagina estatica
3. el sitio tiene look comercial serio y moderno
4. el mensaje principal se entiende en menos de 5 segundos
5. el CTA principal apunta a WhatsApp con placeholder configurable
6. existe README con pasos de publicacion a GitHub y Vercel
7. el sitio no depende del backend del repo principal

## Contenido obligatorio

1. promesa principal del copiloto clinico ocupacional
2. diferenciador de consolidado multiestudio
3. aclaracion de apoyo clinico y no sustitucion medica
4. pricing base
5. casos de uso prioritarios
6. FAQ comercial

## Entregable esperado de SOFIA

1. carpeta local scaffolded `medgemma-apis-site/`
2. landing estatica funcional
3. README con instrucciones de push a GitHub y deploy en Vercel
4. sitio suficientemente presentable para publicarse sin mas arquitectura