"""
IMPL-20260701-04: Orquestador de generacion de reportes masivos (Fase 4 EBOOK).
IMPL-20260630-03: Orquestador original.
ARCH-20260623-01: Modulo de Reportes Masivos.

Lee los datos reales del proyecto desde Prisma, genera XLSX y/o EBOOK (PDF
navegable con TOC, bookmarks, estadisticas con mini-graficas y secciones
por trabajador con imagenes embebidas), los guarda en
uploads/reports/{projectId}/{reportId}/ y actualiza el ProjectReport.

Formatos aceptados (validados tambien en api/reports.py):
  - 'XLSX'  -> concentrado tabular + graficas
  - 'EBOOK'  -> PDF navegable generado con pdf_ebook_writer
  - 'BOTH'   -> XLSX + EBOOK en la misma corrida
  - 'PDF'    -> DEPRECATED, aceptado por retro-compatibilidad (usa EBOOK)

Naming:
  - XLSX: concentrado.xlsx
  - EBOOK/PDF (legacy): EBOOK_{empresa_slug}_{fecha}.pdf
"""
from __future__ import annotations

import logging
import os
import re
import traceback
import unicodedata
from datetime import datetime
from typing import Any, Dict

from app.services.reports.xlsx_writer import generar_xlsx


logger = logging.getLogger(__name__)


UPLOAD_DIR = os.getenv("UPLOAD_DIR") or "/uploads"
REPORTS_SUBDIR = "reports"


def _upload_dir() -> str:
    """Lee UPLOAD_DIR del env en cada llamada (permite tests con monkeypatch)."""
    return os.getenv("UPLOAD_DIR") or "/uploads"


def reports_dir() -> str:
    """Directorio base para reportes: {UPLOAD_DIR}/reports/."""
    base = os.path.join(_upload_dir(), REPORTS_SUBDIR)
    os.makedirs(base, exist_ok=True)
    return base


def report_storage_dir(project_id: str, report_id: str) -> str:
    """Directorio del reporte: uploads/reports/{projectId}/{reportId}/."""
    d = os.path.join(_upload_dir(), REPORTS_SUBDIR, project_id, report_id)
    os.makedirs(d, exist_ok=True)
    # Permisos 0o755 — solo owner escribe, grupo/otros leen.
    try:
        os.chmod(d, 0o755)
    except OSError:
        pass
    return d


def relative_path(project_id: str, report_id: str, filename: str) -> str:
    """Path relativo para guardar en DB: reports/{projectId}/{reportId}/{filename}."""
    return f"{REPORTS_SUBDIR}/{project_id}/{report_id}/{filename}"


def project_to_snapshot(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convierte un objeto Project de Prisma (incluyendo relaciones) en el
    payload "snapshot" que consumen los generadores XLSX/PDF.
    Adaptado del shape de DemoProject para que la logica de conteos sea
    reutilizable sin acoplar al ORM.
    """
    trabajadores_raw = project.get("workers") or []
    empresa = (project.get("company") or {}).get("name", "")
    empresa_legal = (project.get("company") or {}).get("legalName") or empresa
    fecha = (
        project.get("startDate").strftime("%Y-%m-%d")
        if hasattr(project.get("startDate"), "strftime")
        else str(project.get("startDate", ""))[:10]
    )

    trabajadores = []
    for pw in trabajadores_raw:
        worker = pw.get("worker") if isinstance(pw, dict) else None
        if worker is None:
            continue
        # Evento medico del trabajador en este proyecto.
        event = pw.get("event") if isinstance(pw, dict) else None

        estudios: Dict[str, Any] = {}
        if isinstance(event, dict):
            for et in (event.get("eventTests") or []):
                tn = (et.get("testNameSnapshot") or "").lower()
                if "audiometr" in tn:
                    estudios["audiometria"] = _audiometria(et)
                elif "espirometr" in tn:
                    estudios["espirometria"] = _espirometria(et)
                elif "columna" in tn or "rx col" in tn or "escoliosis" in tn:
                    estudios["rxColumna"] = _rx_columna(et)
                elif "torax" in tn or "t&oacute;rax" in tn or "tórax" in tn:
                    estudios["rxTorax"] = _rx_torax(et)
                elif "ecg" in tn or "electrocardio" in tn:
                    estudios["ecg"] = _ecg(et)
                elif "campimetr" in tn or "agudeza" in tn or "visual" in tn:
                    estudios["campimetria"] = _campimetria(et)
                elif "laboratorio" in tn or "lab" in tn or "bh" in tn or "qs" in tn:
                    estudios["laboratorio"] = _laboratorio(et)

        nombre = f"{(worker.get('lastName') or '').strip()} {(worker.get('firstName') or '').strip()}".strip()
        sexo = (worker.get("sexo") or "").upper() if isinstance(worker.get("sexo"), str) else ""
        trabajadores.append(
            {
                "folio": str(worker.get("universalId") or worker.get("id", ""))[:16],
                "nombre": nombre,
                "sexo": sexo,
                "area": "",
                "antiguedad": "",
                "campimetria": estudios.get("campimetria") or {},
                "audiometria": estudios.get("audiometria") or {},
                "espirometria": estudios.get("espirometria") or {},
                "rxColumna": estudios.get("rxColumna") or {},
                "rxTorax": estudios.get("rxTorax") or {},
                "ecg": estudios.get("ecg") or {},
                "laboratorio": estudios.get("laboratorio") or {},
            }
        )

    return {
        "id": project.get("id"),
        "empresa": empresa,
        "empresaLegal": empresa_legal,
        "fecha": fecha,
        "trabajadores": trabajadores,
    }


# --- Adaptadores EventTest -> dicts -----------------------------------------

def _first_extracted(et: Dict[str, Any]) -> Dict[str, Any]:
    ed = et.get("extractedData")
    if isinstance(ed, dict):
        return ed
    return {}


def _audiometria(et: Dict[str, Any]) -> Dict[str, Any]:
    ed = _first_extracted(et)
    od = ed.get("oido_derecho") or {}
    oi = ed.get("oido_izquierdo") or {}
    return {
        "dx": ed.get("dx") or ed.get("diagnostico") or "N/A",
        "oidoDerecho": ed.get("oido_derecho_dx") or od.get("umbral") or "N/A",
        "oidoIzquierdo": ed.get("oido_izquierdo_dx") or oi.get("umbral") or "N/A",
        "hbc": ed.get("hbc_porcentaje") or ed.get("hbc"),
    }


def _espirometria(et: Dict[str, Any]) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "patron": ed.get("patron") or ed.get("interpretacion") or "N/A",
        "fvc": ed.get("fvc"),
        "tabaquismo": ed.get("tabaquismo") or "N/A",
    }


def _rx_columna(et: Dict[str, Any]) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "escoliosis": ed.get("escoliosis_grados") or ed.get("escoliosis"),
        "lordosis": ed.get("lordosis_grados") or ed.get("lordosis"),
        "basculacion": ed.get("basculacion_pelvica_cm") or ed.get("basculacion"),
        "valoracionPostural": ed.get("valoracion_postural") or ed.get("postura") or "N/A",
        "impresion": ed.get("impresion_diagnostica") or ed.get("impresion") or "N/A",
    }


def _rx_torax(et: Dict[str, Any]) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "impresion": ed.get("impresion_diagnostica") or ed.get("impresion") or "N/A",
    }


def _ecg(et: Dict[str, Any]) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "impresion": ed.get("impresion_diagnostica") or ed.get("impresion") or "N/A",
    }


def _campimetria(et: Dict[str, Any]) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "agudezaVisual": ed.get("agudeza_visual") or ed.get("agudezaVisual") or "N/A",
        "camposVisuales": ed.get("campos_visuales") or ed.get("camposVisuales") or "N/A",
        "discriminacionColor": ed.get("discriminacion_color") or ed.get("discriminacionColor") or "N/A",
    }


def _laboratorio(et: Dict[str, Any]) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "folioLab": ed.get("folio_lab") or ed.get("folioLab") or "",
        "edad": ed.get("edad") or "",
        "bh": {
            "hb": ed.get("bh_hb"),
            "mchb": ed.get("bh_mchb"),
            "chgm": ed.get("bh_chgm"),
            "leu": ed.get("bh_leu"),
            "pla": ed.get("bh_pla"),
        },
        "qs6": {
            "gluc": ed.get("qs_glucosa"),
            "bun": ed.get("qs_bun"),
            "urea": ed.get("qs_urea"),
            "creat": ed.get("qs_creatinina"),
            "au": ed.get("qs_acido_urico"),
            "col": ed.get("qs_colesterol"),
            "trig": ed.get("qs_trigliceridos"),
        },
        "ego": {
            "glc": ed.get("ego_glucosa"),
            "prot": ed.get("ego_proteinas"),
            "blo": ed.get("ego_sangre"),
            "bac": ed.get("ego_bacterias") or "N/A",
            "cristales": ed.get("ego_cristales") or "N/A",
        },
        "toxico": {
            "anfeta": ed.get("tox_anfetaminas") or "N/A",
            "coca": ed.get("tox_cocaina") or "N/A",
            "marihua": ed.get("tox_marihuana") or "N/A",
            "opiac": ed.get("tox_opiaceos") or "N/A",
            "metanf": ed.get("tox_metanfetaminas") or "N/A",
        },
    }


# --- Orquestacion ----------------------------------------------------------

ALLOWED_FORMATS = {"XLSX", "EBOOK", "BOTH", "PDF"}


def _empresa_slug(empresa: str) -> str:
    """Normaliza el nombre de empresa a un slug ASCII seguro para filename."""
    if not empresa:
        return "PROYECTO"
    # Quitar acentos usando unicodedata (no .normalize() que es metodo de str).
    texto = (
        unicodedata.normalize("NFD", empresa)
        .encode("ascii", "ignore")
        .decode("ascii")
        .upper()
    )
    # Reemplazar todo lo no alfanumerico por guion bajo.
    texto = re.sub(r"[^A-Z0-9]+", "_", texto)
    return texto.strip("_") or "PROYECTO"


def generar_reporte_masivo(
    snapshot: Dict[str, Any],
    project_id: str,
    report_id: str,
    format: str,
) -> Dict[str, Any]:
    """
    Genera el reporte en el formato pedido. Retorna dict con
    fileUrlXlsx / fileUrlPdf (relativos) o levanta excepcion.

    IMPL-20260701-04: EBOOK reemplaza PDF. Se conserva 'PDF' como alias
    deprecado para no romper integraciones legacy.
    """
    if format not in ALLOWED_FORMATS:
        raise ValueError(
            f"Formato invalido: {format!r}. Permitidos: {sorted(ALLOWED_FORMATS)}"
        )

    storage_dir = report_storage_dir(project_id, report_id)
    out: Dict[str, Any] = {"fileUrlXlsx": None, "fileUrlPdf": None}

    if format in ("XLSX", "BOTH"):
        xlsx_path = os.path.join(storage_dir, "concentrado.xlsx")
        # Import local para evitar import circular si pdf_ebook_writer importa massive_report.
        from app.services.reports.xlsx_writer import generar_xlsx as _gen_xlsx
        _gen_xlsx(snapshot, xlsx_path)
        out["fileUrlXlsx"] = relative_path(project_id, report_id, "concentrado.xlsx")

    if format in ("EBOOK", "BOTH", "PDF"):
        # 'PDF' es legacy -> log warning y tratar como EBOOK.
        if format == "PDF":
            logger.warning(
                "generar_reporte_masivo: format='PDF' recibido pero deprecado "
                "(IMPL-20260701-04). Se usara EBOOK en su lugar."
            )

        # Import local: pdf_ebook_writer importa matplotlib/reportlab pesados.
        from app.services.reports.pdf_ebook_writer import generar_ebook as _gen_ebook

        empresa_slug = _empresa_slug(snapshot.get("empresa") or "")
        fecha_str = snapshot.get("fecha") or datetime.utcnow().strftime("%Y-%m-%d")
        ebook_filename = f"EBOOK_{empresa_slug}_{fecha_str}.pdf"
        ebook_path = os.path.join(storage_dir, ebook_filename)

        _gen_ebook(snapshot, ebook_path)
        out["fileUrlPdf"] = relative_path(project_id, report_id, ebook_filename)
        logger.info(
            "EBOOK generado para proyecto=%s report=%s -> %s",
            project_id, report_id, ebook_filename,
        )

    return out


def run_generation_job(
    *,
    prisma_client: Any,
    project_id: str,
    report_id: str,
    format: str,
) -> None:
    """
    Job sincrono llamado desde FastAPI BackgroundTasks.
    Carga el proyecto, genera archivos y actualiza el ProjectReport.
    Captura TODAS las excepciones y las persiste en ProjectReport.errorMessage
    con status=FAILED.
    """
    try:
        # Marcar como PROCESSING.
        prisma_client.projectreport.update(
            where={"id": report_id},
            data={"status": "PROCESSING"},
        )

        project = prisma_client.project.find_unique(
            where={"id": project_id},
            include={
                "company": True,
                "workers": {
                    "include": {
                        "worker": True,
                        "event": {
                            "include": {"eventTests": True},
                        },
                    },
                },
            },
        )

        if project is None:
            raise ValueError(f"Proyecto no encontrado: {project_id}")

        snapshot = project_to_snapshot(project)
        paths = generar_reporte_masivo(snapshot, project_id, report_id, format)

        prisma_client.projectreport.update(
            where={"id": report_id},
            data={
                "status": "READY",
                "fileUrlXlsx": paths["fileUrlXlsx"],
                "fileUrlPdf": paths["fileUrlPdf"],
                "completedAt": datetime.utcnow(),
                "errorMessage": None,
            },
        )
    except Exception as exc:
        try:
            prisma_client.projectreport.update(
                where={"id": report_id},
                data={
                    "status": "FAILED",
                    "errorMessage": (str(exc) or "unknown")[:500],
                    "completedAt": datetime.utcnow(),
                },
            )
        except Exception:
            pass
        traceback.print_exc()