"""Regresión criterio audiométrico SME (DEC-20260825-03, FND-20260825-09)."""

from app.audiometry_criteria import (
    detectar_morfologia_curva_audiometrica,
    enrich_audiometry_extracted_data,
    resolver_criterio_ami_combinado,
    resolve_audiometria_ear,
)


def test_quintanar_pta3_bajo_patron_agudas_es_alterado():
    """PTA3 ≤25 no fuerza NORMAL si hay compromiso >25 en medias/agudas (FND-20260825-09)."""
    va = {
        250: 5,
        500: 5,
        1000: 5,
        2000: 20,
        3000: 35,
    }
    from app.audiometry_criteria import _calcular_pta3, _clasificar_patron

    pta, ok = _calcular_pta3(va)
    assert ok
    assert pta == 10.0
    patron = _clasificar_patron(va)
    assert patron == "AGUDAS"
    assert (
        resolver_criterio_ami_combinado(pta, ok, patron, list(va.values()))
        == "ALTERADO"
    )


def test_criterio_normal_solo_si_pta_y_patron_normales():
    va = {500: 15, 1000: 20, 2000: 20, 3000: 15}
    ear = resolve_audiometria_ear({"va": va})
    assert ear["criterio_ami"] == "NORMAL"
    assert ear["patron_ami"] == "NORMAL"


def test_enrich_agrega_bloque_interpretacion_derivada():
    payload = {
        "oido_derecho": {
            "va": {500: 5, 1000: 5, 2000: 20, 3000: 35},
            "pta_visible": 14,
        },
        "oido_izquierdo": {
            "va": {500: 20, 1000: 10, 2000: 25, 3000: 30},
            "pta_visible": 21,
        },
    }
    out = enrich_audiometry_extracted_data(payload)
    block = out["interpretacion_derivada_sme"]
    assert block["oido_derecho"]["criterio_ami"] == "ALTERADO"
    assert block["oido_izquierdo"]["criterio_ami"] == "ALTERADO"


def test_trauma_acustico_franco_en_oi_y_muesca_incipiente_en_od():
    """audio_trauma.pdf real: OI escotoma franco 4-6 kHz; OD muesca incipiente en 6 kHz."""
    payload = {
        "oido_derecho": {
            "va": {250: 10, 500: 20, 1000: 15, 2000: 5, 3000: 5, 4000: 15, 6000: 20, 8000: 5}
        },
        "oido_izquierdo": {
            "va": {250: 10, 500: 15, 1000: 15, 2000: 10, 3000: 15, 4000: 35, 6000: 40, 8000: 25}
        },
    }
    enriched = enrich_audiometry_extracted_data(payload)
    oi = enriched["interpretacion_derivada_sme"]["oido_izquierdo"]
    od = enriched["interpretacion_derivada_sme"]["oido_derecho"]

    assert oi["criterio_ami"] == "ALTERADO"
    assert oi["morfologia_curva"]["morfologia"] == "ESCOTOMA_TRAUMA_ACUSTICO_FRANCO"
    assert oi["morfologia_curva"]["escotoma_trauma_acustico"] is True
    assert oi["morfologia_curva"]["frecuencias_escotoma_hz"] == [4000, 6000]
    assert oi["morfologia_curva"]["caida_desde_2k_db"] == 30
    assert oi["morfologia_curva"]["recuperacion_8k_db"] == 15

    assert od["criterio_ami"] == "NORMAL"
    assert od["morfologia_curva"]["morfologia"] == "ESCOTOMA_TRAUMA_ACUSTICO_INCIPIENTE"
    assert od["morfologia_curva"]["escotoma_trauma_acustico"] is True
    assert od["morfologia_curva"]["frecuencias_escotoma_hz"] == [6000]


def test_presbiacusia_descendente_y_normal_sin_falso_escotoma():
    """audio_presbiacusia.pdf es descendente sin recuperación; audio_normal.pdf no tiene escotoma."""
    presb_od = {250: 40, 500: 40, 1000: 40, 2000: 25, 3000: 25, 4000: 30, 6000: 40, 8000: 55}
    presb_oi = {250: 20, 500: 20, 1000: 20, 2000: 15, 3000: 10, 4000: 10, 6000: 15, 8000: 40}
    norm_od = {250: 5, 500: 5, 1000: 0, 2000: 0, 3000: 0, 4000: 5, 6000: -10, 8000: -5}
    norm_oi = {250: 5, 500: 10, 1000: 5, 2000: 10, 3000: 5, 4000: 10, 6000: 5, 8000: -5}

    for va in (presb_od, presb_oi):
        morf = detectar_morfologia_curva_audiometrica(va)
        assert morf["morfologia"] == "DESCENDENTE_AGUDAS_SIN_RECUPERACION"
        assert morf["escotoma_trauma_acustico"] is False

    for va in (norm_od, norm_oi):
        morf = detectar_morfologia_curva_audiometrica(va)
        assert morf["morfologia"] == "SIN_ESCOTOMA"
        assert morf["escotoma_trauma_acustico"] is False


def test_estudio_parcial_cuatro_frecuencias_sin_8000_no_evaluable():
    morf = detectar_morfologia_curva_audiometrica({500: 5, 1000: 5, 2000: 20, 3000: 35})
    assert morf["morfologia"] == "NO_EVALUABLE_SIN_8000"
    assert morf["escotoma_trauma_acustico"] is False
