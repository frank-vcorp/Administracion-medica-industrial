import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NEW_EXTRACTION_PROMPT = `REGLAS ESPECÍFICAS PARA EXTRACCIÓN DE ESPIROMETRÍA

El documento contiene un estudio de función pulmonar. Devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin texto adicional y sin bloques <think>.

FUENTE PRIMARIA

1. La tabla "INFORME DE FVC" es la fuente primaria de los datos numéricos.
2. Cada fila tiene exactamente estas columnas: PARÁMETRO | M1 | %REF | M2 | %REF | M3 | %REF | REF | LLN.
3. Conserva cada celda en su columna correspondiente. Nunca desplaces M1 a M2 ni mezcles un %REF con otra maniobra.
4. Si una celda está vacía, usa null. Nunca inventes ni completes valores.
5. Extrae las filas FVC y FEV1 con sus valores absolutos M1/M2/M3 y sus porcentajes %REF.
6. También extrae Mejor FVC, Mejor FEV1, FEV1/FVC, FEF25%-75%, FET100%, Vext. y Edad del pulmón cuando estén visibles.
7. Extrae los datos del paciente, estudio, condiciones técnicas, gráficas y texto de calidad visible.

MAPEO OBLIGATORIO PARA EL REPORTE SIBELMED W20s DE PRUEBA

Para la fila FEV1: m1=2.15, m1_pct_ref=77, m2=2.11, m2_pct_ref=76, m3=2.09, m3_pct_ref=75.
Para la fila FVC: m1=2.30, m1_pct_ref=69, m2=2.33, m2_pct_ref=70, m3=2.26, m3_pct_ref=68.
Estos números son un ejemplo de correspondencia de columnas del layout, no deben copiarse a otros documentos si no son visibles.

SALIDA JSON MÍNIMA

{
  "paciente_detalle": {"nombre_completo": null, "sexo": null, "edad_anios": null, "talla_cm": null, "peso_kg": null, "imc": null, "fuma": null, "motivo": null, "procedencia": null},
  "estudio": {"referencia": null, "fecha_estudio": null, "hora_estudio": null, "tipo_reporte": null, "equipo_modelo": null, "version_software": null},
  "condiciones": {"temperatura_c": null, "presion_mmhg": null, "humedad_pct": null, "tecnico": null, "transductor": null, "referencia_ecuacion": null, "factor_etnico": null, "factor_btps": null},
  "parametros": [{"label": "FVC", "key": "fvc_l", "unidad": "L", "m1": null, "m1_pct_ref": null, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": null, "lln": null}, {"label": "FEV1", "key": "fev1_l", "unidad": "L", "m1": null, "m1_pct_ref": null, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": null, "lln": null}],
  "calidad": {"repetibilidad_ats_ers_fvc": null, "repetibilidad_ats_ers_fev1": null, "es_interpretable": null, "completitud_documental": null, "notas_calidad": null},
  "graficas": {"curva_flujo_volumen_presente": null, "curva_volumen_tiempo_presente": null, "maniobras_graficadas": null, "observaciones_grafica": null},
  "notas_calidad": null
}

No copies diagnósticos ni recomendaciones médicas como diagnóstico IA. Devuelve sólo JSON.`

async function main() {
  const test = await prisma.medicalTest.findFirst({
    where: { name: { equals: 'ESPIROMETRIA', mode: 'insensitive' } },
  })
  if (!test) throw new Error('No se encontró el MedicalTest de Espirometría')

  const options = (test.options as Record<string, unknown> | null) ?? {}
  const aiCalibration = (options.aiCalibration as Record<string, unknown> | null) ?? {}
  const extraction = (aiCalibration.extraction as Record<string, unknown> | null) ?? {}
  const updatedOptions = {
    ...options,
    aiCalibration: {
      ...aiCalibration,
      extraction: {
        ...extraction,
        prompt: NEW_EXTRACTION_PROMPT,
        version: 'espirometria-sibelmed-v2',
      },
    },
  }

  await prisma.medicalTest.update({
    where: { id: test.id },
    data: { options: updatedOptions as Prisma.InputJsonValue },
  })
  console.log(`Prompt actualizado: ${test.name} (${test.id}) → espirometria-sibelmed-v2`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
