# Copiloto Clínico Ocupacional — Micrositio Comercial

> Micrositio estático de conversión para el Copiloto Clínico Ocupacional  
> para lectura de estudios y prediagnóstico asistido.

**ARCH-20260513-05** | Respaldo: `context/SPECs/SPEC_ARCH-20260513-05-MICROSITIO-ESTATICO-MEDGEMMA-APIS.md`

---

## Descripción

Sitio estático de una página (landing page) diseñado para convertir tráfico
frío o templado en conversaciones comerciales calificadas vía WhatsApp.  
Sin backend, sin dependencias de runtime, completamente portable.

## Estructura

```
medgemma-apis-site/
├── index.html      ← Landing page completa con todas las secciones
├── styles.css      ← Estilos (variables, componentes, responsive)
├── main.js         ← Lógica de CTA WhatsApp, FAQ, animaciones
├── assets/         ← (vacío, reservado para imágenes o favicons futuros)
├── vercel.json     ← Configuración de deploy para Vercel
├── .gitignore      ← Exclusiones estándar
└── README.md       ← Este archivo
```

## Configuración antes de publicar

### 1. WhatsApp

Abre `main.js` y edita la sección `CONFIG`:

```js
var CONFIG = {
  WHATSAPP_NUMBER: '521XXXXXXXXXX',  // ← Tu número real (sin + ni espacios)
  WHATSAPP_MESSAGE: 'Hola, me interesa el Copiloto Clínico Ocupacional...',
};
```

### 2. SEO y metadatos (opcional)

En `index.html`, actualiza las etiquetas `<meta og:*>` con la URL real del sitio:

```html
<meta property="og:url" content="https://tu-dominio.com" />
<meta property="og:image" content="https://tu-dominio.com/assets/og-image.png" />
```

### 3. Logos (opcional)

Reemplaza los `<span class="sp-placeholder">` en la sección de prueba social
con imágenes reales cuando estén disponibles.

---

## Despliegue en Vercel

### Opción A — Desde la CLI

```bash
# Instala Vercel CLI si no lo tienes
npm i -g vercel

# Desde la carpeta del micrositio
cd medgemma-apis-site
vercel

# Producción
vercel --prod
```

### Opción B — Desde la interfaz web

1. Sube la carpeta `medgemma-apis-site/` como un repo nuevo a GitHub
2. Ve a [vercel.com/new](https://vercel.com/new)
3. Importa el repo
4. Vercel detecta automáticamente el sitio estático gracias a `vercel.json`
5. Click en **Deploy**

---

## Despliegue en GitHub Pages

### Desde un repo dedicado

```bash
# Crea un repo nuevo en GitHub (ej: medgemma-apis-site)
git init
git remote add origin https://github.com/TU_USUARIO/medgemma-apis-site.git
git add .
git commit -m "feat(site): lanzamiento inicial del micrositio comercial"
git push -u origin main
```

Luego en GitHub → Settings → Pages → Branch: `main` → Folder: `/ (root)`.

### Desde una rama `gh-pages` dentro de un repo existente

```bash
git checkout --orphan gh-pages
git rm -rf .
cp -r medgemma-apis-site/* .
git add .
git commit -m "feat(gh-pages): micrositio comercial inicial"
git push origin gh-pages
```

---

## Crear un repo separado en GitHub

```bash
# Desde el workspace, copia la carpeta a una ubicación limpia
cp -r /workspaces/Administracion-medica-industrial/medgemma-apis-site ~/medgemma-apis-site

cd ~/medgemma-apis-site
git init
git add .
git commit -m "feat(site): micrositio comercial Copiloto Clínico Ocupacional — ARCH-20260513-05"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/medgemma-apis-site.git
git push -u origin main
```

---

## Secciones del sitio

| Sección | ID ancla | Descripción |
|---------|----------|-------------|
| Hero | `#hero` | Propuesta de valor, bullets, CTA WhatsApp |
| Dolor | `#dolor` | 3 pain points del mercado |
| Transformación | `#transformacion` | Comparativo antes/después |
| Cómo funciona | `#como-funciona` | 5 pasos del flujo |
| Demo | `#demo` | Mockup del producto con storyboard |
| Casos de uso | `#casos` | 6 tarjetas con casos prioritarios |
| Diferenciadores | `#diferenciadores` | VS IA genérica, 5 pilares |
| Confianza | `#confianza` | 4 mensajes de riesgo inverso |
| Precios | `#pricing` | 3 planes + Enterprise |
| FAQ | `#faq` | 8 preguntas y respuestas accordion |
| Cierre | `#cierre` | CTA final |

---

## Tecnología

- HTML5 semántico
- CSS3 con variables (sin frameworks externos de CSS)
- JavaScript vanilla (sin frameworks)
- Google Fonts: Playfair Display + Inter
- Compatible con Vercel Static y GitHub Pages

---

## Advertencias

- Este sitio NO incluye backend de leads. Toda conversión va a WhatsApp.
- El formulario de contacto es simulado en V1. Si se requiere captura de leads
  estructurada, integrar Formspree, Netlify Forms u otro servicio externo.
- Configurar `WHATSAPP_NUMBER` en `main.js` antes de publicar (ver arriba).

---

_ARCH-20260513-05 · IMPL-20260513-01 · SOFIA - Builder_
