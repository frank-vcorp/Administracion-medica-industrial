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
    trabajadores_raw = project.workers or []
    empresa = (project.company.name if project.company else "")
    empresa_legal = (project.company.legalName if project.company else None) or empresa
    fecha = (
        project.get("startDate").strftime("%Y-%m-%d")
        if hasattr(project.startDate, "strftime")
        else str(project.startDate or "")[:10]
    )

    trabajadores = []
    for pw in trabajadores_raw:
        # FIX-20260706-15: pw es un ProjectWorker model (no dict).
        # Acceder a atributos en lugar de .get().
        worker = getattr(pw, "worker", None)
        if worker is None:
            continue
        # Evento medico del trabajador en este proyecto.
        event = getattr(pw, "event", None)

        estudios: Dict[str, Any] = {}
        if event is not None:
            event_tests = getattr(event, "eventTests", None) or []
            for et in event_tests:
                # FIX-20260706-15: et es un EventTest model, no dict.
                # Acceder a atributos directamente.
                tn = (getattr(et, "testNameSnapshot", None) or "").lower()
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

        # FIX-20260706-15: worker es un Worker model, no dict.
        nombre = f"{(getattr(worker, 'lastName', None) or '').strip()} {(getattr(worker, 'firstName', None) or '').strip()}".strip()
        sexo_attr = getattr(worker, "sexo", None)
        sexo = (sexo_attr or "").upper() if isinstance(sexo_attr, str) else ""
        trabajadores.append(
            {
                "folio": str(getattr(worker, "universalId", None) or getattr(worker, "id", ""))[:16],
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
        "id": getattr(project, "id", None),
        "empresa": empresa,
        "empresaLegal": empresa_legal,
        "fecha": fecha,
        "trabajadores": trabajadores,
    }


# --- Adaptadores EventTest -> dicts -----------------------------------------
# FIX-20260706-15: Prisma devuelve modelos (no dicts), usar getattr en vez de .get()

def _first_extracted(et) -> Dict[str, Any]:
    ed = getattr(et, "extractedData", None)
    if ed is None:
        return {}
    return ed  # Prisma Json field es dict-like


def _audiometria(et) -> Dict[str, Any]:
    ed = _first_extracted(et)
    od = getattr(ed, "oido_derecho", None) or {}
    oi = getattr(ed, "oido_izquierdo", None) or {}
    return {
        "dx": getattr(ed, "dx", None) or getattr(ed, "diagnostico", None) or "N/A",
        "oidoDerecho": getattr(ed, "oido_derecho_dx", None) or getattr(od, "umbral", None) or "N/A",
        "oidoIzquierdo": getattr(ed, "oido_izquierdo_dx", None) or getattr(oi, "umbral", None) or "N/A",
        "hbc": getattr(ed, "hbc_porcentaje", None) or getattr(ed, "hbc", None),
    }


def _espirometria(et) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "patron": getattr(ed, "patron", None) or getattr(ed, "interpretacion", None) or "N/A",
        "fvc": getattr(ed, "fvc", None),
        "tabaquismo": getattr(ed, "tabaquismo", None) or "N/A",
    }


def _rx_columna(et) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "escoliosis": getattr(ed, "escoliosis_grados", None) or getattr(ed, "escoliosis", None),
        "lordosis": getattr(ed, "lordosis_grados", None) or getattr(ed, "lordosis", None),
        "basculacion": getattr(ed, "basculacion_pelvica_cm", None) or getattr(ed, "basculacion", None),
        "valoracionPostural": getattr(ed, "valoracion_postural", None) or getattr(ed, "postura", None) or "N/A",
        "impresion": getattr(ed, "impresion_diagnostica", None) or getattr(ed, "impresion", None) or "N/A",
    }


def _rx_torax(et) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "impresion": getattr(ed, "impresion_diagnostica", None) or getattr(ed, "impresion", None) or "N/A",
    }


def _ecg(et) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "impresion": getattr(ed, "impresion_diagnostica", None) or getattr(ed, "impresion", None) or "N/A",
    }


def _campimetria(et) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "agudezaVisual": getattr(ed, "agudeza_visual", None) or getattr(ed, "agudezaVisual", None) or "N/A",
        "camposVisuales": getattr(ed, "campos_visuales", None) or getattr(ed, "camposVisuales", None) or "N/A",
        "discriminacionColor": getattr(ed, "discriminacion_color", None) or getattr(ed, "discriminacionColor", None) or "N/A",
    }


def _laboratorio(et) -> Dict[str, Any]:
    ed = _first_extracted(et)
    return {
        "folioLab": getattr(ed, "folio_lab", None) or getattr(ed, "folioLab", None) or "",
        "edad": getattr(ed, "edad", None) or "",
        "bh": {
            "hb": getattr(ed, "bh_hb", None),
            "mchb": getattr(ed, "bh_mchb", None),
            "chgm": getattr(ed, "bh_chgm", None),
            "leu": getattr(ed, "bh_leu", None),
            "pla": getattr(ed, "bh_pla", None),
        },
        "qs6": {
            "gluc": getattr(ed, "qs_glucosa", None),
            "bun": getattr(ed, "qs_bun", None),
            "urea": getattr(ed, "qs_urea", None),
            "creat": getattr(ed, "qs_creatinina", None),
            "au": getattr(ed, "qs_acido_urico", None),
            "col": getattr(ed, "qs_colesterol", None),
            "trig": getattr(ed, "qs_trigliceridos", None),
        },
        "ego": {
            "glc": getattr(ed, "ego_glucosa", None),
            "prot": getattr(ed, "ego_proteinas", None),
            "blo": getattr(ed, "ego_sangre", None),
            "bac": getattr(ed, "ego_bacterias", None) or "N/A",
            "cristales": getattr(ed, "ego_cristales", None) or "N/A",
        },
        "toxico": {
            "anfeta": getattr(ed, "tox_anfetaminas", None) or "N/A",
            "coca": getattr(ed, "tox_cocaina", None) or "N/A",
            "marihua": getattr(ed, "tox_marihuana", None) or "N/A",
            "opiac": getattr(ed, "tox_opiaceos", None) or "N/A",
            "metanf": getattr(ed, "tox_metanfetaminas", None) or "N/A",
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


async def run_generation_job(
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
        await prisma_client.projectreport.update(
            where={"id": report_id},
            data={"status": "PROCESSING"},
        )

        project = await prisma_client.project.find_unique(
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

        await prisma_client.projectreport.update(
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
            await prisma_client.projectreport.update(
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