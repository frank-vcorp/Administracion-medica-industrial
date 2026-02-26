"""
Servicio de Generación de Reportes Masivos.
Convierte datos extraídos en reportes consolidados (Excel o PDF).

IMPL-20260225-02: Motor de Reportes con Excel y resúmenes PDF.
"""

import os
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class ReportService:
    """
    Servicio de generación de reportes consolidados.
    Soporta múltiples formatos: Excel, PDF resumido, JSON.
    """

    def __init__(self, output_dir: str = "/app/reports"):
        """
        Inicializa el servicio de reportes.
        
        Args:
            output_dir: Directorio donde se almacenan los reportes generados
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_excel_report(self, data_list: List[Dict[str, Any]], filename: str = None) -> dict:
        """
        Genera un reporte en formato Excel a partir de una lista de datos.
        
        Args:
            data_list: Lista de diccionarios con datos (ej. múltiples audiometrías)
            filename: Nombre del archivo (si no se proporciona, se genera automáticamente)
            
        Returns:
            dict con status, ruta del archivo y metadatos
        """
        try:
            import pandas as pd
            
            if not data_list:
                return {
                    "status": "error",
                    "message": "Lista de datos vacía"
                }
            
            # Generar nombre de archivo si no se proporciona
            if not filename:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"reporte_{timestamp}.xlsx"
            
            output_path = self.output_dir / filename
            
            # Convertir lista de diccionarios a DataFrame
            df = pd.DataFrame(data_list)
            
            # Crear archivo Excel con formato
            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                df.to_excel(writer, sheet_name="Datos", index=False)
                
                # Aplicar formato básico (opcional)
                try:
                    from openpyxl.styles import Font, PatternFill, Alignment
                    
                    worksheet = writer.sheets["Datos"]
                    
                    # Encabezados en negrita
                    for cell in worksheet[1]:
                        if cell.value:
                            cell.font = Font(bold=True)
                            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")
                            cell.alignment = Alignment(horizontal="center", vertical="center")
                    
                    # Auto-ajustar ancho de columnas
                    for column in worksheet.columns:
                        max_length = 0
                        column_letter = column[0].column_letter
                        for cell in column:
                            try:
                                if len(str(cell.value)) > max_length:
                                    max_length = len(str(cell.value))
                            except:
                                pass
                        adjusted_width = min(max_length + 2, 50)
                        worksheet.column_dimensions[column_letter].width = adjusted_width
                
                except Exception as e:
                    logger.warning(f"No se pudo aplicar formato: {e}")
            
            logger.info(f"✓ Reporte Excel generado: {output_path}")
            return {
                "status": "success",
                "message": "Reporte Excel generado correctamente",
                "output_file": str(output_path),
                "records_count": len(data_list),
                "format": "xlsx",
                "generated_at": datetime.now().isoformat(),
                "filename": filename
            }

        except ImportError:
            logger.error("pandas no está instalado")
            return {
                "status": "error",
                "message": "pandas no está disponible para generar Excel"
            }
        except Exception as e:
            logger.error(f"Error generando reporte Excel: {e}")
            return {
                "status": "error",
                "message": f"Error al generar reporte: {str(e)}"
            }

    def generate_json_report(self, data_list: List[Dict[str, Any]], filename: str = None) -> dict:
        """
        Genera un reporte en formato JSON.
        
        Args:
            data_list: Lista de diccionarios con datos
            filename: Nombre del archivo
            
        Returns:
            dict con status y ruta del archivo
        """
        try:
            if not filename:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"reporte_{timestamp}.json"
            
            output_path = self.output_dir / filename
            
            # Preparar estructura del reporte
            report_data = {
                "generated_at": datetime.now().isoformat(),
                "total_records": len(data_list),
                "records": data_list
            }
            
            # Escribir JSON
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✓ Reporte JSON generado: {output_path}")
            return {
                "status": "success",
                "message": "Reporte JSON generado correctamente",
                "output_file": str(output_path),
                "records_count": len(data_list),
                "format": "json",
                "generated_at": datetime.now().isoformat(),
                "filename": filename
            }

        except Exception as e:
            logger.error(f"Error generando reporte JSON: {e}")
            return {
                "status": "error",
                "message": f"Error al generar reporte: {str(e)}"
            }

    def generate_summary_report(self, data_list: List[Dict[str, Any]], title: str = "Reporte de Consolidación") -> dict:
        """
        Genera un resumen textual/HTML de los datos para PDF o visualización.
        
        Args:
            data_list: Lista de diccionarios con datos
            title: Título del reporte
            
        Returns:
            dict con status y contenido HTML del reporte
        """
        try:
            if not data_list:
                return {
                    "status": "error",
                    "message": "Lista de datos vacía"
                }
            
            # Construir HTML
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ color: #333; text-align: center; }}
        .info {{ background-color: #f0f0f0; padding: 10px; margin: 20px 0; border-radius: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th {{ background-color: #007bff; color: white; padding: 10px; text-align: left; }}
        td {{ padding: 8px; border-bottom: 1px solid #ddd; }}
        tr:hover {{ background-color: #f5f5f5; }}
        .footer {{ text-align: center; color: #666; margin-top: 30px; font-size: 0.9em; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <div class="info">
        <p><strong>Generado:</strong> {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>
        <p><strong>Total de registros:</strong> {len(data_list)}</p>
    </div>
    
    <table>
        <thead>
            <tr>
"""
            
            import html
            
            # Agregar encabezados
            if data_list:
                for key in data_list[0].keys():
                    html_content += f"                <th>{html.escape(str(key))}</th>\n"
            
            html_content += """            </tr>
        </thead>
        <tbody>
"""
            
            # Agregar filas de datos
            for record in data_list:
                html_content += "            <tr>\n"
                for value in record.values():
                    html_content += f"                <td>{html.escape(str(value))}</td>\n"
                html_content += "            </tr>\n"
            
            html_content += """        </tbody>
    </table>
    
    <div class="footer">
        <p>Reporte generado por AMI Sistema - Administración Médica Industrial</p>
        <p>© 2026 AMI Clínica</p>
    </div>
</body>
</html>
"""
            
            logger.info(f"✓ Resumen HTML generado para {len(data_list)} registros")
            return {
                "status": "success",
                "message": "Resumen generado correctamente",
                "format": "html",
                "records_count": len(data_list),
                "generated_at": datetime.now().isoformat(),
                "html_content": html_content
            }

        except Exception as e:
            logger.error(f"Error generando resumen: {e}")
            return {
                "status": "error",
                "message": f"Error al generar resumen: {str(e)}"
            }

    def batch_process(self, data_list: List[Dict[str, Any]], formats: List[str] = None) -> dict:
        """
        Genera múltiples formatos de reporte en una sola operación.
        
        Args:
            data_list: Lista de datos
            formats: Lista de formatos a generar (['excel', 'json', 'html'])
            
        Returns:
            dict con status y referencias a todos los archivos generados
        """
        if formats is None:
            formats = ["excel", "json", "html"]
        
        results = {
            "status": "success",
            "generated_files": {},
            "errors": []
        }
        
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            batch_id = f"batch_{timestamp}"
            
            if "excel" in formats:
                excel_result = self.generate_excel_report(
                    data_list,
                    filename=f"{batch_id}.xlsx"
                )
                if excel_result["status"] == "success":
                    results["generated_files"]["excel"] = excel_result["output_file"]
                else:
                    results["errors"].append(f"Excel: {excel_result.get('message')}")
            
            if "json" in formats:
                json_result = self.generate_json_report(
                    data_list,
                    filename=f"{batch_id}.json"
                )
                if json_result["status"] == "success":
                    results["generated_files"]["json"] = json_result["output_file"]
                else:
                    results["errors"].append(f"JSON: {json_result.get('message')}")
            
            if "html" in formats:
                html_result = self.generate_summary_report(data_list)
                if html_result["status"] == "success":
                    # Guardar HTML también
                    html_path = self.output_dir / f"{batch_id}.html"
                    with open(html_path, "w", encoding="utf-8") as f:
                        f.write(html_result["html_content"])
                    results["generated_files"]["html"] = str(html_path)
                else:
                    results["errors"].append(f"HTML: {html_result.get('message')}")
            
            results["batch_id"] = batch_id
            results["timestamp"] = datetime.now().isoformat()
            logger.info(f"✓ Batch de reportes generado: {batch_id}")
            
        except Exception as e:
            logger.error(f"Error en batch_process: {e}")
            results["status"] = "error"
            results["errors"].append(str(e))
        
        return results
