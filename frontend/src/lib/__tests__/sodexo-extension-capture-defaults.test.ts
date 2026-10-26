import { describe, expect, it } from 'vitest'
import { emptySodexoExtension } from '@/schemas/clinical/examen-medico-variant.schema'
import {
  fillUnsetSodexoCaptureDefaults,
  syncSodexoExtensionCapture,
} from '@/lib/sodexo-extension-capture-defaults'
import { SODEXO_PATOLOGICOS_CATALOG } from '@/lib/sodexo-patologicos-catalog'

describe('sodexo-extension-capture-defaults', () => {
  it('rellena Negado/Normal en opciones vacías', () => {
    const out = fillUnsetSodexoCaptureDefaults(emptySodexoExtension(), 'Masculino')
    expect(out.heredofamiliar_sodexo?.diabetes?.respuesta).toBe('NO')
    expect(out.patologicos_sodexo?.fracturas?.estado).toBe('NEGADO')
    expect(out.inmunizaciones_sodexo?.filas?.tetanos?.estado).toBe('NEGADO')
    expect(out.estilos_vida_sodexo?.tabaco_opcion).toBe('NO')
    expect(out.estilos_vida_sodexo?.alcohol).toBe('NO')
    expect(out.examen_encabezado?.estado_general_normal).toBe(true)
    expect(out.examen_fisico_sodexo?.['91_craneo']?.resultado).toBe('NORMAL')
    expect(out.examen_fisico_columna_sodexo?.curvas?.['curva:cifosis:cervical']).toBe('N')
  })

  it('no pisa una fila patológica marcada Sí', () => {
    const ext = {
      ...emptySodexoExtension(),
      patologicos_sodexo: {
        fracturas: { estado: 'SI', descripcion: 'tobillo 2020' },
      },
    }
    const out = fillUnsetSodexoCaptureDefaults(ext, 'Masculino')
    expect(out.patologicos_sodexo?.fracturas).toEqual({
      estado: 'SI',
      descripcion: 'tobillo 2020',
    })
    const other = SODEXO_PATOLOGICOS_CATALOG.find((r) => r.key === 'luxaciones')
    expect(out.patologicos_sodexo?.[other!.key]?.estado).toBe('NEGADO')
  })

  it('fusiona AMI y luego defaults en filas sin respuesta', () => {
    const out = syncSodexoExtensionCapture(emptySodexoExtension(), {
      patientSexo: 'Masculino',
      showGineco: false,
      antecedentesCaptured: {
        patologicos: { fracturas: 'SI — muñeca' },
      },
      modulo1: {},
    })
    expect(out.patologicos_sodexo?.fracturas?.estado).toBe('SI')
    expect(out.patologicos_sodexo?.luxaciones?.estado).toBe('NEGADO')
  })
})
