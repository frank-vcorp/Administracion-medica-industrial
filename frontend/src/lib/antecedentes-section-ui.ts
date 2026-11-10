/** Etiquetas e textos de ayuda compartidos (historial maestro, examen, consulta). */

export const ANTECEDENTES_TABS = [
  {
    id: 'datos_personales',
    icon: '👤',
    label: 'Datos personales',
    intro:
      'Datos declarativos del trabajador. Se reutilizan entre citas como base del historial longitudinal.',
  },
  {
    id: 'historia_laboral',
    icon: '🏭',
    label: 'Historia laboral',
    intro:
      'Empleos anteriores; exposición a agentes en el trabajo (química, física, biológica, ergonómica); y en un apartado distinto, antecedentes de accidente laboral o de enfermedad profesional.',
  },
  {
    id: 'heredofamiliares',
    icon: '🧬',
    label: 'Familiares (AHF)',
    intro:
      'Antecedentes heredo-familiares (AHF): enfermedades en parientes (padre, madre, abuelos, hermanos, etc.), no en el paciente. Si ves el mismo nombre (por ejemplo diabetes) en Familiares y en Personales (APP), son preguntas distintas: aquí es en la familia; allí es en el trabajador.',
  },
  {
    id: 'no_patologicos',
    icon: '🍺',
    label: 'Hábitos (ANP)',
    intro:
      'Antecedentes no patológicos (ANP): tabaco, alcohol, drogas, alimentación, tatuajes y hábitos. No son enfermedades diagnosticadas.',
  },
  {
    id: 'patologicos',
    icon: '🏥',
    label: 'Personales (APP)',
    intro:
      'Antecedentes personales patológicos (APP): padecimientos del trabajador diagnosticados o referidos por un médico. No confundir con Familiares (AHF): diabetes en APP es del paciente; en AHF es en un familiar.',
  },
] as const

export type AntecedentesTabId = (typeof ANTECEDENTES_TABS)[number]['id']

export function antecedentesTabIntro(id: AntecedentesTabId): string {
  return ANTECEDENTES_TABS.find((t) => t.id === id)?.intro ?? ''
}

export const ANTECEDENTES_SECTION_LEGEND = {
  heredo_familiares: 'Familiares (AHF) — en parientes',
  no_patologicos: 'Hábitos (ANP) — no patológicos',
  patologicos: 'Personales (APP) — del trabajador',
} as const
