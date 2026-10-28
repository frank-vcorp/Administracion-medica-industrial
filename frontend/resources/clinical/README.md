# Catálogo clínico CIE-10 (español)

Archivo empaquetado con la app (sin fetch en runtime):

- **Ruta:** `frontend/resources/clinical/cie-10-es.json`
- **Fuente:** [verasativa/CIE-10](https://github.com/verasativa/CIE-10) (`codes.json`, nivel ≥ 3)
- **Regenerar:** `node frontend/scripts/build-cie-10-es-catalog.mjs`

La validación Zod al cerrar consulta médica exige un código presente en este archivo. El autocomplete consulta `GET /api/clinical/cie-10/search`.

**Última generación:** 9404 códigos · SHA-256 del JSON empaquetado: `afff6697cda5d24a83988dd3254438db3a85e20b4c0b24935311f99d96caadc0` · SHA-256 de `codes.json` upstream: `9cf7dd74681f9c9bef280bebd76d901cd044d541e72e2fb2ba408faf2a11c076`
