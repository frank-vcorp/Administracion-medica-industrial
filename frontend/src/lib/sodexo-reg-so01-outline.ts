/** Orden y títulos alineados al formato ejemplo REG-SO-01 Sodexo. */
export type SodexoRegBlockDef = {
  id: string
  section: string
  title: string
  subtitle?: string
  /** Solo lectura desde papeleta AMI (sin captura en extensión). */
  amiOnly?: boolean
  /** Ocultar si el paciente no es mujer (§7). */
  femaleOnly?: boolean
}

export const SODEXO_REG_SO01_BLOCKS: SodexoRegBlockDef[] = [
  {
    id: '1',
    section: '1',
    title: 'Identificación',
    subtitle: 'Datos personales desde Antecedentes; contacto de emergencia y domicilio complementario (sin EPP).',
  },
  {
    id: '1.2',
    section: '1.2',
    title: 'Identificación de actividades',
    subtitle: 'Cargo, ingreso y antigüedad (solo periódica/retiro/reingreso); funciones principales y Otro (¿Cuál?).',
  },
  {
    id: '3',
    section: '3',
    title: 'Historia ocupacional',
    subtitle: 'Historial de empleos, matriz por empresa (1–5 y A) y EPP.',
  },
  {
    id: '4',
    section: '4',
    title: 'Antecedentes heredo-familiares',
    amiOnly: true,
  },
  {
    id: '5',
    section: '5',
    title: 'Antecedentes personales patológicos',
    subtitle: 'Captura clínica estándar + ajustes opcionales Sodexo.',
  },
  {
    id: '6',
    section: '6',
    title: 'Inmunizaciones',
    subtitle: 'Esquema de vacunación.',
  },
  {
    id: '7',
    section: '7',
    title: 'Historia gineco-obstétrica',
    subtitle: 'Solo aplica en paciente mujer.',
    femaleOnly: true,
  },
  {
    id: '8',
    section: '8',
    title: 'Estilos de vida',
    subtitle: 'Tabaco, alcohol y drogas.',
  },
  {
    id: '9',
    section: '9',
    title: 'Examen físico',
    subtitle: 'Exploración por regiones y datos de somatometría / signos vitales.',
  },
  {
    id: '10',
    section: '10',
    title: 'Diagnósticos',
    amiOnly: true,
  },
  {
    id: '11',
    section: '11',
    title: 'Recomendaciones',
    amiOnly: true,
  },
  {
    id: '12',
    section: '12',
    title: 'Restricciones',
    amiOnly: true,
  },
  {
    id: '13',
    section: '13',
    title: 'Observaciones generales y de seguimiento',
    subtitle: 'SALUD OCUPACIONAL SODEXO MÉXICO',
  },
]
