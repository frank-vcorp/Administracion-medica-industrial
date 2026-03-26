/**
 * @fileoverview Schemas Zod para Portal de Prellenado Temporal — Módulo 1 del Trabajador
 * @description Validación de datos del portal de prellenado y metadatos de invitación.
 *              Reutiliza schemas de history.schema.ts y exam.schema.ts para las secciones
 *              clínicas ya definidas. Solo define lo nuevo aquí.
 * @see SPEC ARCH-20260324-09 (Portal Temporal), ARCH-20260324-08 (Examen Médico Dividido)
 * @id IMPL-20260324-07
 */

import { z } from 'zod';
import {
  DatosPersonalesModulo1Schema,
  HistoriaLaboralSchema,
  HeredoFamiliaresSchema,
  NoPatologicosSchema,
  PatologicosSchema,
} from './history.schema';
import { ReproductivosInmunizacionesSchema } from './exam.schema';

// ─────────────────────────────────────────────────────────────────────────────
// DatosPersonalesModulo1Schema y HistoriaLaboralSchema ahora viven en
// history.schema.ts y se importan desde allá — ARCH-20260326-06.
// ─────────────────────────────────────────────────────────────────────────────

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
