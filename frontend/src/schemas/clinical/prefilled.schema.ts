/**
 * @fileoverview Schemas Zod para Portal de Prellenado Temporal — Módulo 1 del Trabajador
 * @description Validación de datos del portal de prellenado y metadatos de invitación.
 *              Reutiliza schemas de history.schema.ts y exam.schema.ts para las secciones
 *              clínicas ya definidas. Solo define lo nuevo aquí.
 * @see SPEC ARCH-20260324-09 (Portal Temporal), ARCH-20260324-08 (Examen Médico Dividido)
 * @id IMPL-20260324-07
 */

import { z } from 'zod';
import { HeredoFamiliaresSchema, NoPatologicosSchema, PatologicosSchema } from './history.schema';
import { ReproductivosInmunizacionesSchema } from './exam.schema';

const cleanStr = z.string().trim().max(500).optional();

// ─────────────────────────────────────────────────────────────────────────────
// Sección 1: Datos Personales declarativos
// Completable por el trabajador; complementa datos maestros del modelo Worker.
// ─────────────────────────────────────────────────────────────────────────────
export const DatosPersonalesModulo1Schema = z.object({
  puesto_actual:       cleanStr,
  area_departamento:   cleanStr,
  turno:               z.enum(['MATUTINO', 'VESPERTINO', 'NOCTURNO', 'MIXTO']).optional(),
  antiguedad_anios:    z.coerce.number().nonnegative().max(60).optional(),
  antiguedad_meses:    z.coerce.number().nonnegative().max(11).optional(),
  estado_civil:        z.enum(['SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO', 'OTRO']).optional(),
  escolaridad:         cleanStr,
  numero_hijos:        z.coerce.number().nonnegative().max(30).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Sección 2: Historia Laboral
// Exposición a riesgos y antecedentes laborales previos.
// ─────────────────────────────────────────────────────────────────────────────
export const HistoriaLaboralSchema = z.object({
  empresa_anterior_1:               cleanStr,
  puesto_anterior_1:                cleanStr,
  tiempo_anterior_1:                cleanStr,
  empresa_anterior_2:               cleanStr,
  puesto_anterior_2:                cleanStr,
  tiempo_anterior_2:                cleanStr,
  exposicion_quimica:               z.boolean().optional(),
  exposicion_quimica_especifique:   cleanStr,
  exposicion_fisica:                z.boolean().optional(),
  exposicion_fisica_especifique:    cleanStr,
  exposicion_biologica:             z.boolean().optional(),
  exposicion_biologica_especifique: cleanStr,
  exposicion_ergonomica:            z.boolean().optional(),
  exposicion_ergonomica_especifique: cleanStr,
  accidentes_trabajo:               z.boolean().optional(),
  accidentes_descripcion:           cleanStr,
  enfermedades_trabajo:             z.boolean().optional(),
  enfermedades_descripcion:         cleanStr,
});

// ─────────────────────────────────────────────────────────────────────────────
// Módulo 1 completo — esquema maestro
// Secciones 3-7 reutilizan schemas ya validados en history.schema.ts y exam.schema.ts.
// ─────────────────────────────────────────────────────────────────────────────
export const Module1DataSchema = z.object({
  /** Sección 1: Datos personales declarativos */
  datos_personales:          DatosPersonalesModulo1Schema.optional(),
  /** Sección 2: Historia laboral y exposición a riesgos */
  historia_laboral:          HistoriaLaboralSchema.optional(),
  /** Sección 3: Antecedentes heredo-familiares */
  heredo_familiares:         HeredoFamiliaresSchema.optional(),
  /** Sección 4: Antecedentes personales no patológicos y toxicomanías */
  no_patologicos:            NoPatologicosSchema.optional(),
  /** Sección 5: Antecedentes personales patológicos */
  patologicos:               PatologicosSchema.optional(),
  /** Sección 6 y 7: Antecedentes ginecológicos e inmunizaciones reportadas */
  ginecologicos_inmunizaciones: ReproductivosInmunizacionesSchema.optional(),
  /**
   * Estado visual de cada sección para indicador de avance.
   * Key = nombre de sección, Value = estado de progreso.
   */
  _seccion_status: z.record(
    z.enum(['datos_personales', 'historia_laboral', 'heredo_familiares', 'no_patologicos', 'patologicos', 'ginecologicos_inmunizaciones']),
    z.enum(['PENDING', 'PARTIAL', 'COMPLETE'])
  ).optional(),
});

export type Module1Data = z.infer<typeof Module1DataSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de entrada para server actions
// ─────────────────────────────────────────────────────────────────────────────

export const GenerateInvitationInputSchema = z.object({
  appointmentId: z.string().uuid('ID de cita inválido'),
  channel: z.enum(['WHATSAPP', 'LINK', 'QR', 'TABLET']).optional(),
});

export const SaveModule1InputSchema = z.object({
  plainToken: z.string().min(10).max(100),
  data:       Module1DataSchema,
  isFinal:    z.boolean().default(false),
});

export type GenerateInvitationInput = z.infer<typeof GenerateInvitationInputSchema>;
export type SaveModule1Input        = z.infer<typeof SaveModule1InputSchema>;
