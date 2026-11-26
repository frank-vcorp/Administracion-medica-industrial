"""Pruebas unitarias e integración para el lector geométrico de audiogramas."""
from __future__ import annotations

import math
from typing import Dict

from PIL import Image, ImageDraw

from app.services.audiometry_graph_reader import (
    extract_audiogram_curves_from_file,
    extract_audiogram_curves_from_image,
    merge_audiogram_graph_reading,
)


def _draw_audiogram_chart(
    draw: ImageDraw.ImageDraw,
    x_125: int,
    dx: float,
    y_neg10: int,
    dy: float,
    va: Dict[int, int],
    is_red_od: bool,
    with_colored_ref_lines: bool = False,
) -> None:
    x_8k = int(round(x_125 + 6 * dx))
    y_120 = int(round(y_neg10 + 13 * dy))

    # Líneas horizontales -10..120 dB
    for k in range(14):
        yk = int(round(y_neg10 + k * dy))
        draw.line([(x_125, yk), (x_8k, yk)], fill=(180, 180, 180), width=1)

    # Líneas verticales sólidas de octava + punteadas de media octava
    for k in range(7):
        xk = int(round(x_125 + k * dx))
        draw.line([(xk, y_neg10), (xk, y_120)], fill=(165, 165, 165), width=1)
    for f in (750, 1500, 3000, 6000):
        xf = int(round(x_125 + math.log2(f / 125.0) * dx))
        for seg_y in range(y_neg10, y_120, 8):
            draw.line([(xf, seg_y), (xf, min(y_120, seg_y + 4))], fill=(190, 190, 190), width=1)

    color = (210, 45, 45) if is_red_od else (45, 85, 200)

    if with_colored_ref_lines:
        # Líneas de referencia a 0 dB (k=1) y 100 dB (k=11) + etiquetas coloreadas
        for ref_k in (1, 11):
            yr = int(round(y_neg10 + ref_k * dy))
            draw.line([(x_125, yr), (x_8k, yr)], fill=color, width=2)
        draw.text((int(x_125 + 4.3 * dx), y_neg10 + 6), "HTL 21", fill=color)
        draw.text((int(x_125 + 4.3 * dx), int(y_neg10 + 3.2 * dy)), "AI 86%", fill=color)

    # Puntos y curva conectada
    pts = []
    for freq in sorted(va.keys()):
        xf = int(round(x_125 + math.log2(freq / 125.0) * dx))
        yf = int(round(y_neg10 + ((va[freq] + 10.0) / 10.0) * dy))
        pts.append((xf, yf))

    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=2)

    r_sym = max(6, int(round(dy * 0.22)))
    for px, py in pts:
        if is_red_od:
            draw.ellipse([px - r_sym, py - r_sym, px + r_sym, py + r_sym], outline=color, width=2)
        else:
            draw.line([(px - r_sym, py - r_sym), (px + r_sym, py + r_sym)], fill=color, width=2)
            draw.line([(px - r_sym, py + r_sym), (px + r_sym, py - r_sym)], fill=color, width=2)


def test_dd65_layout_negative_db_and_excludes_untested_half_octaves():
    img = Image.new("RGB", (1400, 1000), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    od_expected = {250: 5, 500: 5, 1000: 0, 2000: 0, 3000: 0, 4000: 5, 6000: -10, 8000: -5}
    oi_expected = {250: 5, 500: 10, 1000: 5, 2000: 10, 3000: 5, 4000: 10, 6000: 5, 8000: -5}

    # DD65: OD rojo a la izquierda, OI azul a la derecha
    _draw_audiogram_chart(draw, x_125=120, dx=72, y_neg10=180, dy=34, va=od_expected, is_red_od=True)
    _draw_audiogram_chart(draw, x_125=800, dx=72, y_neg10=180, dy=34, va=oi_expected, is_red_od=False)

    res = extract_audiogram_curves_from_image(img)
    assert res is not None
    assert res["oido_derecho"] == {str(k): v for k, v in od_expected.items()}
    assert res["oido_izquierdo"] == {str(k): v for k, v in oi_expected.items()}
    assert "750" not in res["oido_derecho"]
    assert "1500" not in res["oido_derecho"]


def test_swapped_oi_left_od_right_with_colored_ref_lines_and_trauma_notch():
    img = Image.new("RGB", (1600, 1200), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    oi_expected = {250: 10, 500: 15, 1000: 15, 2000: 10, 3000: 15, 4000: 35, 6000: 40, 8000: 25}
    od_expected = {250: 10, 500: 20, 1000: 15, 2000: 5, 3000: 5, 4000: 15, 6000: 20, 8000: 5}

    # Sibelmed/Amplivox: OI azul a la izquierda, OD rojo a la derecha + líneas 0/100 dB y texto HTL/AI
    _draw_audiogram_chart(
        draw,
        x_125=160,
        dx=84,
        y_neg10=240,
        dy=42,
        va=oi_expected,
        is_red_od=False,
        with_colored_ref_lines=True,
    )
    _draw_audiogram_chart(
        draw,
        x_125=920,
        dx=84,
        y_neg10=240,
        dy=42,
        va=od_expected,
        is_red_od=True,
        with_colored_ref_lines=True,
    )

    res = extract_audiogram_curves_from_image(img)
    assert res is not None
    assert res["oido_derecho"] == {str(k): v for k, v in od_expected.items()}
    assert res["oido_izquierdo"] == {str(k): v for k, v in oi_expected.items()}


def test_merge_corrects_shifted_llm_output_and_preserves_metadata():
    llm_result = {
        "paciente": "HECTOR LOPEZ ANGELES",
        "fecha_estudio": "03/10/2025 2:17:22",
        "estudio": {"fecha_estudio": "03/10/2025 2:17:22", "equipo_modelo": None},
        "oido_derecho": {
            "va": {"250": 10, "500": 20, "1000": 15, "2000": 5, "4000": 15, "6000": 20, "8000": 5},
            "pta": 13,
        },
        "oido_izquierdo": {
            "va": {"250": 10, "500": 15, "1000": 15, "2000": 10, "4000": 15, "6000": 35, "8000": 25},
            "pta": 13,
        },
        "frecuencias_detectadas": ["250", "500", "1000", "2000", "4000", "6000", "8000"],
        "completitud_documental": "suficiente",
        "notas_calidad": "Audiograma con curvas de vía aérea.",
    }
    graph_reading = {
        "oido_derecho": {"250": 10, "500": 20, "1000": 15, "2000": 5, "3000": 5, "4000": 15, "6000": 20, "8000": 5},
        "oido_izquierdo": {"250": 10, "500": 15, "1000": 15, "2000": 10, "3000": 15, "4000": 35, "6000": 40, "8000": 25},
    }

    merged, changed = merge_audiogram_graph_reading(llm_result, graph_reading)
    assert changed is True
    assert merged["oido_izquierdo"]["va"]["3000"] == 15
    assert merged["oido_izquierdo"]["va"]["4000"] == 35
    assert merged["oido_izquierdo"]["va"]["6000"] == 40
    assert merged["oido_derecho"]["va"]["3000"] == 5
    assert "3000" in merged["frecuencias_detectadas"]
    assert merged["completitud_documental"] == "suficiente"
    assert merged["paciente"] == "HECTOR LOPEZ ANGELES"
    assert merged["oido_derecho"]["pta"] == 13
    assert "verificados geométricamente" in merged["notas_calidad"]


def test_merge_rejects_override_on_large_anchor_y_axis_offset():
    llm_result = {
        "oido_derecho": {"va": {"250": 10, "500": 20, "1000": 15, "2000": 10, "3000": 10, "4000": 15, "6000": 20, "8000": 5}},
        "oido_izquierdo": {"va": {"250": 10, "500": 15, "1000": 15, "2000": 10, "3000": 15, "4000": 35, "6000": 40, "8000": 25}},
        "notas_calidad": "OK",
    }
    shifted_reading = {
        "oido_derecho": {"250": 20, "500": 30, "1000": 25, "2000": 20, "3000": 20, "4000": 25, "6000": 30, "8000": 15},
        "oido_izquierdo": {"250": 20, "500": 25, "1000": 25, "2000": 20, "3000": 25, "4000": 45, "6000": 50, "8000": 35},
    }

    merged, changed = merge_audiogram_graph_reading(llm_result, shifted_reading)
    assert changed is False
    assert merged["oido_derecho"]["va"]["500"] == 20


def test_merge_preserves_explicit_four_frequency_table_report():
    llm_result = {
        "oido_derecho": {"va": {"500": 5, "1000": 5, "2000": 20, "3000": 35}},
        "oido_izquierdo": {"va": {"500": 20, "1000": 10, "2000": 25, "3000": 30}},
        "frecuencias_detectadas": ["500", "1000", "2000", "3000"],
        "completitud_documental": "parcial",
        "notas_calidad": "Extracción desde tabla numérica de 4 frecuencias.",
    }
    graph_reading = {
        "oido_derecho": {"250": 5, "500": 5, "1000": 5, "2000": 20, "3000": 35, "4000": 20, "6000": 10, "8000": 15},
        "oido_izquierdo": {"250": 15, "500": 20, "1000": 10, "2000": 25, "3000": 30, "4000": 30, "6000": 20, "8000": 20},
    }

    merged, changed = merge_audiogram_graph_reading(llm_result, graph_reading)
    assert changed is False
    assert set(merged["oido_derecho"]["va"].keys()) == {"500", "1000", "2000", "3000"}


def test_graceful_fallback_on_missing_or_invalid_images():
    assert extract_audiogram_curves_from_file("/nonexistent/path/audio.pdf") is None
    blank = Image.new("RGB", (800, 600), (255, 255, 255))
    assert extract_audiogram_curves_from_image(blank) is None
    gray = Image.new("L", (800, 600), 255)
    assert extract_audiogram_curves_from_image(gray) is None


def test_extractor_integration_applies_graph_verification_on_real_image(tmp_path, monkeypatch):
    from app.services.ai.extractor import ExtractorService

    img = Image.new("RGB", (1400, 1000), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    od = {250: 10, 500: 20, 1000: 15, 2000: 5, 3000: 5, 4000: 15, 6000: 20, 8000: 5}
    oi = {250: 10, 500: 15, 1000: 15, 2000: 10, 3000: 15, 4000: 35, 6000: 40, 8000: 25}
    _draw_audiogram_chart(draw, x_125=120, dx=72, y_neg10=180, dy=34, va=od, is_red_od=True)
    _draw_audiogram_chart(draw, x_125=800, dx=72, y_neg10=180, dy=34, va=oi, is_red_od=False)
    img_path = tmp_path / "audiogram.png"
    img.save(img_path)

    # Simular respuesta LLM con corrimiento en OI (faltaba 3000, 4000 tenía 15, 6000 tenía 35)
    def _fake_call(self, file_path, prompt, provider, model, selected_study_type=None):
        return (
            {
                "paciente": "PACIENTE PRUEBA",
                "fecha_estudio": "2026-11-25",
                "oido_derecho": {"va": {"250": 10, "500": 20, "1000": 15, "2000": 5, "4000": 15, "6000": 20, "8000": 5}},
                "oido_izquierdo": {"va": {"250": 10, "500": 15, "1000": 15, "2000": 10, "4000": 15, "6000": 35, "8000": 25}},
                "frecuencias_detectadas": ["250", "500", "1000", "2000", "4000", "6000", "8000"],
                "completitud_documental": "suficiente",
                "notas_calidad": ["Solo vía aérea"],
            },
            "m3",
            None,
        )

    monkeypatch.setattr(ExtractorService, "_call_with_dispatch", _fake_call)
    svc = ExtractorService(api_key="test-key", model="MiniMax-M3.1-Flash")
    out = svc.extract_by_type(
        str(img_path),
        "Audiometria",
        ai_calibration={"enabled": True, "extraction": {"enabled": True, "prompt": "Test prompt"}},
    )

    assert out["oido_derecho"]["va"] == {str(k): v for k, v in od.items()}
    assert out["oido_izquierdo"]["va"] == {str(k): v for k, v in oi.items()}
    assert "3000" in out["frecuencias_detectadas"]
