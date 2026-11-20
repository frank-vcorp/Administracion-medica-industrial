import { describe, expect, it } from 'vitest'
import { scopedStudyBusy } from '@/lib/clinical/papeleta-upload-scope'

describe('scopedStudyBusy', () => {
  it('muestra el progreso solo en el estudio que está subiendo', () => {
    expect(scopedStudyBusy('esp', 'esp', true)).toEqual({
      showHere: true,
      lockOthers: false,
    })
  })

  it('no pinta la carga de espirometría dentro de audiometría', () => {
    expect(scopedStudyBusy('aud', 'esp', true)).toEqual({
      showHere: false,
      lockOthers: true,
    })
  })

  it('sin carga, ningún estudio queda bloqueado', () => {
    expect(scopedStudyBusy('aud', null, false)).toEqual({
      showHere: false,
      lockOthers: false,
    })
  })
})
