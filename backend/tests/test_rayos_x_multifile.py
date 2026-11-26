"""Pruebas unitarias para soporte multi-imagen y PDF multipágina en Rayos X."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from PIL import Image

from app.schemas.medical import RayosXData
from app.services.ai.base import M3VisionBase
from app.services.ai.extractor import ExtractorService


def _make_dummy_image(path, color=(120, 120, 120)):
    img = Image.new("RGB", (32, 32), color=color)
    img.save(path, format="JPEG")


def test_call_m3_completion_single_file_preserves_legacy_two_part_content(tmp_path):
    img1 = tmp_path / "rx_ap.jpg"
    _make_dummy_image(img1)

    captured_kwargs = {}

    class _FakeCompletions:
        def create(self, **kwargs):
            captured_kwargs.update(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content='{"ok": true}'))]
            )

    fake_openai_cls = MagicMock(
        return_value=SimpleNamespace(chat=SimpleNamespace(completions=_FakeCompletions()))
    )

    m3 = M3VisionBase(api_key="test-key", base_url="https://api.minimax.io/v1")
    fake_openai_mod = SimpleNamespace(OpenAI=fake_openai_cls)
    with patch.dict("sys.modules", {"openai": fake_openai_mod}), patch.object(
        m3, "_refresh_keys", lambda: None
    ):
        raw = m3._call_m3_completion(str(img1), "Extrae RX")

    assert raw == '{"ok": true}'
    content = captured_kwargs["messages"][0]["content"]
    assert len(content) == 2
    assert content[0] == {"type": "text", "text": "Extrae RX"}
    assert content[1]["type"] == "image_url"
    assert content[1]["image_url"]["url"].startswith("data:image/jpeg;base64,")


def test_call_m3_completion_multiple_files_sends_all_images_with_labels_in_single_call(tmp_path):
    img1 = tmp_path / "cervical_ap.jpg"
    img2 = tmp_path / "cervical_lat.jpg"
    _make_dummy_image(img1, color=(100, 100, 100))
    _make_dummy_image(img2, color=(200, 200, 200))

    create_calls = []

    class _FakeCompletions:
        def create(self, **kwargs):
            create_calls.append(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content='{"hallazgos": ["OK"]}'))]
            )

    fake_openai_cls = MagicMock(
        return_value=SimpleNamespace(chat=SimpleNamespace(completions=_FakeCompletions()))
    )

    m3 = M3VisionBase(api_key="test-key", base_url="https://api.minimax.io/v1")
    fake_openai_mod = SimpleNamespace(OpenAI=fake_openai_cls)
    with patch.dict("sys.modules", {"openai": fake_openai_mod}), patch.object(
        m3, "_refresh_keys", lambda: None
    ):
        m3._call_m3_completion(
            str(img1),
            "Extrae columna cervical",
            extra_file_paths=[str(img2)],
            image_labels=["AP", "LAT"],
            all_pdf_pages=True,
        )

    assert len(create_calls) == 1
    content = create_calls[0]["messages"][0]["content"]
    image_blocks = [c for c in content if c["type"] == "image_url"]
    text_blocks = [c["text"] for c in content if c["type"] == "text"]
    assert len(image_blocks) == 2
    assert any("Placa / Imagen 1 de 2 (AP)" in t for t in text_blocks)
    assert any("Placa / Imagen 2 de 2 (LAT)" in t for t in text_blocks)


def test_get_b64_jpegs_pdf_multipage_vs_single_page(tmp_path):
    pdf_path = tmp_path / "rx_cervical.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n%stub\n")
    page1 = Image.new("RGB", (20, 20), color=(10, 10, 10))
    page2 = Image.new("RGB", (20, 20), color=(240, 240, 240))

    m3 = M3VisionBase(api_key="test-key")
    with patch(
        "app.services.ai.base.convert_from_path",
        return_value=[page1, page2],
    ) as mock_conv:
        multi = m3.get_b64_jpegs(str(pdf_path), all_pdf_pages=True, max_pages=6)
        single = m3.get_b64_jpegs(str(pdf_path), all_pdf_pages=False, max_pages=6)

    assert len(multi) == 2
    assert len(single) == 1
    assert mock_conv.call_args_list[0].kwargs["last_page"] == 6
    assert mock_conv.call_args_list[1].kwargs["last_page"] == 1


def test_extractor_rayos_x_propagates_extra_files_and_sets_proyecciones(tmp_path):
    img1 = tmp_path / "ap.jpg"
    img2 = tmp_path / "lat.jpg"
    _make_dummy_image(img1)
    _make_dummy_image(img2)

    extractor = ExtractorService(api_key="fake-gemini")
    captured = {}

    def fake_call_m3(file_path, prompt, **kwargs):
        captured["file_path"] = file_path
        captured["prompt"] = prompt
        captured["kwargs"] = kwargs
        return {
            "paciente": "GOMEZ LOPEZ JUAN",
            "fecha_estudio": "2026-11-26",
            "localizacion": "Columna cervical",
            "hallazgos": [
                "Alineación cervical conservada en proyección AP y lateral.",
                "Espacios intervertebrales mantenidos sin fracturas.",
            ],
            "notas_calidad": "Estudio completo en proyecciones AP y lateral.",
        }

    with patch("app.services.ai.extractor.M3VisionBase") as mock_m3_cls:
        mock_instance = mock_m3_cls.return_value
        mock_instance.call_m3.side_effect = fake_call_m3
        mock_instance.key_source = "test"
        mock_instance.key_resolution_warning = None

        out = extractor.extract_by_type(
            str(img1),
            "Rayos_X",
            ai_calibration={
                "enabled": True,
                "extraction": {
                    "provider": "m3",
                    "prompt": "Extrae datos de radiografía en JSON.",
                    "version": "rx-test-v1",
                },
            },
            test_name="RX DE COLUMNA CERVICAL",
            extra_file_paths=[str(img2)],
            image_labels=["AP", "LAT"],
        )

    assert isinstance(out, RayosXData)
    assert out.proyecciones_evaluadas == ["AP", "LAT"]
    assert captured["file_path"] == str(img1)
    assert captured["kwargs"]["extra_file_paths"] == [str(img2)]
    assert captured["kwargs"]["image_labels"] == ["AP", "LAT"]
    assert captured["kwargs"]["all_pdf_pages"] is True
    assert "MULTIPROYECCIÓN" in captured["prompt"]
    assert "Placa 1 (AP)" in captured["prompt"]
    assert "Placa 2 (LAT)" in captured["prompt"]
