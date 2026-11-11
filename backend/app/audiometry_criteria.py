"""
Criterio audiométrico SME derivado (determinístico) para enriquecer prediagnóstico.

Fuentes normativas del proyecto (no inventar umbrales aquí):
- DEC-20260825-03: combinar patrón por frecuencias y PTA/criterio AMI
- DEC-20260825-04 / BR-20260825-05: normalidad AMI ≤ 25 dB HL
- DEC-20260825-05 / BR-20260825-06: PTA3 = (500+1000+2000)/3, PTA fuente aparte
- BR-20260825-04: huecos AMI 41–44, 56–59, 71–74, 91–94 → no concluyente
- SPEC-FEATURE-20260825-02 §4.3: clasificación combina patrón + PTA/criterio AMI
- SPEC_ARCH-20260518-15 §7.4: normal solo si ≤25 dB sin patrón patológico claro
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

AMI_NORMALIDAD_DB = 25
PTA3_FREQS = (500, 1000, 2000)
FRECUENCIAS_GRAVES = (250, 500, 1000)
FRECUENCIAS_AGUDAS = (2000, 3000, 4000, 6000, 8000)
AMI_HUECOS_DB: Tuple[Tuple[int, int], ...] = ((41, 44), (56, 59), (71, 74), (91, 94))


def _coerce_db(v: Any) -> Optional[int]:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)) and math.isfinite(v):
        return int(round(v))
    if isinstance(v, str) and v.strip():
        try:
            n = float(v.strip())
            if math.isfinite(n):
                return int(round(n))
        except ValueError:
            return None
    return None


def _read_va(ear: Any) -> Dict[int, int]:
    if not isinstance(ear, dict):
        return {}
    va_raw = ear.get("va")
    if va_raw is None:
        va_raw = ear.get("via_aerea")
    if not isinstance(va_raw, dict):
        va_raw = {}
        for k, v in ear.items():
            if str(k).strip().isdigit():
                c = _coerce_db(v)
                if c is not None:
                    va_raw[str(k).strip()] = c
    out: Dict[int, int] = {}
    if isinstance(va_raw, dict):
        for k, v in va_raw.items():
            c = _coerce_db(v)
            if c is None:
                continue
            try:
                freq = int(str(k).strip())
            except ValueError:
                continue
            out[freq] = c
    return out


def _calcular_pta3(va: Dict[int, int]) -> Tuple[Optional[float], bool]:
    vals = [_coerce_db(va.get(f)) for f in PTA3_FREQS]
    if any(v is None for v in vals):
        return None, False
    promedio = round(sum(vals) / 3.0, 1)  # type: ignore[arg-type]
    return promedio, True


def _umbral_en_hueco_ami(db: int) -> bool:
    return any(lo <= db <= hi for lo, hi in AMI_HUECOS_DB)


def _clasificar_patron(va: Dict[int, int]) -> str:
    graves = [_coerce_db(va.get(f)) for f in FRECUENCIAS_GRAVES]
    agudas = [_coerce_db(va.get(f)) for f in FRECUENCIAS_AGUDAS]
    graves_vals = [v for v in graves if v is not None]
    agudas_vals = [v for v in agudas if v is not None]
    if not graves_vals or not agudas_vals:
        return "NO_CONCLUYENTE"
    peor_graves = max(graves_vals)
    peor_agudas = max(agudas_vals)
    graves_alt = peor_graves > AMI_NORMALIDAD_DB
    agudas_alt = peor_agudas > AMI_NORMALIDAD_DB
    if not graves_alt and not agudas_alt:
        return "NORMAL"
    if graves_alt and agudas_alt:
        return "MIXTA"
    if graves_alt:
        return "GRAVES"
    return "AGUDAS"


def resolver_criterio_ami_combinado(
    pta_promedio: Optional[float],
    pta_completo: bool,
    patron: str,
    umbrales_va: List[int],
) -> str:
    if any(_umbral_en_hueco_ami(db) for db in umbrales_va):
        return "NO_CONCLUYENTE"

    patron_patologico = patron in ("GRAVES", "AGUDAS", "MIXTA")

    if not pta_completo or pta_promedio is None:
        if patron_patologico:
            return "ALTERADO"
        if patron == "NO_CONCLUYENTE":
            if umbrales_va and max(umbrales_va) > AMI_NORMALIDAD_DB:
                return "ALTERADO"
            return "NO_CONCLUYENTE"
        return "NO_CONCLUYENTE"

    pta_alterado = pta_promedio > AMI_NORMALIDAD_DB

    if patron == "NO_CONCLUYENTE":
        if pta_alterado:
            return "ALTERADO"
        if umbrales_va and max(umbrales_va) > AMI_NORMALIDAD_DB:
            return "ALTERADO"
        return "NO_CONCLUYENTE"

    if patron_patologico or pta_alterado:
        return "ALTERADO"
    return "NORMAL"


def resolve_audiometria_ear(
    ear_raw: Any,
) -> Dict[str, Any]:
    va = _read_va(ear_raw)
    pta, pta_ok = _calcular_pta3(va)
    patron = _clasificar_patron(va)
    umbrales = list(va.values())
    criterio = resolver_criterio_ami_combinado(pta, pta_ok, patron, umbrales)
    pta_fuente = None
    if isinstance(ear_raw, dict):
        pta_fuente = _coerce_db(ear_raw.get("pta_visible") or ear_raw.get("pta"))
    return {
        "pta3_calculado_db": pta,
        "pta3_completo": pta_ok,
        "pta_fuente_documento_db": pta_fuente,
        "patron_ami": patron,
        "criterio_ami": criterio,
        "peor_umbral_va_db": max(umbrales) if umbrales else None,
        "umbrales_va_db": {str(k): v for k, v in sorted(va.items())},
    }


def enrich_audiometry_extracted_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Copia el payload y agrega `interpretacion_derivada_sme` para el prompt clínico."""
    if not isinstance(data, dict):
        return data
    enriched = dict(data)
    od = resolve_audiometria_ear(data.get("oido_derecho"))
    oi = resolve_audiometria_ear(data.get("oido_izquierdo"))
    enriched["interpretacion_derivada_sme"] = {
        "fuentes_reglas": [
            "DEC-20260825-03",
            "DEC-20260825-04",
            "DEC-20260825-05",
            "BR-20260825-04",
            "BR-20260825-05",
            "BR-20260825-06",
            "SPEC-FEATURE-20260825-02 §4.3",
            "SPEC_ARCH-20260518-15 §7.4",
        ],
        "oido_derecho": od,
        "oido_izquierdo": oi,
        "nota": (
            "Criterio AMI combina PTA3 (500/1000/2000) y patrón por grupos de frecuencia; "
            "no usar PTA3 ≤25 dB aislado como NORMAL si el patrón indica compromiso >25 dB."
        ),
    }
    return enriched
