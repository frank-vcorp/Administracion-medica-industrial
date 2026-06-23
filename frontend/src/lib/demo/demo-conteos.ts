// Conteos y agregados del proyecto demo.
// Mantener simple: lógica determinística basada en los datos hardcodeados.

import type { DemoConteos, DemoProject, DemoWorker } from './demo-types';

/**
 * Determina si un trabajador tiene todos los estudios con datos
 * (ninguno marcado como "N/A" en los campos críticos del concentrado).
 *
 * Estudios evaluados: campimetría, audiometría, espirometría, RX columna,
 * RX tórax, ECG, laboratorio.
 */
function tieneTodosLosEstudios(w: DemoWorker): boolean {
  const checks = [
    w.campimetria.agudezaVisual !== 'N/A',
    w.campimetria.camposVisuales !== 'N/A',
    w.campimetria.discriminacionColor !== 'N/A',
    w.audiometria.dx !== 'N/A',
    w.audiometria.oidoDerecho !== 'N/A',
    w.audiometria.oidoIzquierdo !== 'N/A',
    w.espirometria.patron !== 'N/A',
    w.espirometria.fvc !== 'N/A',
    w.rxColumna.impresion !== 'N/A',
    w.rxTorax.impresion !== 'N/A',
    w.ecg.impresion !== 'N/A',
    w.laboratorio.bh.hb !== null,
    w.laboratorio.qs6.gluc !== null,
  ];
  return checks.every(Boolean);
}

/**
 * Determina si un trabajador no tiene ningún estudio con datos (todo N/A).
 */
function noTieneEstudios(w: DemoWorker): boolean {
  return (
    w.campimetria.agudezaVisual === 'N/A' &&
    w.audiometria.dx === 'N/A' &&
    w.espirometria.patron === 'N/A' &&
    w.rxColumna.impresion === 'N/A' &&
    w.rxTorax.impresion === 'N/A' &&
    w.ecg.impresion === 'N/A'
  );
}

/**
 * Calcula los conteos mostrados en el modal de preview.
 * En este dataset: 10 totales, 7 completos, 2 parciales, 1 sin estudios (RX).
 *
 * NOTA: Para HERNANDEZ BARRERA MARIA GUADALUPE, la campimetría y RX Tórax/ECG
 * son N/A pero el resto sí tiene datos -> PARCIAL.
 */
export function calcularConteos(project: DemoProject): DemoConteos {
  const total = project.trabajadores.length;
  let completos = 0;
  let sinEstudios = 0;

  for (const w of project.trabajadores) {
    if (noTieneEstudios(w)) {
      sinEstudios += 1;
    } else if (tieneTodosLosEstudios(w)) {
      completos += 1;
    }
  }

  return {
    total,
    completos,
    parciales: total - completos - sinEstudios,
    sinEstudios,
  };
}

/**
 * Convierte una edad tipo "28 A" a número entero de años.
 * Devuelve null si no se puede parsear.
 */
export function parseEdad(edad: string): number | null {
  const m = edad.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Calcula la distribución por rango etario y por sexo.
 */
export function calcularDistribuciones(project: DemoProject) {
  let edad18a30 = 0;
  let edad31a45 = 0;
  let edad46mas = 0;
  let masculino = 0;
  let femenino = 0;

  for (const w of project.trabajadores) {
    const edad = parseEdad(w.laboratorio.edad);
    if (edad !== null) {
      if (edad <= 30) edad18a30 += 1;
      else if (edad <= 45) edad31a45 += 1;
      else edad46mas += 1;
    }
    if (w.sexo === 'MASCULINO') masculino += 1;
    else femenino += 1;
  }

  return { edad18a30, edad31a45, edad46mas, masculino, femenino };
}

/**
 * Conteo de audiometrías por nivel de % HBC.
 * Rangos: Normal <10%, Alto 10-19%, Muy Alto >=20%.
 */
export function calcularHbcPorRango(project: DemoProject) {
  let normal = 0;
  let alto = 0;
  let muyAlto = 0;
  for (const w of project.trabajadores) {
    const h = w.audiometria.hbc;
    if (h === null) continue;
    if (h < 10) normal += 1;
    else if (h < 20) alto += 1;
    else muyAlto += 1;
  }
  return { normal, alto, muyAlto };
}

/**
 * Conteo de trauma acústico por área.
 */
export function calcularTraumaAcusticoPorArea(project: DemoProject) {
  const mapa = new Map<string, number>();
  for (const w of project.trabajadores) {
    const dx = (w.audiometria.dx || '').toUpperCase();
    const esTa =
      dx.includes('TA') ||
      dx.includes('TRAUMA') ||
      dx.includes('HIPOACUSIA');
    if (!esTa) continue;
    mapa.set(w.area, (mapa.get(w.area) ?? 0) + 1);
  }
  return Array.from(mapa.entries()).map(([area, conteo]) => ({ area, conteo }));
}

/**
 * Distribución del patrón espirométrico.
 */
export function calcularEspirometriaDistribucion(project: DemoProject) {
  const mapa = new Map<string, number>();
  for (const w of project.trabajadores) {
    const patron = w.espirometria.patron || 'N/A';
    mapa.set(patron, (mapa.get(patron) ?? 0) + 1);
  }
  return Array.from(mapa.entries()).map(([patron, conteo]) => ({ patron, conteo }));
}

/**
 * Distribución de escoliosis según grado Cobb:
 * NORMAL <5°, LEVE 5-9°, MODERADA 10-19°, GRAVE >=20°.
 */
export function calcularEscoliosisDistribucion(project: DemoProject) {
  let normal = 0;
  let leve = 0;
  let moderada = 0;
  let grave = 0;
  for (const w of project.trabajadores) {
    const g = w.rxColumna.escoliosis;
    if (g === null) continue;
    if (g < 5) normal += 1;
    else if (g < 10) leve += 1;
    else if (g < 20) moderada += 1;
    else grave += 1;
  }
  return { normal, leve, moderada, grave };
}

/**
 * Niveles de colesterol/triglicéridos/glucosa según rangos clínicos básicos.
 */
export function calcularQs6Niveles(project: DemoProject) {
  let glucosaNormal = 0;
  let glucosaAlta = 0;
  let colNormal = 0;
  let colLimite = 0;
  let colAlto = 0;
  let trigNormal = 0;
  let trigLimite = 0;
  let trigAlto = 0;

  for (const w of project.trabajadores) {
    const g = w.laboratorio.qs6.gluc;
    const c = w.laboratorio.qs6.col;
    const t = w.laboratorio.qs6.trig;

    if (g !== null) {
      if (g < 100) glucosaNormal += 1;
      else glucosaAlta += 1;
    }
    if (c !== null) {
      if (c < 200) colNormal += 1;
      else if (c < 240) colLimite += 1;
      else colAlto += 1;
    }
    if (t !== null) {
      if (t < 150) trigNormal += 1;
      else if (t < 200) trigLimite += 1;
      else trigAlto += 1;
    }
  }

  return {
    glucosa: { normal: glucosaNormal, alta: glucosaAlta },
    colesterol: { normal: colNormal, limite: colLimite, alto: colAlto },
    trigliceridos: { normal: trigNormal, limite: trigLimite, alto: trigAlto },
  };
}
