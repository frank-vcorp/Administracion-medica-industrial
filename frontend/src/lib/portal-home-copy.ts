/**
 * Copy canónico del inicio portal B2B (F34).
 * Cliente real y vista previa «Ver portal como esta empresa» deben renderizar
 * exactamente estos textos — no reutilizar copy del dashboard staff.
 */
export const PORTAL_HOME_COPY = {
  eyebrow: 'Portal empresarial',
  title: 'Bienvenido a tu software especializado en salud ocupacional',
  subtitle:
    'Visualiza tu equipo con claridad: dashboard en vivo, pacientes atendidos, citados y cancelados — todo en un solo lugar, con la tranquilidad de trabajar con datos confiables para la salud de tus colaboradores.',
  ctaExpedientes: 'Expedientes',
  ctaAgendar: '+ Agendar cita',
  kpi: {
    colaboradores: 'Colaboradores',
    atendidos: 'Atendidos del mes',
    citados: 'Citados del mes',
    cancelados: 'Cancelados del mes',
    expedientesCompletados: 'Expedientes completados',
    enProceso: 'En proceso',
  },
  chartTitle: 'Atendidos por mes',
  chartSubtitle: 'Últimos 12 meses · evolución del equipo atendido',
} as const

export type PortalHomeCopy = typeof PORTAL_HOME_COPY
