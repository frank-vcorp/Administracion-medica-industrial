# SPEC — Identidad visual AMI (sitio institucional → sistema)

- **ID:** ARCH-20260908-01
- **Tipo:** Arquitectónica (tokens de marca + chrome)
- **Origen:** Frank — alinear Residente Digital con [AMI Salud Responsable](https://lime-lemur-185574.hostingersite.com/wpamiupgrade/)
- **Estado:** IN PROGRESS
- **Alcance de este corte:** tokens + login + AppShell + dashboard + búsqueda global. No reescribe cada botón indigo/blue de módulos clínicos.

## 1. Problema

El sistema usa slate/indigo/blue genéricos. El sitio institucional AMI ya define marca: teal, púrpura, amarillo, Inter, botones píldora, mucho blanco.

## 2. Tokens (fuente: CSS `ami-theme`)

| Token | Hex | Uso institucional |
|---|---|---|
| `ami-primary` | `#00afaa` | CTA, labels, línea bajo header |
| `ami-primary-hover` | `#00928e` | hover CTA |
| `ami-secondary` | `#592c82` | nav, títulos destacados, footer, overlay banners |
| `ami-secondary-hover` | `#43215f` | hover púrpura |
| `ami-accent` | `#dede19` | hamburguesa, flechas de card, CTA sobre púrpura |
| `ami-gray` | `#636569` | títulos de sección y cuerpo |
| Superficie | `#ffffff` / `#f9fafb` | fondo |
| Tipo | Inter 400/600/700 | todo el sitio |
| Radio CTA | `9999px` | botones píldora |

## 3. DoD de este corte

1. CSS `@theme` expone `bg-ami-primary`, `text-ami-secondary`, etc.
2. Layout usa Inter.
3. Login, sidebar, header y dashboard coinciden con la paleta institucional.
4. FAB de búsqueda usa teal AMI, no Tailwind teal genérico.
