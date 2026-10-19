# Auditoría cobertura PDF Sodexo REG-SO-01

Generado: 2026-10-19T14:41:33.104Z

- **PDF de prueba:** `/tmp/sodexo-audit-full.pdf`
- **Campos AcroForm:** 907
- **Rellenados tras fixture completo:** 469 (51.7%)
- **Vacíos:** 438

## Por sección (página PDF)

| Sección | Rellenados | Vacíos |
|---------|------------|--------|
| §1–3 Identificación / HO / consentimiento | 125 | 178 |
| §4–8 AHF / APP / inmun / gineco / vitales | 213 | 111 |
| §9 Examen físico | 121 | 149 |
| §10–12 Dx / reco / restricciones | 10 | 0 |

## Conclusión

- **Cobertura AcroForm:** ~51.7% con fixture rico + defaults de paridad (Niega/Normal, matriz nivel 1 sin dato, textos `Texto*` con guión).
- **Texto:** prácticamente todos los campos de texto reciben valor (exploración, dx, HO, identificación).
- **Casillas:** ~40% marcadas es techo estructural: pares Niega/Sí y Normal/Anormal dejan la mitad sin marcar; matriz 1–5+A solo una casilla por factor; firma del examinado vacía por diseño.
- **Siguiente trabajo:** comparación visual con `FORMATO EXAMEN MEDICO SODEXO.pdf` y ajustes finos por sección (sin tocar papeleta AMI).

Detalle JSON: `/tmp/sodexo-audit-report.json`
