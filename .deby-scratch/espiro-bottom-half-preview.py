#!/usr/bin/env python3
"""Prueba local: PDF original → mitad inferior → PDF nuevo (sin tocar app)."""
from __future__ import annotations

import sys
from pathlib import Path

import pymupdf

LETTER_WIDTH_PT = 612
LETTER_HEIGHT_PT = 792
CLIP_X0 = 0
CLIP_Y0 = 385
CLIP_X1 = LETTER_WIDTH_PT
CLIP_Y1 = LETTER_HEIGHT_PT


def make_bottom_half_pdf(src_pdf: Path, out_pdf: Path, dpi: int = 200) -> dict:
    doc = pymupdf.open(src_pdf)
    if doc.page_count < 1:
        raise ValueError("PDF sin páginas")

    page = doc[0]
    rect = page.rect
    clip = pymupdf.Rect(CLIP_X0, CLIP_Y0, CLIP_X1, CLIP_Y1)

    scale = dpi / 72.0
    matrix = pymupdf.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=matrix, clip=clip, alpha=False)

    out = pymupdf.open()
    # Página del tamaño exacto de la mitad inferior (puntos PDF)
    out_page = out.new_page(width=CLIP_X1 - CLIP_X0, height=CLIP_Y1 - CLIP_Y0)
    out_page.insert_image(out_page.rect, pixmap=pix)
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_pdf)
    doc.close()
    out.close()

    return {
        "source": str(src_pdf),
        "output": str(out_pdf),
        "page_pt": (rect.width, rect.height),
        "bottom_half_pt": (rect.width, rect.height / 2),
        "clip": (clip.x0, clip.y0, clip.x1, clip.y1),
        "pix": (pix.width, pix.height),
        "dpi": dpi,
    }


CANONICAL_PATHS = [
    Path(
        "/mnt/Datos/Proyectos 2.0/Administracion Medica Industrial/"
        "Administracion-medica-industrial/context/datos AMI/PDFs/espiro normal.pdf"
    ),
    Path(
        "/home/frank/repos/Administracion-medica-industrial/context/datos AMI/"
        "PDFs/espiro normal.pdf"
    ),
]


def resolve_source_pdf(explicit: Path | None) -> Path:
    if explicit is not None:
        if not explicit.is_file():
            raise FileNotFoundError(f"No encontrado: {explicit}")
        return explicit
    for candidate in CANONICAL_PATHS:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "No se encontró espiro normal.pdf. Rutas probadas:\n"
        + "\n".join(f"  - {p}" for p in CANONICAL_PATHS)
    )


def main() -> None:
    explicit = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    src = resolve_source_pdf(explicit)

    out = Path(
        "/home/frank/repos/Administracion-medica-industrial/uploads/_test-crop/"
        "espiro-bottom-half-preview.pdf"
    )
    info = make_bottom_half_pdf(src, out)
    for k, v in info.items():
        print(f"{k}: {v}")
    print(f"\nPDF generado: {out}")


if __name__ == "__main__":
    main()
