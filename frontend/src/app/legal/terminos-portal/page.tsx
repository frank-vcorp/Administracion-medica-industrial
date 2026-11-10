import { SME_LEGAL_NAME } from '@/lib/brand-constants'

export default function PortalTermsPage() {
  return (
    <article className="max-w-3xl mx-auto py-10 px-4 prose prose-slate">
      <h1>Términos y condiciones — Portal cliente</h1>
      <p className="text-sm text-slate-500">Versión 2026-10-06</p>
      <p>
        El portal cliente de {SME_LEGAL_NAME} permite a la empresa contratante consultar
        información autorizada sobre sus trabajadores y gestionar trámites administrativos
        acordados con {SME_LEGAL_NAME}.
      </p>
      <p>
        El usuario declara estar autorizado por su empresa para acceder a datos de personal bajo su
        responsabilidad. Queda prohibido compartir credenciales o descargar información con fines
        distintos a los laborales autorizados.
      </p>
      <p>
        {SME_LEGAL_NAME} puede suspender el acceso por incumplimiento, riesgo de seguridad o
        término del convenio. El contenido clínico detallado y procesos de validación médica son
        responsabilidad exclusiva de {SME_LEGAL_NAME}.
      </p>
      <p className="text-sm text-slate-600">
        Sustituya este texto por el documento legal definitivo de su asesoría jurídica cuando esté
        listo.
      </p>
    </article>
  )
}
