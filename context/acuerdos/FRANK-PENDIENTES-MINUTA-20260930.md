# Pendientes Frank — minuta / junta 23-Sep (seguimiento)

**Actualizado:** 2026-09-30

| # | Ítem (hoja 23-Sep) | Estado | Notas |
|---|-------------------|--------|--------|
| 1 | Nombre de perfil (razón social / género / CTM / nombre) | ✅ | Commit `7792739` — constructor en ficha empresa |
| 2 | Perfil sin guardar sin correos de envío | ✅ | Server + UI |
| 3 | Al agendar: WA/correo + preparación por prueba + leyenda del pase | 🟡 | Falta trípticos Leticia + cableado envío (SMTP/WA) |
| 4 | Reporte recomendaciones **paciente** y **empleador** | 🔴 | Verificar con Leticia vs `recomendaciones_clinicas` / PDFs actuales |
| 5 | Consentimiento (no “check-in” en etiqueta paciente/recepción) | ✅ | R-09 + UI «Doy mi consentimiento» en citas/QR (`d0a7f51`) |
| 6 | Campimetría: número inválido en rojo | ✅ | Ishihara: normales por defecto + celda/banner rojo si alterado (`eb3d913`) |
| 7 | Envío parcial examen médico (lab) | ✅ | DEC-20260930-01 |
| 8 | Examen médico: prediagnóstico al cierre (Impresión), workspace amplio | ✅ | `papeletaLayout` + panel IA solo en pestaña Impresión (`PapeletaWorkspace` 2 cols); menú lateral estudios; header evento compacto |
| 9 | Excel encuestas + dashboard gráficas | ✅ | #15 — satisfaction export + dashboard |
| 10 | Área + tiempo en ficha / notificación | ✅ | Tiempo en sede en header evento/recepción (#17); área + antigüedad en identificación (header papeleta, campimetría, bloque PDF común) |
| 11 | Botón reporte final junto a WhatsApp | ✅ | #13 |
| — | Validación nombre paciente ↔ PDF al subir | ✅ | Bloqueo si no match |
| — | Somatometría / signos fuera del PDF en diagnóstico | ✅ | Pestañas Somatometría y Signos vitales visibles en examen médico (`ExamenMedicoEstudio` + menú lateral papeleta; `07720ce`, `c6137ba`) — no solo en PDF |
| — | Usuarios / roles minuta #17 | ⏸️ | Diferido (R-04) |
| — | PTA audiometría (Dra. Erika) | 👤 Clínica | Panel PTA3 en código |
| — | SendGrid + Baileys en Configuración | 🔴 | Solo SMTP por env |
| — | R-22 informe mensual (Word) | 🔴 | Sin spec |

**Leyenda:** ✅ hecho · 🟡 parcial / contenido externo · 🔴 abierto · 👤 depende de tercero · ⏸️ diferido
