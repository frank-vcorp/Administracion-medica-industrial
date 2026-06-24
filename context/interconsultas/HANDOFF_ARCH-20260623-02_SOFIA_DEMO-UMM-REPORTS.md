# HANDOFF ARCH-20260623-02 a SOFIA — DEMO Módulo de Reportes Masivos UMM

**ID:** ARCH-20260623-02
**Tipo:** DEMO AISLADO (no implementación productiva)
**Fecha:** 2026-06-23

## Contexto

El usuario quiere un **demo navegable** que se vea y funcione como si fuera parte del sistema AMI real, pero **completamente independiente del backend y la base de datos**. El objetivo es que logística pueda ver cómo quedaría el Módulo de Reportes Masivos antes de invertir en la implementación productiva.

**NO** se debe tocar código de producción, schema Prisma, ni backend.

## Alcance

### Datos
- Usar **10 trabajadores representativos** del archivo `context/datos AMI/Proyectos UMM/CONCENTRADO GENERAL EJEMPLO.xlsx`
- Empresa simulada: **"VALIANT DE MÉXICO - UMM Demo"**
- Datos hardcodeados en archivo JSON estático dentro del frontend

### Funcionalidad requerida
1. Listado de proyectos demo en `/demo/reports`
2. Vista de proyecto demo en `/demo/reports/[id]` con UI idéntica a `/projects/[id]`
3. Botón "Reporte Masivo" que abre modal de preview
4. Modal de preview muestra contadores:
   - Total trabajadores
   - Con todos los estudios
   - Con estudios parciales
   - Sin estudios
5. Generación de **XLSX real** con 3 hojas (CONCENTRADO, LABORATORIOS, GRAFICAS) usando `xlsx` o `exceljs`
6. Generación de **PDF real** con:
   - Página 1: Portada "Diagnóstico Situacional" (empresa, conteos por estudio, pirámide edad, distribución sexo)
   - Páginas 2+: Concentrado tabular
   - Usar `@react-pdf/renderer` (ya está en package.json) o `jspdf`+`jspdf-autotable`
7. Descarga de ambos archivos
8. Banner visible en todo el demo: "🧪 DEMO MODE — Datos estáticos del CONCENTRADO GENERAL EJEMPLO.xlsx"

## Estructura de archivos

```
frontend/src/
├── app/
│   └── demo/
│       └── reports/
│           ├── page.tsx                          # Listado de proyectos demo
│           └── [id]/
│               ├── page.tsx                      # Vista del proyecto demo
│               └── reports/
│                   └── page.tsx                  # Vista previa del reporte generado
├── components/
│   └── demo/
│       ├── DemoBanner.tsx                        # Banner "DEMO MODE"
│       ├── DemoProjectCard.tsx                   # Card de proyecto demo
│       ├── DemoMassiveReportModal.tsx            # Modal preview + generación
│       ├── DemoProjectWorkersTable.tsx           # Tabla de trabajadores
│       └── demo-styles.css                       # Estilos compartidos del demo
├── lib/
│   └── demo/
│       ├── demo-data.ts                          # JSON con 10 trabajadores
│       ├── demo-types.ts                         # Tipos TypeScript del demo
│       ├── xlsx-generator.ts                     # Generador XLSX con xlsx/exceljs
│       └── pdf-generator.tsx                     # Generador PDF con @react-pdf/renderer
```

## Datos de ejemplo (10 trabajadores)

Seleccionar del CONCENTRADO GENERAL EJEMPLO.xlsx los siguientes 10 (mantener estructura idéntica):

1. AGUILAR ARREOLA JOSE DAVID (folio 168058) — Soldadura — Con todos los estudios
2. CRUZ MARTINEZ EDUARDO MISAEL (folio 168146) — Almacén F5 — Con casi todos
3. DE LUNA MORALES ANGEL EDUARDO (folio 168100) — Maquinados — Con todos
4. GARCIA PACHUCA LUIS FERNANDO (folio 168041) — Maquinados — Con todos
5. GOMEZ LUCIO JOSE MANUEL (folio 168016) — Soldadura — Con todos
6. HERNANDEZ BARRERA MARIA GUADALUPE (folio 168054) — Mantenimiento — Sin RX (N/A)
7. MIRANDA CUEVAS HUGO (folio 168040) — (sin área) — Con casi todos
8. NIEVES TREJO ADRIAN (folio 168041) — (sin área) — Con casi todos
9. RODRIGUEZ RAMIREZ VICTOR MANUEL (folio 168037) — (sin área) — Con casi todos
10. VELAZQUEZ MORENO LORENZO (folio 168050) — (sin área) — Con todos

Para cada uno incluir:
- Datos personales (folio, nombre, sexo, área, antigüedad)
- Audiometría (DX bilateral, OD, OI, %HBC)
- Espirometría (DX, FVC, Tabaquismo)
- RX Columna (ángulo Cobb, ángulo Ferguson, basculación, impresión)
- RX Tórax (impresión)
- ECG (impresión)
- Campimetría (agudeza visual, campos visuales, discriminación color)
- Examen médico (peso, talla, IMC, TA, impresión, recomendaciones)
- Laboratorios (BH, QS6, EGO, Toxicológico) — usar los del LABORATORIOS hoja

## Generación XLSX

Usar `xlsx` (SheetJS) o `exceljs`. La librería `xlsx` ya viene en AMI (`^0.18.5` en package.json).

**Hoja CONCENTRADO** (1 fila por trabajador, columnas según formato original):
- FOLIO, NOMBRE, SEXO, AREA/PUESTO, ANTIGÜEDAD
- AGUDEZA VISUAL, CAMPOS VISUALES, DISCRIMINACION DEL COLOR
- DX (resumen bilateral), OIDO DERECHO, OIDO IZQUIERDO, % HBC
- ESPIROMETRIA, FVC, TABAQUISMO
- ELECTROCARDIOGRAMA, VALORACION POSTURAL
- GRADO ESCOLIOSIS, GRADO LORDOSIS, BASCULACIÓN PÉLVICA
- RADIOGRAFIA COLUMNA (impresión), RADIOGRAFIA TORAX (impresión)

**Hoja LABORATORIOS**:
- Folio, Nombre, Sexo, Edad
- BH: Hb, MCHb, CHGM, LEU, PLA
- QS6: GLUC, BUN, UREA, CREAT, AU, COL, TRIG
- EGO: GLC, PROT, BLO, BAC, CRISTALES
- TOXICOLÓGICO: ANFETA, COCA, MARIHUA, OPIAC, METANF

**Hoja GRAFICAS** (agregados calculados desde los 10):
- TRAUMA ACUSTICO POR AREA (conteos)
- AUDIOMETRÍAS (%HBC por rango: Normal/Alto/Muy Alto)
- ESPIROMETRÍAS (distribución patrón)
- COLUMNA (escoliosis: NORMAL/LEVE/MODERADA/GRAVE)
- QS6 (colesterol/triglicéridos/glucosa por niveles)

## Generación PDF

Usar `@react-pdf/renderer` (^4.3.2 ya en package.json).

**Página 1 — Portada "Diagnóstico Situacional"**:
```
DIAGNÓSTICO SITUACIONAL
[Logo AMI placeholder]
Empresa: VALIANT DE MÉXICO - UMM Demo
Fecha: 2026-06-23

Conteos por estudio:
• 10 Examen Médico
• 10 Audiometrías
• 10 Espirometrías
• 9 Radiografías de Columna (1 N/A)
• 10 Laboratorios

Pirámide de edad (texto):
• 18-30 años: 5 trabajadores
• 31-45 años: 4 trabajadores
• 46+ años: 1 trabajador

Distribución por sexo:
• Masculino: 9
• Femenino: 1
```

**Páginas 2-3 — Concentrado tabular**:
- Tabla con 10 filas (1 por trabajador)
- Encabezados agrupados por estudio
- Estilo simple pero profesional

## UI

**Banner DEMO MODE** (visible en todas las páginas del demo):
```tsx
<div className="bg-amber-100 border-b-2 border-amber-500 text-amber-900 px-4 py-2 text-sm font-medium">
  🧪 DEMO MODE — Datos estáticos del CONCENTRADO GENERAL EJEMPLO.xlsx
</div>
```

**Botón "Reporte Masivo"** (en `/demo/reports/[id]`):
- Mismo estilo que el botón que se usaría en producción
- Abre `DemoMassiveReportModal`

**Modal de preview**:
- Tamaño: `max-w-3xl`
- Header: "Reporte Masivo - VALIANT DE MÉXICO - UMM Demo"
- Sección 1: Contadores en cards
  - "10 trabajadores en total"
  - "7 con todos los estudios"
  - "2 con estudios parciales"
  - "1 sin estudios"
- Sección 2: Selección de formato
  - Radio buttons: XLSX, PDF, Ambos
- Sección 3: Botones
  - "Cancelar"
  - "Generar Reporte" (abre sub-modal con progreso)
- Sub-modal de generación:
  - Spinner con texto "Generando XLSX..." / "Generando PDF..."
  - Al terminar: muestra links de descarga

## Restricciones

1. **NO** tocar `prisma/schema.prisma`
2. **NO** modificar rutas existentes (`/projects/*`, `/companies/*`, etc.)
3. **NO** agregar dependencias — solo usar lo que ya está en `package.json`:
   - `xlsx` ^0.18.5 (para XLSX)
   - `@react-pdf/renderer` ^4.3.2 (para PDF)
   - `tailwindcss` (estilos)
4. Todo el código del demo debe vivir bajo `frontend/src/app/demo/`, `frontend/src/components/demo/` y `frontend/src/lib/demo/`
5. NO usar `useEffect` para fetch — los datos se importan directamente
6. Usar `'use client'` solo donde sea necesario (modal, generación XLSX/PDF en cliente)

## Validación

```bash
cd frontend && pnpm typecheck
```

**Smoke test manual**:
1. `pnpm dev` en `frontend/`
2. Abrir `http://localhost:3000/demo/reports`
3. Ver banner "DEMO MODE" visible
4. Click en "VALIANT DE MÉXICO - UMM Demo"
5. Ver 10 trabajadores en la tabla
6. Click "Reporte Masivo"
7. Ver preview con contadores correctos
8. Seleccionar "Ambos" y click "Generar"
9. Esperar a que termine
10. Descargar XLSX y abrirlo — verificar 3 hojas
11. Descargar PDF y abrirlo — verificar portada + concentrado
12. Comparar XLSX con `context/datos AMI/Proyectos UMM/CONCENTRADO GENERAL EJEMPLO.xlsx`

## Self-review antes de cerrar

- ¿El banner DEMO MODE está visible en todas las páginas del demo?
- ¿Los 10 trabajadores están correctos y completos?
- ¿El preview muestra contadores correctos?
- ¿El XLSX tiene las 3 hojas con datos consistentes?
- ¿El PDF tiene portada + concentrado legible?
- ¿La descarga funciona tanto para XLSX como PDF?
- ¿Los archivos generados no están vacíos?
- ¿El demo es 100% standalone (no toca base de datos ni backend)?

Al cerrar, **NO** pidas Qodo (está sunset). En su lugar, incluye self-review manual y sugiere que INTEGRA invoque a **GEMINI** (`subagent_type='gemini'`) como segunda mano de validación.
