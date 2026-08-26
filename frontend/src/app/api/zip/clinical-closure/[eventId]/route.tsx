/**
 * @fileoverview Endpoint autenticado para descargar el ZIP consolidado de
 *   cierre clínico por `MedicalEvent`.
 *
 *   Estructura del ZIP:
 *     - `01_Dictamen_General/dictamen-general.pdf` ← ExamenMedicoValidatedPDF.
 *     - Una carpeta `NN_<serviceName>/` por estudio aplicable, con
 *       `dictamen-<slug>.txt` + `fuente-<slug>.<ext>` (placeholder si
 *       no hay archivo en disco).
 *     - `manifest.txt` con Event, archivos incluidos y fuentes ausentes.
 *
 *   Reglas (SPEC §Reglas):
 *     - Sólo SUPERADMIN / DOCTOR_GENERAL / DOCTOR_VALIDATOR descargan el
 *       ZIP completo (PII clínica).
 *     - COMPANY_CLIENT → 403 sin lookup del Event.
 *     - COMPANY_CLIENT NO comparte esta ruta: el dictamen reducido se
 *       sigue descargando por `/api/pdf/[eventId]` (legacy, autenticada
 *       por FND-20260825-18 P1-2).
 *     - Sin sesión → 401.
 *     - Sin verdict firmado → 404.
 *     - Sin aptitud canónica → 409 (paridad con P2-3).
 *     - Sin identidad del médico → 410 (paridad con ADR R6).
 *
 * @id IMPL-FEATURE-20260825-04
 * @backup context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md
 *
 * Límite operativo (SPEC §Reglas): el ZIP es una primera versión
 * operativa — la persistencia documental definitiva queda diferida.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import {
  buildCierreClinicoZip,
  CierreClinicoError,
} from '@/lib/zip-cierre-clinico'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  // 1) Sesión obligatoria.
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('No autenticado', { status: 401 })
  }
  const role = session.user.role

  // 2) eventId obligatorio.
  const { eventId } = await params
  if (!eventId) {
    return new NextResponse('eventId requerido', { status: 400 })
  }

  // 3) Gate de roles: sólo clínicos. COMPANY_CLIENT y resto → 403
  //    ANTES del lookup del Event (no enumerar).
  const isClinical =
    role === 'SUPERADMIN' ||
    role === 'DOCTOR_GENERAL' ||
    role === 'DOCTOR_VALIDATOR'
  if (!isClinical) {
    return new NextResponse(
      'Sin permisos para descargar el ZIP de cierre clínico.',
      { status: 403 },
    )
  }

  // 4) Construcción del ZIP (puede fallar por gates conocidos).
  try {
    const { zip, filename } = await buildCierreClinicoZip(eventId)
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (err) {
    if (err instanceof CierreClinicoError) {
      const message =
        err.code === 'aptitud_missing'
          ? 'El dictamen no tiene aptitud registrada. El médico debe completar la aptitud antes de generar el ZIP.'
          : err.code === 'verdict_missing'
          ? 'El dictamen aún no ha sido emitido.'
          : err.code === 'event_not_found'
          ? 'Recurso no disponible.'
          : err.code === 'validator_identity_incomplete'
          ? 'El médico firmante no tiene identidad congelada completa (cédula/firma). El ZIP no puede generarse.'
          : 'No fue posible generar el ZIP.'
      return new NextResponse(message, { status: err.httpStatus })
    }
    console.error(
      '[IMPL-FEATURE-20260825-04] Error generando ZIP de cierre clínico:',
      err,
    )
    return new NextResponse(
      'Error al generar el ZIP de cierre clínico.',
      { status: 500 },
    )
  }
}