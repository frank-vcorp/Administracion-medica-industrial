/**
 * Texto integral del Consentimiento Informado y Aviso de Privacidad Integral de Salud Ocupacional
 * personalizado para Soluciones Médico Empresariales, S. de R.L. de C.V. ("SME").
 * Fuente única para la vista en línea del check-in y la generación del PDF firmado.
 */

import { SME_LEGAL_NAME_FULL } from '@/lib/brand-constants'
import { CHECK_IN_PRIVACY_LEGAL_NAME } from '@/lib/legal/check-in-privacy-notice'

export const SME_ARCO_EMAIL = 'informes@medicaindustrial.com'
export const SME_ARCO_PHONE = '(442) 480 29 03'
export const SME_ADDRESS_FULL =
  'Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro, Qro.'
export const SME_WEBSITE = 'www.medicaindustrial.com'

export interface InformedConsentSection {
  roman: string
  title: string
  paragraphs: readonly string[]
  bullets?: readonly string[]
  numberedItems?: readonly string[]
  closingParagraph?: string
}

export function formatInformedConsentDate(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const INFORMED_CONSENT_TITLE =
  'Consentimiento Informado y Aviso de Privacidad Integral de Salud Ocupacional'

export const INFORMED_CONSENT_SUBTITLE = `${SME_LEGAL_NAME_FULL} ("SME")`

export const INFORMED_CONSENT_BODY_INTRO =
  `declaro que he sido informado(a) de los procedimientos médicos, de laboratorio y de gabinete a los que seré sometido(a), comprendo en qué consisten, así como sus riesgos y beneficios. Es mi voluntad someterme a los procedimientos que me han sido explicados y otorgo mi consentimiento expreso para que el personal autorizado de ${SME_LEGAL_NAME_FULL} ("SME") los realice. Asimismo, manifiesto que he leído y comprendido el presente Aviso de Privacidad Integral de Salud Ocupacional y otorgo mi consentimiento expreso para el tratamiento de mis datos personales y datos personales sensibles conforme a las disposiciones siguientes.`

export const INFORMED_CONSENT_PRIVACY_TITLE = 'AVISO DE PRIVACIDAD INTEGRAL DE SALUD OCUPACIONAL'

const INFORMED_CONSENT_PRIVACY_BODY_SHARED = [
  'Su información personal será utilizada para las finalidades descritas en el presente Aviso de Privacidad Integral de Salud Ocupacional, incluyendo la integración del expediente clínico ocupacional, la emisión de conclusiones de aptitud médico-laboral y el cumplimiento de la normativa aplicable.',
  'Para las finalidades antes mencionadas podremos recabar, entre otros, los siguientes datos personales:',
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
  `Usted tiene derecho al acceso, rectificación, cancelación y oposición (Derechos ARCO) respecto de sus datos personales, así como a oponerse al tratamiento o revocar el consentimiento otorgado, enviando su solicitud al correo electrónico ${SME_ARCO_EMAIL} o comunicándose al teléfono ${SME_ARCO_PHONE}.`

export const INFORMED_CONSENT_FORMAT_CODE =
  'SME · Salud Ocupacional · Consentimiento Informado y Aviso de Privacidad Integral'

function privacyIntroParagraph(): string {
  return `${CHECK_IN_PRIVACY_LEGAL_NAME} ("SME"), con fundamento en la legislación aplicable en materia de protección de datos personales en posesión de particulares, laboral y sanitaria, se compromete a asegurar la confidencialidad y privacidad de los datos personales y datos personales sensibles obtenidos durante la atención médica y las evaluaciones ocupacionales.`
}

/** Párrafos introductorios del aviso en check-in — siempre SME. */
export function getInformedConsentPrivacyParagraphs(): readonly string[] {
  return [privacyIntroParagraph(), ...INFORMED_CONSENT_PRIVACY_BODY_SHARED]
}

export const INFORMED_CONSENT_PRIVACY_PARAGRAPHS = getInformedConsentPrivacyParagraphs()

export const INFORMED_CONSENT_SECTIONS: readonly InformedConsentSection[] = [
  {
    roman: 'I',
    title: 'IDENTIDAD Y DOMICILIO DEL RESPONSABLE',
    paragraphs: [
      `${SME_LEGAL_NAME_FULL}, en adelante "SME", con domicilio en ${SME_ADDRESS_FULL}, es responsable del tratamiento y protección de los datos personales y datos personales sensibles que recaba con motivo de las actividades de Salud Ocupacional, vigilancia de la salud y prestación de servicios médicos en el trabajo. El tratamiento se realizará conforme a la legislación de protección de datos personales, laboral y sanitaria aplicable.`,
    ],
  },
  {
    roman: 'II',
    title: 'DATOS PERSONALES QUE PODREMOS RECABAR',
    paragraphs: [
      'SME podrá recabar, directamente o a través de personas encargadas autorizadas, datos de identificación y contacto tales como nombre, fecha de nacimiento, edad, sexo, CURP, RFC, número de trabajador, domicilio, teléfono, correo electrónico, fotografía, firma y otros datos necesarios para identificar a la persona titular.',
      'Asimismo, podrá recabar datos laborales como empresa contratante, puesto, área, centro de trabajo, unidad de negocio, fecha de ingreso, antigüedad, jornada, turno, actividades del puesto, antecedentes laborales, exposición ocupacional y factores relacionados con las condiciones de trabajo.',
    ],
  },
  {
    roman: 'III',
    title: 'DATOS PERSONALES SENSIBLES',
    paragraphs: [
      'Para las finalidades de Salud Ocupacional podrán tratarse datos relativos al estado de salud presente o futuro, entre ellos antecedentes personales y heredofamiliares; historia clínica; signos vitales; exploración física; accidentes y enfermedades; discapacidad cuando resulte pertinente; embarazo cuando exista una finalidad médica y laboral legítima; exposición ocupacional; resultados de laboratorio y gabinete; audiometría; espirometría; estudios visuales; electrocardiografía; estudios radiológicos cuando correspondan; diagnósticos; tratamientos; prescripciones; incapacidades; restricciones médicas; recomendaciones laborales; información epidemiológica y demás información clínica necesaria para la vigilancia y protección de la salud. La recopilación se limitará a datos necesarios, adecuados y relevantes para las finalidades informadas.',
    ],
  },
  {
    roman: 'IV',
    title: 'FINALIDADES PRIMARIAS',
    paragraphs: [
      'Los datos personales y sensibles podrán utilizarse para: realizar evaluaciones médicas de ingreso, periódicas, específicas, de retorno al trabajo, reincorporación, cambio de puesto, vigilancia médica y egreso; integrar, conservar, actualizar y gestionar el expediente clínico ocupacional; identificar condiciones que requieran vigilancia, atención, seguimiento, adaptación o referencia médica; emitir dictámenes de aptitud médico-laboral; determinar restricciones, recomendaciones, adaptaciones, vigilancia específica y fechas de reevaluación; realizar vigilancia de la salud según factores de riesgo y exposiciones del puesto; brindar atención médica, primeros auxilios y atención de urgencias dentro del alcance del servicio; efectuar seguimiento epidemiológico y acciones preventivas; cumplir obligaciones de seguridad y salud en el trabajo, medicina del trabajo, seguridad social y salud pública; atender requerimientos legalmente fundados de autoridades competentes; gestionar accidentes y enfermedades de trabajo; generar información estadística o epidemiológica preferentemente disociada; y realizar auditorías de cumplimiento y calidad usando la mínima información personal indispensable.',
    ],
  },
  {
    roman: 'V',
    title: 'INFORMACIÓN QUE PODRÁ COMUNICARSE A LA EMPRESA CONTRATANTE (RRHH, OPERACIONES Y ÁREAS AUTORIZADAS)',
    paragraphs: [
      'Como medida de minimización y confidencialidad, el expediente clínico ocupacional tendrá acceso restringido al personal médico y demás personal expresamente autorizado de SME. Cuando sea necesario comunicar información a Recursos Humanos, Operaciones, HSEQ, Seguridad o áreas responsables de gestionar el puesto en la empresa contratante, la comunicación se limitará, como regla general, a la conclusión médico-laboral necesaria: APTO; APTO CONDICIONADO; APTO CON RESTRICCIONES; o NO APTO / NO CUMPLE, conforme a los criterios clínicos vigentes de SME y de la empresa contratante; así como restricciones funcionales, medidas preventivas, adecuaciones, temporalidad y fecha de reevaluación. Los diagnósticos específicos, antecedentes clínicos y resultados de estudios no se comunicarán rutinariamente a áreas administrativas u operativas, salvo consentimiento, obligación jurídica, emergencia médica u otra causa legal aplicable.',
    ],
  },
  {
    roman: 'VI',
    title: 'FINALIDADES SECUNDARIAS',
    paragraphs: [
      'SME no utilizará la información clínica ocupacional para publicidad, mercadotecnia o prospección comercial. Si se realiza análisis de gestión, indicadores epidemiológicos, dashboards, tendencias corporativas, investigación preventiva o mejora de programas de Salud Ocupacional, se utilizarán preferentemente datos disociados, agregados o anonimizados cuando la identificación individual no sea necesaria.',
    ],
  },
  {
    roman: 'VII',
    title: 'CONSENTIMIENTO PARA DATOS PERSONALES SENSIBLES',
    paragraphs: [
      'Cuando sea jurídicamente necesario, SME obtendrá el consentimiento expreso y por escrito de la persona titular para el tratamiento de sus datos personales sensibles mediante firma autógrafa, firma electrónica u otro mecanismo de autenticación legalmente válido. Lo anterior no impedirá el tratamiento sin consentimiento en los supuestos permitidos expresamente por la legislación aplicable.',
    ],
  },
  {
    roman: 'VIII',
    title: 'ENCARGADOS Y PRESTADORES DE SERVICIOS',
    paragraphs: [
      'SME podrá contratar proveedores especializados para servicios médicos, laboratorios, gabinete, plataformas tecnológicas, archivo, conservación documental u otros servicios necesarios. Cuando dichos proveedores traten datos por cuenta de SME, deberán actuar conforme a instrucciones documentadas y a obligaciones contractuales de confidencialidad, seguridad de la información y protección de datos.',
    ],
  },
  {
    roman: 'IX',
    title: 'TRANSFERENCIAS DE DATOS',
    paragraphs: [
      'SME podrá comunicar o transferir datos cuando sea necesario para cumplir las finalidades descritas y conforme a la legislación aplicable, incluyendo autoridades sanitarias, Instituto Mexicano del Seguro Social, autoridades laborales, judiciales o administrativas competentes, instituciones de salud, la empresa contratante en los términos de la sección V y otras personas físicas o morales cuando exista obligación o habilitación jurídica. Cuando sea viable, la transferencia se limitará a los datos estrictamente necesarios y se privilegiará la disociación.',
    ],
  },
  {
    roman: 'X',
    title: 'SEGURIDAD Y CONFIDENCIALIDAD',
    paragraphs: [
      'SME implementará y mantendrá medidas administrativas, físicas y técnicas destinadas a proteger los datos personales contra daño, pérdida, alteración, destrucción, uso, acceso o tratamiento no autorizado. Las medidas deberán atender el riesgo, la sensibilidad de la información y las consecuencias potenciales para las personas titulares. El personal que intervenga en el tratamiento estará sujeto a obligaciones de confidencialidad que subsistirán después de terminar su relación laboral, profesional o contractual.',
    ],
  },
  {
    roman: 'XI',
    title: 'CONSERVACIÓN DEL EXPEDIENTE',
    paragraphs: [
      'Los datos personales serán conservados durante el tiempo necesario para cumplir las finalidades que justificaron su tratamiento y durante los periodos previstos por las disposiciones aplicables. Para expedientes clínicos se observarán los periodos mínimos establecidos por la NOM-004-SSA3-2012 y cualquier plazo adicional que resulte aplicable por razones laborales, sanitarias, de seguridad social o de responsabilidad jurídica. Una vez concluidos los periodos correspondientes, la información será bloqueada, suprimida, destruida o anonimizada, según proceda.',
    ],
  },
  {
    roman: 'XII',
    title: 'DERECHOS ARCO',
    paragraphs: [
      `La persona titular podrá ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición respecto de sus datos personales, conforme a la legislación aplicable. Las solicitudes deberán presentarse ante ${SME_LEGAL_NAME_FULL} (SME), mediante correo electrónico a ${SME_ARCO_EMAIL} o comunicándose al teléfono ${SME_ARCO_PHONE}. SME atenderá las solicitudes dentro de los plazos legales aplicables y podrá requerir la información necesaria para acreditar identidad y localizar los datos objeto de la solicitud.`,
    ],
  },
  {
    roman: 'XIII',
    title: 'REVOCACIÓN Y LIMITACIÓN DEL USO',
    paragraphs: [
      'La persona titular podrá solicitar la revocación de su consentimiento o la limitación del uso o divulgación de sus datos mediante los mecanismos indicados en este Aviso. La revocación no tendrá efectos retroactivos y podrá no resultar procedente respecto de tratamientos que deban conservarse o continuar por obligación jurídica.',
    ],
  },
  {
    roman: 'XIV',
    title: 'VULNERACIONES DE SEGURIDAD',
    paragraphs: [
      'Cuando ocurra una vulneración de seguridad que afecte de forma significativa los derechos de las personas titulares, SME realizará las acciones de contención, análisis, corrección y comunicación que correspondan conforme a la legislación vigente y a sus procedimientos internos.',
    ],
  },
  {
    roman: 'XV',
    title: 'MODIFICACIONES AL AVISO',
    paragraphs: [
      `SME podrá modificar o actualizar este Aviso cuando existan cambios normativos, operativos, tecnológicos, contractuales o relacionados con las finalidades del tratamiento. Las versiones vigentes estarán disponibles en las instalaciones de Soluciones Médico Empresariales (SME) y en ${SME_WEBSITE}.`,
    ],
  },
  {
    roman: 'XVI',
    title: 'DECLARACIÓN DE VERACIDAD DE LA INFORMACIÓN PROPORCIONADA',
    paragraphs: [
      'La persona trabajadora o candidata manifiesta, bajo protesta de decir verdad, que la información proporcionada directamente al personal autorizado de Salud Ocupacional durante la entrevista médica, historia clínica, cuestionarios de salud, evaluaciones médico-laborales y procedimientos de vigilancia de la salud es, a su leal saber y entender, verdadera, completa y actualizada respecto de los aspectos que le hayan sido expresamente solicitados y que resulten pertinentes para la evaluación médico-laboral, prevención de riesgos y protección de su seguridad y la de terceras personas.',
      'La persona titular se compromete a informar al personal de Salud Ocupacional cambios relevantes en su condición de salud que, conforme a valoración médica, puedan afectar de manera significativa y directa:',
    ],
    bullets: [
      'La realización segura de las actividades esenciales de su puesto;',
      'El cumplimiento de restricciones o recomendaciones médicas previamente establecidas;',
      'Su exposición a factores de riesgo ocupacional;',
      'La seguridad de otras personas durante la ejecución del trabajo; o',
      'Las medidas de vigilancia de la salud que resulten necesarias.',
    ],
    closingParagraph:
      'Esta obligación deberá interpretarse según la naturaleza del puesto y los riesgos de exposición, respetando dignidad, privacidad, confidencialidad y no discriminación. La información clínica deberá proporcionarse al personal médico o de Salud Ocupacional autorizado; las áreas administrativas u operativas recibirán, como regla general, únicamente la conclusión funcional necesaria para gestionar el trabajo seguro.',
  },
  {
    roman: 'XVII',
    title: 'OBLIGACIONES RELACIONADAS CON SEGURIDAD Y SALUD EN EL TRABAJO',
    paragraphs: [
      'La persona trabajadora reconoce que la Ley Federal del Trabajo establece obligaciones relacionadas con el cumplimiento de las normas de trabajo, medidas de seguridad y salud, reconocimientos médicos previstos por las disposiciones aplicables y el Reglamento Interior de Trabajo, comunicación de enfermedades contagiosas en los supuestos legales y adopción de medidas preventivas para evitar accidentes o enfermedades:',
    ],
    numberedItems: [
      'Cumplir las disposiciones de las normas de trabajo que le sean aplicables.',
      'Observar el Reglamento Interior de Trabajo, las Normas Oficiales Mexicanas y las medidas de seguridad y salud indicadas.',
      'Someterse a los reconocimientos médicos previstos en el Reglamento Interior de Trabajo y demás normas vigentes aplicables.',
      'Informar, mediante los mecanismos confidenciales establecidos, las enfermedades contagiosas cuando exista obligación legal de hacerlo.',
      'Abstenerse de actos que puedan poner en peligro su seguridad, la de otras personas o las instalaciones.',
      'Adoptar medidas preventivas y seguir procedimientos indicados para evitar accidentes y enfermedades de trabajo.',
    ],
  },
  {
    roman: 'XVIII',
    title: 'OMISIÓN, OCULTAMIENTO O FALSEDAD DE INFORMACIÓN RELEVANTE',
    paragraphs: [
      'La omisión, ocultamiento o falsedad de información médica no producirá, por sí misma y de manera automática, la terminación de la relación laboral. Cada caso deberá analizarse individualmente a la luz de los hechos, la materialidad de la información, la intención, el riesgo generado y el supuesto jurídico aplicable.',
      'Cuando se identifique una posible omisión, ocultamiento, alteración o falsedad, se valorará conforme al ámbito de competencia de SME y de la empresa contratante, entre otros:',
    ],
    bullets: [
      'Si la información era conocida por la persona;',
      'Si fue expresamente solicitada;',
      'Su relación directa con las funciones y riesgos del puesto;',
      'La existencia o inexistencia de intención de engañar;',
      'El riesgo generado para la propia persona o terceros;',
      'Las medidas preventivas que pudieron haberse adoptado;',
      'El reglamento interior de trabajo y condiciones aplicables; y',
      'La legislación laboral vigente y el debido proceso interno.',
    ],
  },
  {
    roman: 'XIX',
    title: 'PROTECCIÓN CONTRA LA DISCRIMINACIÓN',
    paragraphs: [
      'La existencia de una enfermedad, discapacidad, condición crónica, tratamiento médico, antecedente quirúrgico u otra condición de salud no constituirá por sí misma motivo para negar el empleo, modificar injustificadamente las condiciones laborales o terminar la relación de trabajo. Las decisiones médico-laborales deberán sustentarse en la relación objetiva entre condición de salud, funciones esenciales del puesto, peligros y exposiciones, evaluación médica individual y posibilidad de implementar controles o ajustes compatibles con el trabajo.',
      'La información de salud no deberá utilizarse con fines discriminatorios. No se exigirá certificado médico de no embarazo como requisito de ingreso, permanencia o ascenso. Cuando exista una condición que requiera restricción o adaptación, Salud Ocupacional determinará las recomendaciones funcionales necesarias procurando no comunicar diagnósticos específicos a áreas administrativas u operativas salvo fundamento jurídico.',
    ],
  },
] as const

export const INFORMED_CONSENT_MANIFESTATION_TITLE =
  'CONSENTIMIENTO EXPRESO Y MANIFESTACIÓN DE LA PERSONA TITULAR'

export const INFORMED_CONSENT_MANIFESTATION_INTRO =
  `Declaro que he leído y comprendido el presente Consentimiento Informado y Aviso de Privacidad Integral de ${SME_LEGAL_NAME_FULL} (SME) y que conozco las características y finalidades de los procedimientos médicos y del tratamiento de mis datos personales y datos personales sensibles:`

export const INFORMED_CONSENT_MANIFESTATION_ITEMS = [
  'He tenido oportunidad de proporcionar al personal de Salud Ocupacional la información que conozco y que me ha sido expresamente solicitada para realizar mi evaluación médico-laboral.',
  'Manifiesto que, a mi leal saber y entender, la información proporcionada es verdadera, completa y actualizada.',
  'Me comprometo a comunicar oportunamente a Salud Ocupacional cualquier cambio relevante relacionado directamente con mi seguridad en el trabajo o con las restricciones y recomendaciones médico-laborales indicadas.',
  'Comprendo que mi información médica será tratada de manera confidencial y que una eventual omisión, ocultamiento o falsedad será analizada conforme a las circunstancias del caso y la legislación aplicable, sin consecuencias automáticas por el solo hecho de existir una condición de salud.',
  'Cuando legalmente resulte necesario, OTORGO EXPRESAMENTE MI CONSENTIMIENTO para la realización de los procedimientos médicos informados y para el tratamiento de mis datos personales sensibles relacionados con mi salud en los términos de este Aviso.',
] as const

export const INFORMED_CONSENT_LEGAL_NOTE =
  'Importante: la firma de este documento acredita la autorización para los procedimientos médicos informados, el consentimiento expreso cuando sea requerido y la recepción del Aviso de Privacidad Integral. No sustituye el análisis jurídico de los supuestos en los que la ley permita o exija tratamiento sin consentimiento.'
