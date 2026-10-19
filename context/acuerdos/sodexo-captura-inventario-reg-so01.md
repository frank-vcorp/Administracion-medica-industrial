# Inventario captura REG-SO-01 — AMI vs Extensión Sodexo

**Regla:** la papeleta AMI **no se modifica**. Todo lo exclusivo del formato Sodexo se captura en **Extensión Sodexo** (`variant_extensions.SODEXO`). El PDF solo **proyecta**; no rellena con defaults inventados (Niega/Normal masivo, guiones, nivel 1 automático).

Referencias: `SodexoExtensionSchema`, `SodexoExtension.tsx`, `sodexo-examen-medico-pdf.ts`, `sodexo-pdf-*.ts`.

---

## §1 Identificación y datos generales (PDF p.1)

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| Nombre, edad, sexo, domicilio (calle/colonia/ciudad), escolaridad, estado civil | **AMI** — trabajador + datos personales | Proyección |
| Fecha atención, tipo examen (pre/periódica/retiro/reingreso) | **AMI** + **Ext.** `tipo_examen` | Proyección |
| Lugar nacimiento, tel. casa/móvil, num. ext/int, estado, tiempo radicar, profesión, lee y escribe | **Extensión Sodexo** | UI + schema ✅ (P0) |
| Contacto / tel. emergencia | **Extensión Sodexo** | UI ✅ |
| Funciones principales (6 casillas) | **Extensión Sodexo** `funciones_principales` | UI ✅ (P0) |
| EPP (uso + equipo) | **Extensión Sodexo** | UI ✅ |

---

## §2–3 Historia ocupacional y consentimiento

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| Narrativa HO (fallback) | **AMI** — `historiaOcupacional` / empresa actual | Proyección parcial |
| Tabla 4 filas (empresa, ocupación, tiempo, agentes) | **Extensión Sodexo** `historia_ocupacional_filas` | UI ✅ (P0) |
| Matriz riesgos 36× (1–5/A) | **Extensión Sodexo** `matriz_factores` (+ texto obs.) | UI rejilla ✅ (P0); parse texto legacy en PDF |
| Declaración bajo protesta (nombre) | **Extensión Sodexo** | UI ✅ |
| Firma examinado | — | Vacío por diseño |
| Consentimiento / casillas HO adicionales | **Extensión Sodexo** `consentimiento_ho` | UI + PDF ✅ |

---

## §4 Heredo-familiares

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| Filas Niega/Sí + parentesco | **AMI** — `heredo_familiares` / snapshot examen | Proyección (`fillHeredofamiliar`) |
| TBC / digestivos / reuma (claves proxy) | Proyección con claves `_tbc`, `_digestivos`, `_reuma` | **Revisar** alineación AMI ↔ filas Sodexo (no inventar Niega) |

---

## §5 Antecedentes personales patológicos

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| ~26 filas con `amiKey` en `sodexo-pdf-patologicos.ts` | **AMI** — `patologicos` (Antecedentes) | Proyección ✅ |
| Claves extra (`cancer`, `tifoidea`, …) | **AMI** — mismo schema; texto en aclaración | Proyección parcial |
| Ajuste impreso §5 (extras) | **Extensión Sodexo** `patologicos_sodexo` | UI + PDF ✅ (filas con `amiKey` en mapa) |
| Aclaración §5 | **Ext.** `aclaracion_historia_personal` + APP AMI | Proyección |

---

## §6 Inmunizaciones

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| Vacunas básicas Niega/Sí | **AMI** — Módulo 1 `m1_vac_*` | Proyección |
| Fechas / IMSS / SSA por fila | **AMI** — detalle en módulo 1 si existe | Proyección parcial (`inmunizaciones-rows`) |
| Complementarias (COVID, etc.) | **AMI** módulo 1 + **Ext.** `inmunizaciones_complementarias` | UI + PDF ✅ |

---

## §7 Gineco-obstétrica

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| FUM, gesta, MPF, citología (texto) | **AMI** — Módulo 1 + `ginecologicos` | Proyección |
| Rejillas tóxicos / medicamentos / dismenorrea | **AMI** + **Ext.** `gineco_sodexo` | UI + PDF ✅ |

---

## §8 Estilos de vida (tabaco, alcohol, drogas)

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| Niega/Sí e intensidad tabaco/alcohol/drogas | **AMI** — `no_patologicos` / APNP | Proyección (`estilos-vida`, `fillApnpTabaquismo`) |
| Años hábito / exfumador (casillas finas) | **AMI** APNP + **Ext.** `estilos_vida_sodexo` | UI + PDF ✅ |

---

## §9 Examen físico

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| Texto por sistema (neurológico, cabeza, …) | **AMI** — exploración física | Proyección ✅ |
| Somatometría, TA, FC, FR, temperatura | **AMI** | Proyección ✅ |
| Agudeza visual (texto) | **AMI** | Proyección ✅ |
| Encabezado (estado general/mental, mano dominante) | **Extensión Sodexo** `examen_encabezado` | UI ✅ (P0) |
| Casillas Normal/Anormal por región | **AMI** exploración + **Ext.** futuro | Parcial; sin default masivo |
| Casillas visión (checkbox) | **Extensión Sodexo** `visiometria_casillas` | UI + PDF ✅ |
| Campos `Cuál` / `Cuál_2`… | **Extensión Sodexo** `examen_anormal_cual` | UI + PDF ✅ |

---

## §10–12 Diagnóstico, restricciones, observaciones

| Bloque PDF | Fuente | Estado |
|------------|--------|--------|
| Impresión diagnóstica, restricciones | **AMI** — dictamen / examen | Proyección ✅ |
| Observaciones Sodexo, recomendaciones, aptitud, estudios | **AMI** consolidado | Proyección ✅ |
| Encabezado “SALUD OCUPACIONAL…” | Estático / plantilla | Opcional texto fijo **P3** |
| Firma médico | **AMI** | Proyección imagen ✅ |

---

## Capa PDF — quitar defaults (hecho en P0)

| Módulo | Antes | Ahora |
|--------|--------|--------|
| `sodexo-pdf-global-defaults` | Niega/Normal geométrico | **No se invoca** en render |
| `sodexo-pdf-text-parity` | Guiones, “NO ESPECIFICADO” | **No se invoca** |
| `sodexo-pdf-matriz` | Nivel 1 si vacío | **Solo** `matriz_factores` / texto |
| `sodexo-pdf-patologicos` | `applySodexoPatologicosDefaultNiega` | **Eliminado** del pipeline |
| `sodexo-pdf-gineco` / `estilos-vida` | Niega por defecto | Solo si hay dato AMI |
| `sodexo-pdf-visiometria-checks` / `examen-header` | Hardcode | Reemplazado por **Ext.** `examen_encabezado` |

---

## Prioridad de implementación

| Prioridad | Entregable |
|-----------|------------|
| **P0** | ✅ Inventario + schema/UI identificación, funciones, matriz rejilla, HO tabla, encabezado §9 + PDF sin defaults |
| **P1** | ✅ Consentimiento HO, visión checkbox, inmun complementarias, campos `Cuál*` anormal |
| **P2** | ✅ Rejilla gineco Sodexo, ajuste patológicos extras, estilos vida casillas finas |
| **P3** | ✅ Validación al cerrar captura + gate 409 al descargar PDF Sodexo sin extensión completa |

---

## Cómo verificar

```bash
cd frontend && npm test -- --run sodexo
npx tsx scripts/sodexo-pdf-audit.ts
```

Tras P0, la cobertura AcroForm **baja** respecto al modo “paridad con guiones”; eso es esperado: solo cuenta **dato capturado**.
