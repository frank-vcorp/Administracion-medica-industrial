# CHK_ARCH-20260326-02 - Normalizacion de variables Gemini en Railway

## Hallazgo

- Railway expone dos entradas para `GEMINI_API_KEY`: una valida y otra malformada con whitespace antes de `=` en la salida KV del CLI.
- El backend en produccion sigue reportando `GEMINI_API_KEY no configurada` pese a que la clave existe a nivel de servicio.

## Decision

- Normalizar la lectura de variables de entorno en backend para resolver claves con whitespace accidental en nombre o valor.
- Mantener la correccion de infraestructura ya aplicada en Railway y evitar que un estado inconsistente vuelva a dejar la IA inoperante.

## Impacto

- El backend puede recuperar `GEMINI_API_KEY`, `GEMINI_MODEL` y `UPLOAD_DIR` aun si Railway inyecta una variante malformada del nombre de variable.
- No cambia la API publica ni el contrato de respuestas.