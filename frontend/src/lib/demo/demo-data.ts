// Datos hardcodeados del DEMO UMM.
// Fuente: context/datos AMI/Proyectos UMM/CONCENTRADO GENERAL EJEMPLO.xlsx
// Solo se usan dentro del módulo /demo. NO se conecta a backend ni Prisma.

import type { DemoProject } from './demo-types';

export const DEMO_PROJECT_ID = 'valiant-umm-demo';

export const DEMO_PROJECT: DemoProject = {
  id: DEMO_PROJECT_ID,
  empresa: 'VALIANT DE MÉXICO - UMM Demo',
  empresaLegal: 'VALIANT DE MÉXICO S.A. DE C.V.',
  fecha: '2026-06-23',
  trabajadores: [
    {
      folio: '168058',
      nombre: 'AGUILAR ARREOLA JOSE DAVID',
      sexo: 'MASCULINO',
      area: 'SOLDADURA',
      antiguedad: '3 AÑOS 9 MESES',
      campimetria: {
        agudezaVisual: 'DISMINUIDA SIN USO DE LENTES',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'NORMAL',
        oidoDerecho: 'Audición Normal',
        oidoIzquierdo: 'Audición Normal',
        hbc: -1.25,
      },
      espirometria: { patron: 'NORMAL', fvc: 0.93, tabaquismo: 'NEGADO' },
      rxColumna: {
        escoliosis: 3,
        lordosis: 36,
        basculacion: 0,
        valoracionPostural:
          '1.- CUELLO CORTO. 2.- HIPERCIFOSIS CERVICAL. 3.- HIPERLORDOSIS. 4.- GENU VALGO. 5.- HALLUX VALGUX.',
        impresion:
          'DESVIACION LEVOCONVEXA LUMBOSACRA ( 3° ) CON LORDOSIS NORMAL Y CON ANGULO DE 36°. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES.',
      },
      rxTorax: {
        impresion:
          'TORAX RADIOLOGICAMENTE NORMAL, SIN EVIDENCIA DE PATOLOGÍA AGUDA O EVOLUTIVA APARENTE.',
      },
      ecg: {
        impresion:
          'Electrocardiograma en reposo sin datos de anormalidad al momento del estudio',
      },
      laboratorio: {
        folioLab: '260417010016',
        edad: '28 A',
        bh: { hb: 16.4, mchb: 31.2, chgm: 34.1, leu: 7.6, pla: 217 },
        qs6: { gluc: 74.3, bun: 17, urea: 36.3, creat: 1, au: 9.8, col: 208.8, trig: 80.3 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'AUSENTES',
          cristales: 'URATOS AMORFOS ESCASOS',
        },
        toxico: {
          anfeta: 'POSITIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'POSITIVO',
        },
      },
    },
    {
      folio: '168146',
      nombre: 'CRUZ MARTINEZ EDUARDO MISAEL',
      sexo: 'MASCULINO',
      area: 'ALMACEN F5',
      antiguedad: '3 AÑOS',
      campimetria: {
        agudezaVisual: 'DISMINUIDA SIN USO DE LENTES',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'NORMAL',
        oidoDerecho: 'Audición Normal',
        oidoIzquierdo: 'Audición Normal',
        hbc: 3.38,
      },
      espirometria: {
        patron: 'PATRÓN ESPIROMÉTRICO RESTRICTIVO LEVE',
        fvc: 0.73,
        tabaquismo: 'NEGADO',
      },
      rxColumna: {
        escoliosis: 5,
        lordosis: 44,
        basculacion: 1,
        valoracionPostural: '1.-HIPERLORDOSIS 2.- PIE PLANO',
        impresion:
          'DESVIACION LEVOCONVEXA LUMBOSACRA ( 5° ) CON HIPERLORDOSIS, INESTABILIDAD LUMBAR Y CON ANGULO DE 44°. PINZAMIENTO L5-S1. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES. BASCULACION PELVICA IZQUIERDA DE 1.0 cm.',
      },
      rxTorax: {
        impresion:
          'TORAX RADIOLOGICAMENTE NORMAL, SIN EVIDENCIA DE PATOLOGÍA AGUDA O EVOLUTIVA APARENTE.',
      },
      ecg: {
        impresion:
          'Electrocardiograma en reposo sin datos de anormalidad al momento del estudio',
      },
      laboratorio: {
        folioLab: '260420010040',
        edad: '28 A',
        bh: { hb: 17.4, mchb: 30.4, chgm: 35.2, leu: 8.2, pla: 360 },
        qs6: { gluc: 87.7, bun: 11.4, urea: 24.4, creat: 0.9, au: 6.1, col: 273.9, trig: 276.2 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'ESCASAS',
          cristales: 'URATOS AMORFOS ESCASOS',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
    {
      folio: '168100',
      nombre: 'DE LUNA MORALES ANGEL EDUARDO',
      sexo: 'MASCULINO',
      area: 'MAQUINADOS',
      antiguedad: '5 AÑOS',
      campimetria: {
        agudezaVisual: 'NORMAL',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'FATIGA AUDITIVA',
        oidoDerecho: 'Audición Normal',
        oidoIzquierdo: 'Audición Normal, Datos de Fatiga Auditiva',
        hbc: -0.5,
      },
      espirometria: { patron: 'NORMAL', fvc: 0.86, tabaquismo: 'NEGADO' },
      rxColumna: {
        escoliosis: 5,
        lordosis: 36,
        basculacion: 0,
        valoracionPostural: '1.- HIPERLORDOSIS',
        impresion:
          'DESVIACION LEVOCONVEXA LUMBOSACRA ( 5° ) CON LORDOSIS NORMAL Y CON ANGULO DE 36°. PINZAMIENTO L5-S1. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES.',
      },
      rxTorax: {
        impresion:
          'TORAX RADIOLOGICAMENTE NORMAL, SIN EVIDENCIA DE PATOLOGÍA AGUDA O EVOLUTIVA APARENTE.',
      },
      ecg: {
        impresion:
          'Electrocardiograma en reposo sin datos de anormalidad al momento del estudio',
      },
      laboratorio: {
        folioLab: '260420010014',
        edad: '30 A',
        bh: { hb: 18.4, mchb: 30.5, chgm: 35.2, leu: 7.8, pla: 252 },
        qs6: { gluc: 78.4, bun: 20.7, urea: 44.3, creat: 1.3, au: 6.6, col: 202.8, trig: 215.3 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 25,
          bac: 'ESCASAS',
          cristales: 'OXALATOS DE CALCIO DIHIDRATADOS ABUNDANTES',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
    {
      folio: '168041',
      nombre: 'GARCIA PACHUCA LUIS FERNANDO',
      sexo: 'MASCULINO',
      area: 'MAQUINADOS',
      antiguedad: '2 AÑOS',
      campimetria: {
        agudezaVisual: 'NORMAL',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'NORMAL',
        oidoDerecho: 'Audición Normal',
        oidoIzquierdo: 'Audición Normal',
        hbc: 5.5,
      },
      espirometria: { patron: 'NORMAL', fvc: 0.85, tabaquismo: 'NEGADO' },
      rxColumna: {
        escoliosis: 3,
        lordosis: 40,
        basculacion: 0,
        valoracionPostural:
          '1.- HIPERCIFOSIS CERVICAL. 2.- ASCENSO DE PLIEGUE DE GLUTEO IZQUIERDO 3.- LORDOSIS LUMBAR',
        impresion:
          'DESVIACION DEXTROCONVEXA LUMBOSACRA ( 3° ) CON HIPERLORDOSIS Y CON ANGULO DE 40°. PINZAMIENTO L-5-S1. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES.',
      },
      rxTorax: {
        impresion:
          'TORAX RADIOLOGICAMENTE NORMAL, SIN EVIDENCIA DE PATOLOGÍA AGUDA O EVOLUTIVA APARENTE.',
      },
      ecg: {
        impresion:
          'Electrocardiograma en reposo sin datos de anormalidad al momento del estudio',
      },
      laboratorio: {
        folioLab: '260417010019',
        edad: '21 A',
        bh: { hb: 16.4, mchb: 28, chgm: 34, leu: 5.8, pla: 226 },
        qs6: { gluc: 64.1, bun: 17.1, urea: 36.5, creat: 1.1, au: 7.1, col: 148, trig: 112.4 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'ESCASAS',
          cristales: 'URATOS AMORFOS ESCASOS',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
    {
      folio: '168016',
      nombre: 'GOMEZ LUCIO JOSE MANUEL',
      sexo: 'MASCULINO',
      area: 'SOLDADURA',
      antiguedad: '4 AÑOS 6 MESES',
      campimetria: {
        agudezaVisual: 'NORMAL',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'FATIGA AUDITIVA',
        oidoDerecho: 'Audición Normal, Datos de Fatiga Auditiva',
        oidoIzquierdo: 'Audición Normal, Datos de Fatiga Auditiva',
        hbc: 4.13,
      },
      espirometria: { patron: 'NORMAL', fvc: 0.87, tabaquismo: 'POSITIVO' },
      rxColumna: {
        escoliosis: 3,
        lordosis: 36,
        basculacion: 0,
        valoracionPostural: '1.- ANTEPULSION DE HOMBRO DERECHO. 2.- HIPERLORDOSIS.',
        impresion:
          'DESVIACION DEXTROCONVEXA LUMBOSACRA ( 3° ) CON LORDOSIS NORMAL Y CON ANGULO DE 36°. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES.',
      },
      rxTorax: {
        impresion:
          'TORAX RADIOLOGICAMENTE NORMAL, SIN EVIDENCIA DE PATOLOGÍA AGUDA O EVOLUTIVA APARENTE.',
      },
      ecg: {
        impresion:
          'Bradicardia sinusal, resto del estudio sin datos de anormalidad al momento del estudio',
      },
      laboratorio: {
        folioLab: '260417010020',
        edad: '30 A',
        bh: { hb: 17.3, mchb: 31.2, chgm: 33.9, leu: 6.2, pla: 251 },
        qs6: { gluc: 69.3, bun: 13.7, urea: 29.3, creat: 1.3, au: 7.5, col: 196.1, trig: 225.2 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'ESCASAS',
          cristales: 'URATOS AMORFOS MODERADOS',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
    {
      folio: '168054',
      nombre: 'HERNANDEZ BARRERA MARIA GUADALUPE',
      sexo: 'FEMENINO',
      area: 'MANTENIMIENTO',
      antiguedad: '11 MESES',
      campimetria: {
        agudezaVisual: 'N/A',
        camposVisuales: 'N/A',
        discriminacionColor: 'N/A',
      },
      audiometria: {
        dx: 'NORMAL',
        oidoDerecho: 'Audición Normal',
        oidoIzquierdo: 'Audición Normal',
        hbc: 7.63,
      },
      espirometria: { patron: 'N/A', fvc: 'N/A', tabaquismo: 'NEGADO' },
      rxColumna: {
        escoliosis: 4,
        lordosis: 44,
        basculacion: 0,
        valoracionPostural: '1.- HIPERLORDOSIS 2.- HIPERSIFOSIS.',
        impresion:
          'DESVIACION DEXTROCONVEXA LUMBOSACRA ( 4° ) CON HIPERLORDOSIS, INESTABILIDAD LUMBAR Y CON ANGULO DE 44°. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES.',
      },
      rxTorax: { impresion: 'N/A' },
      ecg: { impresion: 'N/A' },
      laboratorio: {
        folioLab: '260417010026',
        edad: '28 A',
        bh: { hb: 14.6, mchb: 33.2, chgm: 34.5, leu: 7.1, pla: 271 },
        qs6: { gluc: 74.8, bun: 9.5, urea: 20.3, creat: 0.6, au: 5.6, col: 116.1, trig: 60.6 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'AUSENTES',
          cristales: 'URATOS AMORFOS ESCASOS',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
    {
      folio: '168024',
      nombre: 'MIRANDA CUEVAS HUGO',
      sexo: 'MASCULINO',
      area: 'SOLDADURA',
      antiguedad: '4 AÑOS',
      campimetria: {
        agudezaVisual: 'NORMAL',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'MODERADA TA',
        oidoDerecho:
          'Hipoacusia Neurosensorial, Moderada, Sugestivo de Trauma Acústico crónico por ruido',
        oidoIzquierdo: 'Audición Normal, Datos de Fatiga Auditiva',
        hbc: 2.5,
      },
      espirometria: { patron: 'NORMAL', fvc: 0.81, tabaquismo: 'NEGADO' },
      rxColumna: {
        escoliosis: 4,
        lordosis: 36,
        basculacion: 0,
        valoracionPostural: '1.- GENU VARO 2.- PIE PLANO 3.- HIPERCIFOSIS EN COLUMNA CERVICAL',
        impresion:
          'DESVIACION DEXTROCONVEXA LUMBOSACRA ( 4° ) CON LORDOSIS NORMAL Y CON ANGULO DE 36°. PINZAMIENTO L4-5-S1. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES.',
      },
      rxTorax: {
        impresion:
          'TORAX RADIOLOGICAMENTE NORMAL, SIN EVIDENCIA DE PATOLOGÍA AGUDA O EVOLUTIVA APARENTE.',
      },
      ecg: {
        impresion:
          'Electrocardiograma en reposo sin datos de anormalidad al momento del estudio',
      },
      laboratorio: {
        folioLab: '260417010030',
        edad: '45 A',
        bh: { hb: 17.2, mchb: 31.4, chgm: 34.7, leu: 4.9, pla: 251 },
        qs6: { gluc: 85.2, bun: 11.4, urea: 24.3, creat: 0.9, au: 7.5, col: 164.1, trig: 208.5 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'ESCASAS',
          cristales: 'AUSENTES',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
    {
      folio: '168013',
      nombre: 'NIEVES TREJO ADRIAN',
      sexo: 'MASCULINO',
      area: 'SOLDADURA',
      antiguedad: '3 AÑOS',
      campimetria: {
        agudezaVisual: 'DISMINUIDA SIN USO DE LENTES',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'LEVE TA',
        oidoDerecho:
          'Hipoacusia Neurosensorial, Leve, Sugestivo de Trauma Acústico crónico por ruido',
        oidoIzquierdo: 'Audición Normal',
        hbc: 6.38,
      },
      espirometria: { patron: 'NORMAL', fvc: 1, tabaquismo: 'POSITIVO' },
      rxColumna: {
        escoliosis: 3,
        lordosis: 45,
        basculacion: 0,
        valoracionPostural: '1.- PIE PLANO',
        impresion:
          'DESVIACION LEVOCONVEXA LUMBOSACRA ( 3° ) CON HIPERLORDOSIS, INESTABILIDAD LUMBAR Y CON ANGULO DE 45°. BOSTEZO Y PINZAMIENTO L5-S1. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES.',
      },
      rxTorax: {
        impresion:
          'TORAX RADIOLOGICAMENTE NORMAL, SIN EVIDENCIA DE PATOLOGÍA AGUDA O EVOLUTIVA APARENTE.',
      },
      ecg: {
        impresion:
          'Bradicardia sinusal, resto del estudio sin datos de anormalidad al momento del estudio',
      },
      laboratorio: {
        folioLab: '260417010032',
        edad: '43 A',
        bh: { hb: 16.2, mchb: 30.1, chgm: 34.6, leu: 7.7, pla: 216 },
        qs6: { gluc: 82.6, bun: 17.7, urea: 37.9, creat: 1, au: 8, col: 196.6, trig: 253.1 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'ESCASAS',
          cristales: 'URATOS AMORFOS ESCASOS',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
    {
      folio: '168057',
      nombre: 'RODRIGUEZ RAMIREZ VICTOR MANUEL',
      sexo: 'MASCULINO',
      area: 'MANTENIMIENTO',
      antiguedad: '11 MESES',
      campimetria: {
        agudezaVisual: 'DISMINUIDA SIN USO DE LENTES',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'LEVE TA',
        oidoDerecho: 'Audición Normal, Datos de Fatiga Auditiva',
        oidoIzquierdo:
          'Hipoacusia Neurosensorial, Leve, Sugestivo de Trauma Acústico crónico por ruido',
        hbc: 4.63,
      },
      espirometria: { patron: 'N/A', fvc: 'N/A', tabaquismo: 'NEGADO' },
      rxColumna: {
        escoliosis: 2,
        lordosis: 48,
        basculacion: 0,
        valoracionPostural: '1,- HIPERLORDOSIS 2,- HIPERCIFOSIS',
        impresion:
          'DESVIACIÓN DEXTROCONVEXA LUMBOSACRA ( 2° ), CON HIPERLORDOSIS (Angulo de Ferguson 48°). BOSTEZO ANTERIOR DE L5-S1. NO SE IDENTIFICAN FRACTURAS NI LISTESIS.',
      },
      rxTorax: { impresion: 'N/A' },
      ecg: { impresion: 'N/A' },
      laboratorio: {
        folioLab: '260417010037',
        edad: '44 A',
        bh: { hb: 16.8, mchb: 33.2, chgm: 34.4, leu: 5.7, pla: 157 },
        qs6: { gluc: 89.2, bun: 10.7, urea: 22.8, creat: 0.8, au: 6.8, col: 169.1, trig: 82.1 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'ESCASAS',
          cristales: 'FOSFATOS AMORFOS ESCASOS',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
    {
      folio: '168049',
      nombre: 'VELAZQUEZ MORENO LORENZO',
      sexo: 'MASCULINO',
      area: 'ALMACEN F5',
      antiguedad: '2 AÑOS',
      campimetria: {
        agudezaVisual: 'DISMINUIDA SIN USO DE LENTES',
        camposVisuales: 'NORMAL',
        discriminacionColor: 'NORMAL',
      },
      audiometria: {
        dx: 'NORMAL',
        oidoDerecho: 'Audición Normal',
        oidoIzquierdo: 'Audición Normal',
        hbc: -0.5,
      },
      espirometria: { patron: 'NORMAL', fvc: 0.99, tabaquismo: 'NEGADO' },
      rxColumna: {
        escoliosis: 6,
        lordosis: 36,
        basculacion: 1.8,
        valoracionPostural: '1,- LORDOSIS 2,- RETROVERSION',
        impresion:
          'DESVIACION DEXTROCONVEXA LUMBOSACRA ( 6° ) CON LORDOSIS NORMAL Y CON ANGULO DE 36°. LIGERO PINZAMIENTO L5-S1. L1 LIGERAMENTE ACUÑADA. NO SE IDENTIFICAN FRACTURAS NI TUMORACIONES. BASCULACION PELVICA DERECHA DE 1.8 cm.',
      },
      rxTorax: {
        impresion:
          'TORAX RADIOLOGICAMENTE NORMAL, SIN EVIDENCIA DE PATOLOGÍA AGUDA O EVOLUTIVA APARENTE.',
      },
      ecg: {
        impresion:
          'Electrocardiograma en reposo sin datos de anormalidad al momento del estudio',
      },
      laboratorio: {
        folioLab: '260417010041',
        edad: '41 A',
        bh: { hb: 17.8, mchb: 30.3, chgm: 34.6, leu: 5.5, pla: 165 },
        qs6: { gluc: 83.8, bun: 16.6, urea: 35.4, creat: 0.9, au: 5.6, col: 149, trig: 543.6 },
        ego: {
          glc: 0,
          prot: 0,
          blo: 0,
          bac: 'ESCASAS',
          cristales: 'URATOS AMORFOS ESCASOS',
        },
        toxico: {
          anfeta: 'NEGATIVO',
          coca: 'NEGATIVO',
          marihua: 'NEGATIVO',
          opiac: 'NEGATIVO',
          metanf: 'NEGATIVO',
        },
      },
    },
  ],
};

/**
 * Lista los proyectos demo disponibles. Hoy solo hay uno.
 */
export function getDemoProjects(): DemoProject[] {
  return [DEMO_PROJECT];
}

/**
 * Resuelve un proyecto demo por id. Devuelve null si no existe.
 */
export function getDemoProjectById(id: string): DemoProject | null {
  return getDemoProjects().find((p) => p.id === id) ?? null;
}
