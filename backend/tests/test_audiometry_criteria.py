"""Regresión criterio audiométrico SME (DEC-20260825-03, FND-20260825-09)."""

from app.audiometry_criteria import (
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
