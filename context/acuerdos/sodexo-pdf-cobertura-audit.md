# Auditoría cobertura PDF Sodexo REG-SO-01

Generado: 2026-10-27T00:40:01.345Z

- **PDF de prueba:** `/tmp/sodexo-audit-full.pdf`
- **Campos AcroForm:** 907
- **Rellenados tras fixture completo:** 446 (49.2%)
- **Vacíos:** 461

## Por sección (página PDF)

| Sección | Rellenados | Vacíos |
|---------|------------|--------|
| §1–3 Identificación / HO / consentimiento | 108 | 195 |
| §4–8 AHF / APP / inmun / gineco / vitales | 209 | 115 |
| §9 Examen físico | 119 | 151 |
| §10–12 Dx / reco / restricciones | 10 | 0 |

## Conclusión

- **Cobertura AcroForm:** ~49.2% con fixture rico + defaults de paridad (Niega/Normal, matriz nivel 1 sin dato, textos `Texto*` con guión).
- **Texto:** prácticamente todos los campos de texto reciben valor (exploración, dx, HO, identificación).
- **Casillas:** ~40% marcadas es techo estructural: pares Niega/Sí y Normal/Anormal dejan la mitad sin marcar; matriz 1–5+A solo una casilla por factor; firma del examinado vacía por diseño.
- **Siguiente trabajo:** comparación visual con `FORMATO EXAMEN MEDICO SODEXO.pdf` y ajustes finos por sección (sin tocar papeleta AMI).

Detalle JSON: `/tmp/sodexo-audit-report.json`
