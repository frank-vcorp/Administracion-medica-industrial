/**
 * §9 EXAMEN FÍSICO — ítems del impreso REG-SO-01 (solo etiquetas del PDF).
 * AcroForm: `sodexo-examen-medico-template.pdf` + `sodexo-field-geometry.json`.
 */
import type {
  SodexoEfCatalogEntry,
  SodexoEfSectionDef,
  SodexoEfSectionId,
} from '@/lib/sodexo-examen-fisico-types'

function cb(n: number): string {
  return `Check Box${n}`
}

function na(
  key: string,
  section: SodexoEfSectionId,
  group: string,
  label: string,
  normal: number,
  abnormal: number,
  desc?: string,
): SodexoEfCatalogEntry {
  return {
    key,
    section,
    group,
    label,
    kind: 'normal_anormal',
    pdf: { normal: cb(normal), abnormal: cb(abnormal), desc },
  }
}

function sign(
  key: string,
  section: SodexoEfSectionId,
  group: string,
  label: string,
  neg: number,
  pos: number,
): SodexoEfCatalogEntry {
  return {
    key,
    section,
    group,
    label,
    kind: 'signo',
    signo: { neg: cb(neg), pos: cb(pos) },
  }
}

function txt(
  key: string,
  section: SodexoEfSectionId,
  group: string,
  label: string,
  textField: string,
): SodexoEfCatalogEntry {
  return { key, section, group, label, kind: 'texto', textField }
}

/** Orden y texto = pdftotext REG-SO-01 §9.1–9.8. */
export const SODEXO_EXAMEN_FISICO_CATALOG: SodexoEfCatalogEntry[] = [
  // —— 9.1 Cabeza y cuello ——
  na('91_craneo', '9.1', 'Cabeza y cuello', 'Cráneo', 580, 581, 'Texto627'),
  na('91_parpados', '9.1', 'Cabeza y cuello', 'Párpados', 604, 611, 'Texto638'),
  na('91_escleras', '9.1', 'Cabeza y cuello', 'Escleras', 582, 583, 'Texto628'),
  na('91_cornea', '9.1', 'Cabeza y cuello', 'Córnea', 605, 612, 'Texto639'),
  na('91_tabique', '9.1', 'Cabeza y cuello', 'Tabique', 584, 585, 'Texto629'),
  na('91_cornetes', '9.1', 'Cabeza y cuello', 'Cornetes', 606, 613, 'Texto640'),
  na('91_iris_pupilas', '9.1', 'Cabeza y cuello', 'Iris-pupilas', 594, 586, 'Texto641'),
  na('91_senos_paranasales', '9.1', 'Cabeza y cuello', 'Senos paranasales', 607, 610, 'Texto630'),
  na('91_inspeccion_ojos', '9.1', 'Cabeza y cuello', 'Inspección', 595, 587, 'Texto631'),
  na('91_fondo_ojo', '9.1', 'Cabeza y cuello', 'Fondo de ojo', 608, 609, 'Texto632'),
  na('91_pabellones', '9.1', 'Cabeza y cuello', 'Pabellones', 596, 588, 'Texto633'),
  na('91_oidos', '9.1', 'Cabeza y cuello', 'Oídos', 619, 614, 'Texto643'),
  na('91_mucosa', '9.1', 'Cabeza y cuello', 'Mucosa', 598, 590, 'Texto635'),
  na('91_conjuntiva', '9.1', 'Cabeza y cuello', 'Conjuntiva', 597, 589, 'Texto634'),
  na('91_nariz', '9.1', 'Cabeza y cuello', 'Nariz', 620, 615, 'Texto644'),
  na('91_conductos', '9.1', 'Cabeza y cuello', 'Conductos', 599, 591, 'Texto636'),
  na('91_palpacion_cuello', '9.1', 'Cabeza y cuello', 'Palpación', 621, 616, 'Texto645'),
  na('91_adenopatias', '9.1', 'Cabeza y cuello', 'Adenopatías', 622, 617, 'Texto646'),
  na('91_timpanos', '9.1', 'Cabeza y cuello', 'Tímpanos', 600, 592, 'Texto637'),
  na('91_otros', '9.1', 'Cabeza y cuello', 'Otros', 623, 618, 'Texto647'),
  na('91_amigdalas', '9.1', 'Cabeza y cuello', 'Amígdalas', 601, 593),
  na('91_dentadura', '9.1', 'Cabeza y cuello', 'Dentadura', 602, 603),
  sign('91_adeno_sup', '9.1', 'Cabeza y cuello', 'Adenopatías superior', 624, 625),
  sign('91_adeno_inf', '9.1', 'Cabeza y cuello', 'Adenopatías inferior', 625, 626),

  // —— 9.2 Tórax ——
  na('92_inspeccion', '9.2', 'Tórax', 'Inspección', 701, 702),
  na('92_pulmonar_inspeccion', '9.2', 'Pulmonar', 'Inspección', 707, 708),
  na('92_ritmo', '9.2', 'Corazón', 'Ritmo', 699, 700),
  na('92_percusion', '9.2', 'Pulmonar', 'Percusión', 713, 714),
  na('92_palpacion', '9.2', 'Corazón', 'Palpación', 721, 722),

  // —— 9.3 Abdomen (impreso: Ruidos; Inspección; Palpación (Megalias); Percusión; Hernias) ——
  na('93_ruidos', '9.3', 'Abdomen', 'Ruidos', 723, 724),
  na('93_inspeccion', '9.3', 'Abdomen', 'Inspección', 705, 706),
  na('93_palpacion_megalias', '9.3', 'Abdomen', 'Palpación (Megalias)', 709, 710),
  na('93_percusion', '9.3', 'Abdomen', 'Percusión', 711, 712),
  na('93_hernias', '9.3', 'Abdomen', 'Hernias', 871, 872),

  // —— 9.4 Genitourinario ——
  na('94_testiculos', '9.4', 'Genitourinario', 'Testículos', 901, 902),
  na('94_mujer', '9.4', 'Genitourinario', 'Mujer', 903, 904),
  na('94_tr', '9.4', 'Genitourinario', 'TR (si aplica)', 905, 906),
  na('94_anamnesis', '9.4', 'Genitourinario', 'A la anamnesis', 907, 908),

  // —— 9.5 Osteomuscular ——
  sign('95_phalen_d', '9.5', 'PHALEN', 'D', 893, 894),
  sign('95_phalen_i', '9.5', 'PHALEN', 'I', 895, 896),
  sign('95_tinnel_d', '9.5', 'TINNEL', 'D', 897, 898),
  sign('95_tinnel_i', '9.5', 'TINNEL', 'I', 899, 900),
  na('95_hombro_d', '9.5', 'Arcos de movimiento (MS)', 'Homb. D', 717, 718),
  na('95_hombro_i', '9.5', 'Arcos de movimiento (MS)', 'Homb. I', 725, 726),
  na('95_codo_d', '9.5', 'Arcos de movimiento (MS)', 'Codo D', 719, 720),
  na('95_codo_i', '9.5', 'Arcos de movimiento (MS)', 'Codo I', 727, 728),
  na('95_muneca_d', '9.5', 'Arcos de movimiento (MS)', 'Muñec. D', 729, 730),
  na('95_muneca_i', '9.5', 'Arcos de movimiento (MS)', 'Muñec. I', 731, 732),
  na('95_dedos_d', '9.5', 'Arcos de movimiento (MS)', 'Dedos D', 733, 734),
  na('95_dedos_i', '9.5', 'Arcos de movimiento (MS)', 'Dedos I', 735, 736),
  na('95_ms_atrofia', '9.5', 'Miembros superiores', 'Atrofia', 821, 822),
  na('95_ms_hipertrofia', '9.5', 'Miembros superiores', 'Hipertrofia', 823, 824),
  na('95_ms_palpacion', '9.5', 'Miembros superiores', 'Palpación', 825, 826),
  na('95_ms_sensibilidad', '9.5', 'Miembros superiores', 'Sensibilidad', 845, 846),
  na('95_mi_atrofia', '9.5', 'Miembros inferiores', 'Atrofia', 829, 830),
  na('95_mi_hipertrofia', '9.5', 'Miembros inferiores', 'Hipertrofia', 831, 832),
  na('95_mi_palpacion', '9.5', 'Miembros inferiores', 'Palpación', 833, 834),
  na('95_mi_sensibilidad', '9.5', 'Miembros inferiores', 'Sensibilidad', 835, 836),
  na('95_marcha', '9.5', 'Marcha', 'MARCHA', 837, 838),
  txt('95_claudicacion', '9.5', 'Marcha', 'Claudicación', 'Claudicación'),
  txt('95_ayudas', '9.5', 'Marcha', 'Ayudas', 'Ayudas'),
  txt(
    '95_lesiones_repetitivas',
    '9.5',
    'Lesiones repetitivas',
    'Estructuras anormales / LESIONES REPETITIVAS',
    'Texto911',
  ),

  // —— 9.6 Columna vertebral (rejilla del impreso; casillas N/A/D) ——
  na('96_curva_cervical', '9.6', 'Curva', 'Cervical', 777, 778),
  na('96_curva_dorsal', '9.6', 'Curva', 'Dorsal', 781, 784),
  na('96_curva_lumbar', '9.6', 'Curva', 'Lumbar', 782, 785),
  na('96_escoliosis', '9.6', 'Curva', 'Escoliosis', 783, 786),
  na('96_cifosis', '9.6', 'Curva', 'Cifosis', 740, 741),
  na('96_lordosis', '9.6', 'Curva', 'Lordosis', 742, 743),
  na('96_arco_cervical', '9.6', 'Arcos de movimiento', 'Cervical', 744, 745),
  na('96_arco_dorsal', '9.6', 'Arcos de movimiento', 'Dorsal', 746, 747),
  na('96_arco_lumbar', '9.6', 'Arcos de movimiento', 'Lumbar', 748, 749),
  na('96_dolor', '9.6', 'Columna vertebral', 'Dolor', 750, 751),
  na('96_espasmo', '9.6', 'Columna vertebral', 'Espasmo', 752, 753),
  txt('96_observaciones', '9.6', 'Columna vertebral', 'Observaciones', 'Texto913'),

  // —— 9.7 Vascular periférico ——
  na('97_pulsos', '9.7', 'Vascular periférico', 'Pulsos periféricos', 805, 806),
  na('97_varices', '9.7', 'Vascular periférico', 'Várices', 807, 808),

  // —— 9.8 Piel y faneras ——
  txt('98_cicatrices', '9.8', 'Piel y faneras', 'Cicatrices', 'Texto882'),
  txt('98_tatuajes', '9.8', 'Piel y faneras', 'Tatuajes', 'Texto882'),
  txt('98_nevus', '9.8', 'Piel y faneras', 'Nevus', 'Texto882'),
  txt('98_unas', '9.8', 'Piel y faneras', 'Uñas', 'Texto882'),
  txt('98_dermatosis', '9.8', 'Piel y faneras', 'Dermatosis / otras', 'Texto882'),
]

export function sodexoExamenFisicoCatalogBySection(section: SodexoEfSectionId): SodexoEfCatalogEntry[] {
  return SODEXO_EXAMEN_FISICO_CATALOG.filter((e) => e.section === section)
}

export function sodexoExamenFisicoGroups(section: SodexoEfSectionId): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of sodexoExamenFisicoCatalogBySection(section)) {
    if (!seen.has(e.group)) {
      seen.add(e.group)
      out.push(e.group)
    }
  }
  return out
}

export const SODEXO_EXAMEN_FISICO_SECTIONS: SodexoEfSectionDef[] = [
  { id: '9.1', title: 'Cabeza y cuello', groups: sodexoExamenFisicoGroups('9.1') },
  { id: '9.2', title: 'Tórax', groups: sodexoExamenFisicoGroups('9.2') },
  { id: '9.3', title: 'Abdomen', groups: sodexoExamenFisicoGroups('9.3') },
  { id: '9.4', title: 'Genitourinario', groups: sodexoExamenFisicoGroups('9.4') },
  { id: '9.5', title: 'Osteomuscular', groups: sodexoExamenFisicoGroups('9.5') },
  { id: '9.6', title: 'Columna vertebral', groups: sodexoExamenFisicoGroups('9.6') },
  { id: '9.7', title: 'Vascular periférico', groups: sodexoExamenFisicoGroups('9.7') },
  { id: '9.8', title: 'Piel y faneras', groups: sodexoExamenFisicoGroups('9.8') },
]

export function examenFisicoSodexoIsEmpty(
  map: Record<string, { resultado?: string | null; desc?: string | null }> | null | undefined,
): boolean {
  if (!map) return true
  return !Object.values(map).some((r) => {
    if ((r?.desc ?? '').trim()) return true
    return r?.resultado === 'NORMAL' || r?.resultado === 'ANORMAL' || r?.resultado === 'NEG' || r?.resultado === 'POS'
  })
}
