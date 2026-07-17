# SPEC ARCH-20260715-06: Extracción Directa desde XML de Audiómetro

## Contexto

Los audiómetros DD65 V2 exportan archivos XML con la estructura completa de datos de audiometría. Estos XML contienen los valores exactos de umbral auditivo sin necesidad de interpretación visual o IA.

## Problema

La extracción de PDFs mediante IA (Gemini) tiene un margen de error de ±5-10 dB al leer gráficos de audiogramas. Aunque el prompt está calibrado, la interpretación visual introduce variabilidad.

## Solución

Implementar un parser directo de XML que extraiga los valores exactos del audiómetro, eliminando la dependencia de IA para casos donde el XML está disponible.

## Flujo de Prioridad

1. **XML disponible** → Parser directo (valores exactos, sin IA)
2. **Solo PDF** → IA con prompt calibrado (valores aproximados)
3. **Ambos disponibles** → XML es ground truth, PDF se usa solo para calibración

## Implementación

### Parser XML

**Archivo:** `backend/app/services/audiometry_xml_parser.py`

Extrae:
- Datos del paciente (nombre, género, fecha de nacimiento)
- Audiogramas por oído (vía aérea y vía ósea)
- PTA calculado automáticamente (promedio de 500, 1000, 2000 Hz)
- Frecuencias detectadas
- Completitud documental

### Estructura XML

```xml
<LocalSession>
  <Patient>
    <FirstName>JESSICA GABRIELA</FirstName>
    <LastName>MORENO GOMEZ</LastName>
    <Gender>Female</Gender>
  </Patient>
  <Sessions>
    <Session>
      <Actions>
        <Action>
          <ActionType>Audiogram</ActionType>
          <PublicData xsi:type="AudioSession">
            <ToneTHRAudiogram>
              <AudiogramOfTonePoint>
                <MeasurementConditions>
                  <SignalOutput1>ACL</SignalOutput1>  <!-- Oído Izquierdo -->
                  <SignalOutput2>ACR</SignalOutput2>
                </MeasurementConditions>
                <Points>
                  <TonePoint>
                    <Intensity1>50</Intensity1>  <!-- dB HL -->
                    <Freq1>250</Freq1>  <!-- Hz -->
                  </TonePoint>
                </Points>
              </AudiogramOfTonePoint>
            </ToneTHRAudiogram>
          </PublicData>
        </Action>
      </Actions>
    </Session>
  </Sessions>
</LocalSession>
```

### Identificación de Oídos

- `SignalOutput1=ACL` → Oído Izquierdo (Air Conduction Left)
- `SignalOutput1=ACR` → Oído Derecho (Air Conduction Right)
- `SignalOutput1=BCL` → Oído Izquierdo (Bone Conduction Left)
- `SignalOutput1=BCR` → Oído Derecho (Bone Conduction Right)

### Endpoint Modificado

**Archivo:** `backend/app/api/v1/calibration.py`

El endpoint `POST /api/v1/calibration/upload` ahora acepta:
- Archivos PDF (flujo existente con IA)
- Archivos XML (nuevo flujo con parser directo)

Para archivos XML de audiometría:
- No requiere prompt de extracción configurado
- No consume tokens de IA para extracción
- Solo usa IA para prediagnóstico clínico (si está configurado)

### Respuesta del Endpoint

```json
{
  "success": true,
  "test_id": "calibration_test_xxx",
  "canonical_study_type": "Audiometria",
  "data_source": "xml_direct",
  "extraction": {
    "structured_data": {
      "oido_derecho": {
        "va": {"250": 50, "500": 10, "1000": 5, ...},
        "vo": {},
        "pta": 22
      },
      "oido_izquierdo": {
        "va": {"250": 50, "500": 10, "1000": 10, ...},
        "vo": {},
        "pta": 23
      },
      "frecuencias_detectadas": ["250", "500", "1000", "2000", "3000", "4000", "6000", "8000"],
      "completitud_documental": "suficiente",
      "notas_calidad": "Datos extraídos directamente desde XML del audiómetro DD65 V2. Valores exactos sin interpretación de IA."
    },
    "model_used": "xml_parser",
    "prompt_version": "xml_direct_v1",
    "duration_seconds": 0.02
  },
  "prediagnosis": {
    "result": {...},
    "model_used": "gemini",
    "duration_seconds": 3.5
  }
}
```

## Ventajas

1. **Exactitud 100%**: Valores exactos del audiómetro, sin margen de error
2. **Velocidad**: Parser directo en <100ms vs 5-10s con IA
3. **Costo**: No consume tokens de IA para extracción
4. **Confiabilidad**: Sin dependencia de prompts calibrados
5. **Trazabilidad**: Fuente de datos explícita (`data_source: "xml_direct"`)

## Casos de Uso

### Caso 1: Solo XML disponible
- Usuario sube XML desde el audiómetro
- Parser extrae valores exactos
- IA genera prediagnóstico clínico (opcional)

### Caso 2: Solo PDF disponible
- Usuario sube PDF
- IA extrae valores aproximados (±5 dB)
- IA genera prediagnóstico clínico

### Caso 3: Ambos disponibles (calibración)
- Usuario sube PDF y XML
- XML es ground truth para validar extracción del PDF
- Se puede iterar el prompt del PDF hasta que coincida con XML

## Limitaciones

1. Solo funciona con audiómetros DD65 V2 que exportan XML
2. No extrae vía ósea si no está presente en el XML
3. Requiere que el XML tenga la estructura esperada

## Próximos Pasos

1. Implementar en flujo de producción (no solo calibración)
2. Agregar validación de esquema XML
3. Documentar en manual de usuario cómo exportar XML del audiómetro
4. Crear herramienta de comparación PDF vs XML para calibración

## Referencias

- XML de prueba: `context/PACIENTES/JESSICA GABRIELA.xml`
- Parser: `backend/app/services/audiometry_xml_parser.py`
- Endpoint: `backend/app/api/v1/calibration.py`
