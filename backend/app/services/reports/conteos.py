"""
IMPL-20260630-03: Conteos y agregados del proyecto para reportes masivos.
ARCH-20260623-01: Modulo de Reportes Masivos.

Migracion de frontend/src/lib/demo/demo-conteos.ts a Python.
Opera sobre un payload "project snapshot" (dict) producido por massive_report.py
a partir de Prisma. Esto desacopla la logica del ORM para testearla en aislamiento.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


def _has_value(v: Any) -> bool:
    """Considera vacio: None, '', 'N/A' (cualquier case)."""
    if v is None:
        return False
    if isinstance(v, str) and v.strip().upper() in ("", "N/A", "NA"):
        return False
    return True


def _parse_edad(edad: Any) -> Optional[int]:
    """Convierte '28 A' / '45 años' / int a entero. None si no parsea."""
    if edad is None:
        return None
    if isinstance(edad, (int, float)):
        return int(edad)
    if isinstance(edad, str):
        import re
        m = re.search(r"(\d+)", edad)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                return None
    return None


def calcular_conteos(project: Dict[str, Any]) -> Dict[str, int]:
    """
    Calcula conteos de preview (total, completos, parciales, sinEstudios).
    Equivalente a calcularConteos() del demo frontend.
    """
    trabajadores = project.get("trabajadores", [])
    total = len(trabajadores)
    completos = 0
    sin_estudios = 0

    for w in trabajadores:
        # Un trabajador se considera "sin estudios" si todos los estudios criticos
        # en el concentrado son N/A o null.
        campos_criticos = [
            ("campimetria", "agudezaVisual"),
            ("audiometria", "dx"),
            ("espirometria", "patron"),
            ("rxColumna", "impresion"),
            ("rxTorax", "impresion"),
            ("ecg", "impresion"),
        ]
        tiene_alguno = False
        tiene_todos = True
        for grp, key in campos_criticos:
            v = (w.get(grp) or {}).get(key)
            if _has_value(v):
                tiene_alguno = True
            else:
                tiene_todos = False
        if not tiene_alguno:
            sin_estudios += 1
        elif tiene_todos:
            completos += 1
        # Si tiene alguno pero no todos -> parcial (no se cuenta en completos/sin_estudios)

    return {
        "total": total,
        "completos": completos,
        "parciales": total - completos - sin_estudios,
        "sinEstudios": sin_estudios,
    }


def calcular_distribuciones(project: Dict[str, Any]) -> Dict[str, int]:
    """Distribucion por edad y sexo."""
    edad18a30 = 0
    edad31a45 = 0
    edad46mas = 0
    masculino = 0
    femenino = 0
    for w in project.get("trabajadores", []):
        lab = w.get("laboratorio") or {}
        edad = _parse_edad(lab.get("edad") or w.get("edad"))
        if edad is not None:
            if edad <= 30:
                edad18a30 += 1
            elif edad <= 45:
                edad31a45 += 1
            else:
                edad46mas += 1
        sexo = (w.get("sexo") or "").upper()
        if sexo.startswith("M"):
            masculino += 1
        elif sexo.startswith("F"):
            femenino += 1
    return {
        "edad18a30": edad18a30,
        "edad31a45": edad31a45,
        "edad46mas": edad46mas,
        "masculino": masculino,
        "femenino": femenino,
    }


def calcular_hbc_por_rango(project: Dict[str, Any]) -> Dict[str, int]:
    """Audiometrias: Normal <10%, Alto 10-19%, Muy Alto >=20%."""
    normal = alto = muy_alto = 0
    for w in project.get("trabajadores", []):
        h = (w.get("audiometria") or {}).get("hbc")
        if h is None:
            continue
        try:
            hf = float(h)
        except (TypeError, ValueError):
            continue
        if hf < 10:
            normal += 1
        elif hf < 20:
            alto += 1
        else:
            muy_alto += 1
    return {"normal": normal, "alto": alto, "muyAlto": muy_alto}


def calcular_trauma_acustico_por_area(project: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Conteo de trauma acustico por area."""
    mapa: Dict[str, int] = {}
    for w in project.get("trabajadores", []):
        dx = ((w.get("audiometria") or {}).get("dx") or "").upper()
        es_ta = any(token in dx for token in ("TA", "TRAUMA", "HIPOACUSIA"))
        if not es_ta:
            continue
        area = w.get("area") or "SIN AREA"
        mapa[area] = mapa.get(area, 0) + 1
    return [{"area": a, "conteo": c} for a, c in sorted(mapa.items())]


def _clasificar_patron_espirometrico(raw: Any) -> str:
    """Normaliza descripciones extensas a categorias concisas para tablas/graficas."""
    if not _has_value(raw):
        return "N/A"
    clean = str(raw).strip()
    up = clean.upper()
    if len(clean) <= 32 and "IA GENERADA" not in up:
        return clean
    if "MIXTO" in up:
        return "PATRÓN MIXTO"
    if "RESTRICTIV" in up:
        return "PATRÓN RESTRICTIVO"
    if "OBSTRUCTIV" in up:
        return "PATRÓN OBSTRUCTIVO"
    if "NO CONCLUYENTE" in up or "NO CUMPLE" in up or "REPETI" in up:
        return "NO CONCLUYENTE / REPETIR"
    if "NORMAL" in up or "CONSERVAD" in up:
        return "NORMAL"
    return clean[:36].rstrip() + "..." if len(clean) > 36 else clean


def calcular_espirometria_distribucion(project: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Distribucion del patron espirometrico."""
    mapa: Dict[str, int] = {}
    for w in project.get("trabajadores", []):
        patron_raw = (w.get("espirometria") or {}).get("patron") or "N/A"
        patron = _clasificar_patron_espirometrico(patron_raw)
        mapa[patron] = mapa.get(patron, 0) + 1
    return [{"patron": p, "conteo": c} for p, c in sorted(mapa.items())]


def calcular_escoliosis_distribucion(project: Dict[str, Any]) -> Dict[str, int]:
    """NORMAL <5°, LEVE 5-9°, MODERADA 10-19°, GRAVE >=20°."""
    normal = leve = moderada = grave = 0
    for w in project.get("trabajadores", []):
        g = (w.get("rxColumna") or {}).get("escoliosis")
        if g is None:
            continue
        try:
            gf = float(g)
        except (TypeError, ValueError):
            continue
        if gf < 5:
            normal += 1
        elif gf < 10:
            leve += 1
        elif gf < 20:
            moderada += 1
        else:
            grave += 1
    return {"normal": normal, "leve": leve, "moderada": moderada, "grave": grave}


def calcular_qs6_niveles(project: Dict[str, Any]) -> Dict[str, Dict[str, int]]:
    """Niveles de glucosa/colesterol/trigliceridos."""
    gluc_n = gluc_a = 0
    col_n = col_l = col_a = 0
    trig_n = trig_l = trig_a = 0
    for w in project.get("trabajadores", []):
        qs6 = (w.get("laboratorio") or {}).get("qs6") or {}
        g = qs6.get("gluc")
        c = qs6.get("col")
        t = qs6.get("trig")
        if g is not None:
            try:
                if float(g) < 100:
                    gluc_n += 1
                else:
                    gluc_a += 1
            except (TypeError, ValueError):
                pass
        if c is not None:
            try:
                cf = float(c)
                if cf < 200:
                    col_n += 1
                elif cf < 240:
                    col_l += 1
                else:
                    col_a += 1
            except (TypeError, ValueError):
                pass
        if t is not None:
            try:
                tf = float(t)
                if tf < 150:
                    trig_n += 1
                elif tf < 200:
                    trig_l += 1
                else:
                    trig_a += 1
            except (TypeError, ValueError):
                pass
    return {
        "glucosa": {"normal": gluc_n, "alta": gluc_a},
        "colesterol": {"normal": col_n, "limite": col_l, "alto": col_a},
        "trigliceridos": {"normal": trig_n, "limite": trig_l, "alto": trig_a},
    }


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        import re
        m = re.search(r"-?\d+(?:\.\d+)?", v.replace(",", "."))
        if m:
            try:
                return float(m.group(0))
            except ValueError:
                return None
    return None


def calcular_imc_distribucion(project: Dict[str, Any]) -> Dict[str, int]:
    """Clasifica estado nutricional / IMC segun OMS."""
    res = {
        "bajoPeso": 0,
        "normal": 0,
        "sobrepeso": 0,
        "obesidadI": 0,
        "obesidadII": 0,
        "obesidadIII": 0,
    }
    for w in project.get("trabajadores", []):
        em = w.get("examenMedico") or {}
        imc_val = _to_float(em.get("imc"))
        if imc_val is not None and imc_val > 0:
            if imc_val < 18.5:
                res["bajoPeso"] += 1
            elif imc_val < 25:
                res["normal"] += 1
            elif imc_val < 30:
                res["sobrepeso"] += 1
            elif imc_val < 35:
                res["obesidadI"] += 1
            elif imc_val < 40:
                res["obesidadII"] += 1
            else:
                res["obesidadIII"] += 1
            continue
        est = str(em.get("estadoNutricional") or "").upper()
        if not est or est in ("N/A", "NA"):
            continue
        if "OBESIDAD" in est and ("III" in est or "3" in est or "MORB" in est):
            res["obesidadIII"] += 1
        elif "OBESIDAD" in est and ("II" in est or "2" in est):
            res["obesidadII"] += 1
        elif "OBESIDAD" in est:
            res["obesidadI"] += 1
        elif "SOBREPESO" in est:
            res["sobrepeso"] += 1
        elif "BAJO" in est:
            res["bajoPeso"] += 1
        elif "NORMAL" in est or "EUTROF" in est:
            res["normal"] += 1
    return res


def calcular_presion_arterial_distribucion(project: Dict[str, Any]) -> Dict[str, int]:
    """Clasifica presion arterial: normal, normalAlta, elevada."""
    res = {"normal": 0, "normalAlta": 0, "elevada": 0}
    for w in project.get("trabajadores", []):
        em = w.get("examenMedico") or {}
        sis = _to_float(em.get("taSistolica"))
        dia = _to_float(em.get("taDiastolica"))
        if sis is None or dia is None:
            pa = str(em.get("presionArterial") or "")
            if "/" in pa:
                parts = pa.split("/", 1)
                sis = _to_float(parts[0])
                dia = _to_float(parts[1])
        if sis is not None and dia is not None and sis > 0 and dia > 0:
            if sis >= 130 or dia >= 80:
                res["elevada"] += 1
            elif sis >= 120:
                res["normalAlta"] += 1
            else:
                res["normal"] += 1
            continue
        dx_pa = str(em.get("dxPresion") or "").upper()
        if not dx_pa or dx_pa in ("N/A", "NA"):
            continue
        if "ALTA" in dx_pa and "NORMAL" in dx_pa:
            res["normalAlta"] += 1
        elif "ALTA" in dx_pa or "HIPERTEN" in dx_pa or "ELEVAD" in dx_pa:
            res["elevada"] += 1
        elif "NORMAL" in dx_pa:
            res["normal"] += 1
    return res


def calcular_salud_bucal_distribucion(project: Dict[str, Any]) -> Dict[str, int]:
    """Clasifica salud bucal reportada en examen medico."""
    res = {"normal": 0, "cariesSarro": 0}
    for w in project.get("trabajadores", []):
        sb = str((w.get("examenMedico") or {}).get("saludBucal") or "").upper().strip()
        if not sb or sb in ("N/A", "NA"):
            continue
        if any(tok in sb for tok in ("CARIES", "SARRO", "GINGIV", "EDENT", "HALITOS", "PROTES")):
            res["cariesSarro"] += 1
        elif any(tok in sb for tok in ("SANA", "NORMAL", "BUENA", "LIMPIA", "SIN ALTER")):
            res["normal"] += 1
        else:
            res["cariesSarro"] += 1
    return res


def calcular_aptitud_distribucion(project: Dict[str, Any]) -> Dict[str, int]:
    """Clasifica aptitud laboral global."""
    res = {"apto": 0, "conRestricciones": 0, "noApto": 0, "pendiente": 0}
    for w in project.get("trabajadores", []):
        apt = str((w.get("examenMedico") or {}).get("aptitud") or "").upper().strip()
        if not apt or apt in ("N/A", "NA"):
            res["pendiente"] += 1
        elif "NO APTO" in apt or "NO_APTO" in apt:
            res["noApto"] += 1
        elif "RESTRIC" in apt or "CONDIC" in apt or "OBSERV" in apt:
            res["conRestricciones"] += 1
        elif "APTO" in apt:
            res["apto"] += 1
        else:
            res["pendiente"] += 1
    return res


def calcular_conteo_estudios(project: Dict[str, Any]) -> Dict[str, int]:
    """Cuenta cuantos trabajadores tienen datos registrados por modalidad de estudio."""
    counts = {
        "examenMedico": 0,
        "audiometria": 0,
        "espirometria": 0,
        "ecg": 0,
        "rxColumna": 0,
        "rxTorax": 0,
        "campimetria": 0,
        "laboratorio": 0,
    }
    for w in project.get("trabajadores", []):
        for key in counts:
            grp = w.get(key) or {}
            has_any = False
            for k, val in grp.items():
                if k in ("fileUrl", "fileUrlAP", "fileUrlLateral", "validatedPdfUrl", "dictamenPdfUrl"):
                    continue
                if isinstance(val, dict):
                    if any(_has_value(sub_v) for sub_v in val.values()):
                        has_any = True
                        break
                elif _has_value(val):
                    has_any = True
                    break
            if has_any:
                counts[key] += 1
    return counts