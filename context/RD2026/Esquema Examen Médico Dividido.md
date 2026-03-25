# **Esquema de Captura: Examen Médico Empresarial (Dividido)**

Este esquema está diseñado para implementarse en dos módulos de software distintos, optimizando el flujo de trabajo en la clínica o empresa.

# **MÓDULO 1: CUESTIONARIO DEL PACIENTE (Autollenado)**

*Este módulo puede ser respondido panalisasor el candidato/paciente desde un portal web, app o tablet en sala de espera.*

## **1\. Datos Personales**

* **Nombre:** String  
* **Empresa:** String  
* **Fecha de Ingreso:** Date  
* **Lugar de Nacimiento:** String  
* **Fecha de Nacimiento:** Date  
* **Edad:** Number  
* **Nacionalidad:** String  
* **Sexo:** String (Opciones: Femenino, Masculino)  
* **Estado Civil:** String  
* **Teléfono:** String  
* **Dirección:** String  
* **Escolaridad:** String  
* **Puesto Solicitado:** String

## **2\. Historia Laboral**

* **Último Empleo 1:**  
  * Empresa: String  
  * Área/Puesto: String  
  * Antigüedad: String  
  * Factor de Riesgo: Array\<String\> (Ej. Ergonómico, Físico)  
* **Último Empleo 2:**  
  * Empresa: String  
  * Área/Puesto: String  
  * Antigüedad: String  
  * Factor de Riesgo: Array\<String\> (Ej. Ergonómico, Químico, Físico)  
* **Antecedentes de Accidentes Laborales / Enfermedades Profesionales:** Boolean  
  * Especificar: String

## **3\. Antecedentes Heredo-Familiares**

* **HAS (Hipertensión):** Boolean / String (Parentesco)  
* **Asma:** Boolean / String  
* **Epilepsia:** Boolean / String  
* **Cáncer:** Boolean / String  
* **Diabetes:** Boolean / String  
* **Renales:** Boolean / String  
* **Cardiopatía:** Boolean / String  
* **Mentales:** Boolean / String  
* **Otras:** String

## **4\. Antecedentes Personales No Patológicos y Toxicomanías**

* **Alcohol:** Boolean (Edad de Comienzo, Frecuencia, Suspendido, Tiempo)  
* **Tabaco:** Boolean (Edad de Comienzo, Frecuencia, Suspendido, Tiempo, Cigarros/Día)  
* **Drogas/Estimulantes:** Boolean (Último Consumo, Especificar)  
* **Ejercicio:** Boolean (Frecuencia/Tipo)  
* **Alimentación:** String  
* **Tatuajes:** Boolean  
* **Tx. Médico Actual:** Boolean (Especificar)  
* **Grupo y RH:** String

## **5\. Antecedentes Personales Patológicos (Checklist)**

*(Todos estos campos pueden ser Boolean para respuestas rápidas Sí/No)*

* Diabetes, HAS, Cáncer, Cardiopatías, Bronquitis, Neumonías, Tuberculosis, Exantemáticas, Psiquiátricas, Tifoidea, Colitis, Asma, Alergias, Parotiditis, Dermatitis, Várices, Hepatitis, Renales, Epilepsia, Vértigo, Desmayos, Gastritis, Fracturas, Cirugías, Transfusiones, Hernias, Hemorroides, Traumatismos, Pat. C. Vertebral, Ginecológicos, Enf. Trans. Sexual, Endocrinopatías, Migraña.  
* **Otras:** String

## **6\. Antecedentes Ginecológicos (Habilitar solo si Sexo \== Femenino)**

* **Menarca:** Number  
* **FUM:** Date  
* **I.V.S.:** Number  
* **Ritmo:** String  
* **Gesta, Aborto, Parto, Cesárea:** Number  
* **D.O.C.:** Date  
* **F.UP./F.U.C.:** String  
* **Exploración Mamaria:** String  
* **V.S.A.:** Boolean  
* **M.P.F.:** String

## **7\. Inmunizaciones (Reportadas por el paciente)**

* **Rubéola, Neumococo, Sarampión, Influenza, Toxoide Tetánico, Hepatitis B, Otras:** String / Boolean  
* **Próxima Dosis / Esquema Completo:** String

# **MÓDULO 2: EVALUACIÓN MÉDICA (Exclusivo Personal de Salud)**

*Este módulo requiere de instrumentos médicos y conocimiento clínico. Solo el médico (y en algunos casos enfermería para el punto 8 y 9\) debe llenarlo.*

## **8\. Somatometría / Signos Vitales**

* **TA (Tensión Arterial):** String  
* **F.C. (Frecuencia Cardíaca):** Number  
* **F.R. (Frecuencia Respiratoria):** Number  
* **T (Temperatura):** Number  
* **Peso (Kg):** Number  
* **Talla (m):** Number  
* **IMC:** Number *(Sugerencia: Autocalcular en el código Peso / Talla^2)*  
* **Complexión:** String

## **9\. Agudeza Visual**

* **Visión Lejana / Cercana (O.D. y O.I.):** String  
* **Corregida Lejana / Cercana (O.D. y O.I.):** String  
* **Reflejos:** String  
* **Test Ishihara / Campimetría:** String

## **10\. Exploración Física General**

*(Textos descriptivos String con valor por defecto "Sin datos patológicos" o "Normal")*

* Neurológico, Cabeza, Piel y Faneras, Oídos, Ojos, Boca, Nariz, Faringe, Cuello, Tórax, Corazón, Campos Pulmonares, Abdomen, Genitourinario, Columna Vertebral.  
* Test de Adam (Escoliosis).  
* Ms Superiores / Ms Inferiores (Fuerza Muscular Daniels).  
* Circulación Venosa, Arco de Movilidad, Tono Muscular, Coordinación.  
* Test de Romberg.  
* Presencia de Quiste Sinovial.  
* Especificaciones adicionales.

## **11\. Pruebas Específicas**

*(Todas String o Enum Positivo/Negativo)*

* Prueba de Finkelstein, Signo de Tinel, Prueba de Phalen, Prueba de Lasegue, Signo de Bragard.

## **12\. Impresión Diagnóstica y Aptitud (Resolución final)**

* **Estado Nutricional:** String  
* **Salud Bucal:** String  
* **Agudeza Visual:** String  
* **Presión Arterial:** String  
* **Impresión Diagnóstica General:** String  
* **Aptitud:** Boolean (Cumple / No Cumple)  
* **Recomendaciones:** String  
* **Médico que Realizó (Nombre y Cédula):** String (Autorrellenar con sesión activa)  
* **Médico que Revisó (Nombre y Cédula):** String
