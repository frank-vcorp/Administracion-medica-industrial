"""
IMPL-20260630-03: Endpoints FastAPI para reportes masivos por proyecto.
ARCH-20260623-01: Modulo de Reportes Masivos.

Prefijo: /api/v2/projects/{project_id}/reports
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse

from app.services.reports.massive_report import (
    UPLOAD_DIR,
    run_generation_job,
)


router = APIRouter(
    prefix="/api/v2/projects/{project_id}/reports",
    tags=["project-reports"],
)


# Prisma client se inyecta desde main.py al levantar la app.
# Para que funcione en tests sin inicializar Prisma real, exponemos un hook.
_prisma_client = None


def set_prisma_client(client) -> None:
    global _prisma_client
    _prisma_client = client


def _require_prisma():
    if _prisma_client is None:
        raise HTTPException(status_code=503, detail="Prisma no inicializado")
    return _prisma_client


def _serialize_report(report) -> dict:
    return {
        "id": report.id,
        "projectId": report.projectId,
        "format": report.format,
        "status": report.status,
        "fileUrlXlsx": report.fileUrlXlsx,
        "fileUrlPdf": report.fileUrlPdf,
        "errorMessage": report.errorMessage,
        "generatedById": report.generatedById,
        "generatedAt": report.generatedAt.isoformat() if report.generatedAt else None,
        "completedAt": report.completedAt.isoformat() if report.completedAt else None,
    }


@router.post("/massive")
async def create_massive_report(
    project_id: str,
    background_tasks: BackgroundTasks,
    format: str = Query(..., pattern="^(XLSX|PDF|BOTH)$"),
    generatedById: str = Query(..., description="User ID que solicita el reporte"),
):
    """Crea un ProjectReport en PENDING y dispara generacion asincrona."""
    prisma = _require_prisma()

    project = prisma.project.find_unique(where={"id": project_id})
    if project is None:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    report = prisma.projectreport.create(
        data={
            "projectId": project_id,
            "format": format,
            "status": "PENDING",
            "generatedById": generatedById,
        }
    )

    background_tasks.add_task(
        run_generation_job,
        prisma_client=prisma,
        project_id=project_id,
        report_id=report.id,
        format=format,
    )

    return _serialize_report(report)


@router.get("")
async def list_project_reports(project_id: str):
    """Lista el historial de reportes del proyecto, ordenados por fecha desc."""
    prisma = _require_prisma()
    reports = prisma.projectreport.find_many(
        where={"projectId": project_id},
        order={"generatedAt": "desc"},
    )
    return [_serialize_report(r) for r in reports]


@router.get("/{report_id}")
async def get_report_status(project_id: str, report_id: str):
    """Retorna el estado actual del reporte (PENDING|PROCESSING|READY|FAILED)."""
    prisma = _require_prisma()
    report = prisma.projectreport.find_unique(where={"id": report_id})
    if report is None or report.projectId != project_id:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return _serialize_report(report)


@router.get("/{report_id}/download")
async def download_report(
    project_id: str,
    report_id: str,
    format: str = Query(..., pattern="^(xlsx|pdf)$"),
):
    """Sirve el archivo XLSX o PDF asociado al reporte."""
    prisma = _require_prisma()
    report = prisma.projectreport.find_unique(where={"id": report_id})
    if report is None or report.projectId != project_id:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    if report.status != "READY":
        raise HTTPException(status_code=409, detail=f"Reporte no listo (status={report.status})")

    rel_path = report.fileUrlXlsx if format == "xlsx" else report.fileUrlPdf
    if not rel_path:
        raise HTTPException(status_code=404, detail=f"Archivo {format} no disponible")

    # Defensa contra path traversal.
    if ".." in rel_path.split("/"):
        raise HTTPException(status_code=400, detail="Ruta invalida")

    full_path = os.path.realpath(os.path.join(UPLOAD_DIR, rel_path))
    upload_abs = os.path.realpath(UPLOAD_DIR)
    if not full_path.startswith(upload_abs + os.sep) and full_path != upload_abs:
        raise HTTPException(status_code=400, detail="Ruta invalida")

    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Archivo fisico no encontrado")

    media_type = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if format == "xlsx"
        else "application/pdf"
    )
    filename = os.path.basename(full_path)
    return FileResponse(
        path=full_path,
        media_type=media_type,
        filename=filename,
    )