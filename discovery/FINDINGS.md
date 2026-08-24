# Findings

## FND-20260819-01 — Impresión y Aptitud presenta evidencia consolidada sin paneles por prueba

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** Captura de pantalla de Frank, 2026-08-19. La pantalla muestra resumen ejecutivo y aptitud, pero no tarjetas de resultado/dictamen/descargable por prueba.
- **Impacto:** El médico no puede revisar de forma explícita el dictamen individual de Examen Médico, Audiometría, Espirometría u otras pruebas antes de elegir la aptitud consolidada.
- **Artefactos afectados:** Impresión y Aptitud; reporte integrado; descargables; ZIP final.
- **Relación:** DEC-20260819-01, BR-20260819-01, FLOW-20260819-01.

## FND-20260819-02 — Impresión y Aptitud está anidada bajo Examen Médico aunque el perfil puede no incluirlo

- **Estado:** candidate
- **Severidad:** P1
- **Evidencia:** El administrador configura perfiles mediante checkboxes de pruebas sin requisito visible de Examen Médico (`MedicalProfilesManager.tsx:666-695`). La vista actual ubica Impresión y Aptitud dentro de Examen Médico.
- **Impacto:** Una atención solo con Audiometría, Espirometría u otras pruebas podría no tener una ubicación coherente para mostrar resultados individuales, descargables y un posible consolidado.
- **Artefactos afectados:** Navegación de atención, Resultados por prueba, Dictamen integrado, descargables y ZIP final.
- **Relación:** DEC-20260819-01, OQ-20260819-04.

## FND-20260820-01 — Calibración conecta solo prompts, no gobierna el pipeline completo de Events

- **Estado:** confirmed
- **Severidad:** P0
- **Evidencia:** Auditoría de código 2026-08-20. Events recibe `aiCalibration` para prompts/proveedor, pero decide el tipo por heurística hardcodeada (`frontend/src/lib/study-ai.ts`) y no respeta `aiCalibration.enabled`. `fieldDefinitions` no tiene consumidores runtime en backend.
- **Impacto:** Lo configurado en Calibración puede no coincidir con la extracción real, el routing XML, la validación mínima o el comportamiento visible de Events.
- **Artefactos afectados:** Calibración IA, carga de EventTest, pipeline V2, XML Audiometría, prediagnóstico.
- **Relación:** DEC-20260820-01, BR-20260820-01.

## FND-20260820-02 — El modo de prueba de Calibración no reproduce la presentación de Events

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** `CalibrationTestResults.tsx` presenta JSON; `PresentationSchemaPanel.tsx` es visor de solo lectura. Events usa `ClinicalExtractionRenderer` y, al no existir un schema persistido editable, cae en schemas hardcodeados de Audiometría/Espirometría.
- **Impacto:** El usuario puede aprobar una extracción en Calibración sin verificar cómo la verá el médico en la papeleta real.
- **Artefactos afectados:** Tabs Pruebas/Presentación de Calibración, renderer de Events.
- **Relación:** DEC-20260820-01, BR-20260820-01.

## FND-20260820-03 — Versionado incompleto y representación histórica mutable

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** Cambios de prompt, proveedor y tipo canónico se guardan por la acción V1 sin incrementar versión. Los snapshots de Events no congelan el schema de presentación usado y se renderizan con la calibración vigente actual.
- **Impacto:** Un resultado histórico puede cambiar de apariencia al editar Calibración y la versión reportada puede no representar el prompt/configuración efectivamente usada.
- **Artefactos afectados:** Historial de calibración, StudyExtractionSnapshot, trazabilidad clínica y auditoría.
- **Relación:** DEC-20260820-01, BR-20260820-01.

## FND-20260820-04 — El catálogo AMI requiere calibración generalizada por familias, paneles y analitos, no configuración manual desde cero por prueba

- **Estado:** candidate
- **Severidad:** P1
- **Evidencia:** `Nombres de pruebas en perfiles.xlsx` contiene aproximadamente 130 entradas agrupadas en Laboratorio, Generales, Imagen y Ambulancia. `laboratorio/CATÁLOGO DE SERVICIOS DE LAB SME.xlsx` contiene aproximadamente 174 estudios de laboratorio con tipo de muestra, tiempo de entrega, laboratorio procesador, indicaciones y observaciones.
- **Impacto:** Un editor que obligue a definir manualmente campos, prompts, fórmulas y presentación para cada entrada sería costoso, inconsistente y difícil de mantener.
- **Propuesta funcional:** contrato general reutilizable + plantillas por familia + catálogo de paneles/analitos de laboratorio + ajustes específicos solo para pruebas complejas (Audiometría, Espirometría, Examen Médico y algunas pruebas de imagen/laboratorio).
- **Relación:** DEC-20260820-01, BR-20260820-01, OQ-20260820-01.

## FND-20260820-05 — Audiometría y Espirometría requieren cierre nocturno con evidencia real

- **Estado:** candidate
- **Severidad:** P1
- **Evidencia:** Frank solicita dejar listas ambas pruebas durante una sesión nocturna, con resultados útiles para médicos y alineados con la documentación AMI.
- **Contrato funcional documentado:** Audiometría debe entregar umbrales OD/OI por frecuencia canónica, calidad/completitud y campos fuente opcionales del formato; Espirometría debe entregar identificación, condiciones, tabla exhaustiva M1/M2/M3/%REF/REF/LLN, FEV1/FVC/ratio, calidad y repetibilidad cuando estén visibles.
- **Criterio clínico:** la IA sólo produce prelectura asistida y trazable; no emite diagnóstico final ni aptitud. Los mínimos faltantes deben producir `AI_NON_CONCLUSIVE` con limitaciones visibles.
- **Riesgo:** “Bien calibrado” no puede confirmarse sólo con tests unitarios; requiere ejecutar casos reales AMI, revisar snapshots y aceptación funcional de los valores visibles.
- **Relación:** DEC-20260820-01, DEC-20260820-02, SPEC_ARCH-20260513-01, SPEC_ARCH-20260516-07, SPEC_ARCH-20260516-12, FIX-20260812-20.

## FND-20260821-02 — Existe PDF real de Espirometría fuera de la carpeta revisada

- **Estado:** confirmed
- **Severidad:** P1 → resuelto para DG-1
- **Evidencia:** `context/RD2026/ESPIROMETRIA.pdf` contiene un informe Sibelmed W20s real con paciente, condiciones, tabla M1/M2/M3/%REF/REF/LLN, repetibilidad ATS/ERS y calidad A.
- **Impacto:** La conclusión previa “AMI sólo entrega PNG” era incompleta por limitar la búsqueda a `context/datos AMI/informacion para revision/`. La Espirometría sí puede validarse contra PDF real; debe repetirse el fixture y la evidencia sin inventar ni usar el PNG como fuente principal.
- **Supersede:** DG-1 del `LOTE-20260820-01` sólo en lo relativo a disponibilidad del PDF; DG-3 (XLSX sin hoja espirometría) permanece abierto.
- **Siguiente paso:** validar extracción real sobre este PDF y comparar las 9+ filas/columnas contra la fuente; mantener la calibración sin publicar hasta QA.

## FND-20260821-03 — E2E real de Espirometría extrae datos pero no activa Minimax ni prediagnóstico

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** Playwright sobre el expediente `8af728bf-f572-47c3-94b7-31aa9916a4b8`, usando `context/RD2026/ESPIROMETRIA.pdf`. La extracción real terminó y mostró referencia, paciente, condiciones, 10 filas y M1/M2/M3/%REF; la UI reportó “Extrayendo datos con Gemini”, no MiniMax. El prediagnóstico terminó `AI_NON_CONCLUSIVE` con “Parámetros mínimos faltantes: fev1, fvc”, aunque el snapshot visual contiene filas `FEV1` y `FVC`.
- **Hallazgo:** el expediente consume la configuración legacy/no publicada y el contrato runtime de criterios no está mapeando las claves extractivas (`fev1_l`/`fvc_l` o `parametros[]`) a los mínimos clínicos `fev1`/`fvc`.
- **Impacto:** la extracción documental funciona, pero no se prueba MiniMax ni se genera prediagnóstico clínico para Espirometría; publicar V3 sin corregir esta paridad produciría una experiencia incompleta.
- **Relación:** DEC-20260820-01/03/04, FND-20260820-05, SPEC_ARCH-20260516-12, FIX-20260812-20.
- **Siguiente paso:** DEBY/INTEGRA deben aislar provider efectivo y corregir el mapeo de criterios; después repetir E2E en entorno de prueba antes de publicar V3.

## FND-20260824-01 — El expediente de prueba usado no corresponde al PDF cargado

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** El expediente `8af728bf-f572-47c3-94b7-31aa9916a4b8` pertenece a Olvera/Jorge, mientras `context/RD2026/ESPIROMETRIA.pdf` corresponde a Peña Patricia Marbella. El E2E técnico cargó ese PDF en el expediente de Olvera.
- **Impacto:** La prueba técnica de MiniMax es válida como smoke de pipeline, pero el resultado no debe considerarse clínico ni permanecer asociado a ese expediente.
- **Acción requerida:** retirar/limpiar el archivo y análisis de prueba del expediente, con autorización explícita por tratarse de una eliminación de datos de producción; repetir la validación sólo con un documento cuyo paciente corresponda al expediente o en entorno de prueba.

## FND-20260824-02 — La UI muestra el error técnico crudo ante tipo de estudio incorrecto

- **Estado:** confirmed
- **Severidad:** P1 UX/operativa
- **Evidencia:** Al cargar `ESPIROMETRIA.pdf` dentro de `AUDIOMETRIA`, la pantalla muestra “Respuesta de M3 no es JSON válido” y el contenido del rechazo del modelo, aunque el sistema sí detectó el conflicto de modalidad.
- **Impacto:** El usuario no recibe una instrucción accionable y se expone detalle técnico/prompt del proveedor.
- **Acción:** clasificar el error como `STUDY_TYPE_MISMATCH` y mostrar estudio seleccionado, tipo detectado y acción para corregir; conservar detalle sólo en auditoría segura.
- **Relación:** DEC-20260824-01, FND-20260824-01, FND-20260821-03.
