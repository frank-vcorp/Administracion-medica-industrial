/**
 * Texto oficial del consentimiento informado (Formato autorizado 005-18).
 * Fuente: public/templates/consentimiento-informado.pdf
 */

export function formatInformedConsentDate(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const INFORMED_CONSENT_TITLE = 'Consentimiento informado'

export const INFORMED_CONSENT_BODY_INTRO =
  'declaro que he sido informado de los procedimientos médicos y/o de laboratorio a los que seré sometido(a), comprendo en qué consisten dichos procedimientos, los riesgos y beneficios que dichos procedimientos conllevan. Es mi voluntad someterme a los procedimientos que me han sido explicados, otorgo mi consentimiento expreso para que el personal de la empresa, cuyos datos aparecen en el encabezado de este documento, me realice los procedimientos que se me han informado. Otorgo así mismo mi consentimiento para que la información obtenida como resultado de dichos procedimientos sea tratada conforme al aviso de privacidad que aparece al final de este documento. Declaro que toda la información que proporcioné es verdadera y completa. Declaro que no he suprimido, falseado o alterado ningún hecho clínico importante.'

export const INFORMED_CONSENT_PRIVACY_TITLE = 'Aviso de privacidad'

export const INFORMED_CONSENT_PRIVACY_PARAGRAPHS = [
  'Soluciones Médico Empresariales S de RL de CV. con fundamento en los artículos 15 y 16 de la Ley Federal de protección de datos personales en posesión de particulares se compromete a asegurar la confidencialidad/privacidad de la información personal obtenida al realizar las pruebas médicas que ha solicitado.',
  'Su información personal será utilizada para las siguientes finalidades: proveer la información que nuestro cliente solicita respecto a su Expediente Clínico, informarle sobre cambios en los mismos y evaluar la calidad del servicio que le brindamos y en general, para dar cumplimiento a las obligaciones que hemos contraído con nuestros clientes.',
  'Para las finalidades antes mencionadas requerimos obtener los siguientes datos personales:',
] as const

export const INFORMED_CONSENT_PRIVACY_DATA_ITEMS = [
  'Identificación oficial vigente',
  'Nombre completo',
  'Fecha de nacimiento',
  'Teléfono fijo / celular',
  'Correo electrónico',
  'Firma autógrafa',
] as const

export const INFORMED_CONSENT_PRIVACY_FOOTER =
  'Es importante informarle que usted tiene derecho al acceso, rectificación y cancelación de sus datos personales, a oponerse al tratamiento de los mismos o a revocar el consentimiento que para dicho fin nos haya otorgado. Para ello es necesario que envíe la solicitud en los términos que marca la Ley en su artículo 29 vía correo electrónico a: calidad@medicaindustrial.com o bien que se comunique al teléfono (442) 480 05 48. Ext. 105.'

export const INFORMED_CONSENT_FORMAT_CODE = 'Formato autorizado 005-18'
