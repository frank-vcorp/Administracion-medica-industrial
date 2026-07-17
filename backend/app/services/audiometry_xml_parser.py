"""
Parser de XML de audiómetro DD65 V2.
ARCH-20260715-06: Extracción directa de datos desde XML del audiómetro.

El audiómetro exporta archivos XML con estructura LocalSession que contiene:
- Datos del paciente (Patient)
- Sesiones con audiogramas (Sessions > Session > Actions > Action)
- Puntos de medición (TonePoint con Intensity1 y Freq1)

Los oídos se identifican por SignalOutput1 y SignalOutput2:
- ACL = Air Conduction Left
- ACR = Air Conduction Right
- BCL = Bone Conduction Left
- BCR = Bone Conduction Right

Si SignalOutput1=ACL → Oído Izquierdo (vía aérea)
Si SignalOutput1=ACR → Oído Derecho (vía aérea)
"""

import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional


def parse_audiometry_xml(xml_path: str) -> Dict[str, Any]:
    """
    Extrae datos de audiometría desde archivo XML del audiómetro.
    
    Args:
        xml_path: Ruta al archivo XML
        
    Returns:
        Dict con estructura compatible con AudiometriaData
        
    Raises:
        ValueError: Si el XML no tiene la estructura esperada
    """
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except ET.ParseError as e:
        raise ValueError(f"Error parseando XML: {e}")
    
    # Extraer datos del paciente
    patient_data = _extract_patient_data(root)
    
    # Extraer audiogramas
    oido_derecho = {"va": {}, "vo": {}}
    oido_izquierdo = {"va": {}, "vo": {}}
    
    # Buscar todos los TonePoint
    for tone_point in root.iter("TonePoint"):
        freq_elem = tone_point.find("Freq1")
        intensity_elem = tone_point.find("Intensity1")
        
        if freq_elem is None or intensity_elem is None:
            continue
            
        try:
            freq = int(freq_elem.text)
            intensity = int(intensity_elem.text)
        except (ValueError, TypeError):
            continue
        
        # Determinar oído y tipo de vía (aérea/ósea)
        # Necesitamos contexto del AudiogramOfTonePoint padre
        parent = _find_parent_audiogram(root, tone_point)
        if parent is None:
            continue
        
        signal_output1 = parent.find("MeasurementConditions/SignalOutput1")
        signal_output2 = parent.find("MeasurementConditions/SignalOutput2")
        
        if signal_output1 is None or signal_output2 is None:
            continue
        
        sig1 = signal_output1.text
        sig2 = signal_output2.text
        
        # Determinar si es vía aérea u ósea
        is_air = sig1 in ("ACL", "ACR")
        is_bone = sig1 in ("BCL", "BCR")
        
        # Determinar oído
        if sig1 == "ACR" or sig1 == "BCR":
            ear = oido_derecho
        elif sig1 == "ACL" or sig1 == "BCL":
            ear = oido_izquierdo
        else:
            continue
        
        # Asignar valor (corregir valores negativos imposibles)
        if intensity < 0:
            intensity = abs(intensity)  # -50 → 50 (error del audiómetro)
        
        if is_air:
            ear["va"][str(freq)] = intensity
        elif is_bone:
            ear["vo"][str(freq)] = intensity
    
    # Calcular PTA para cada oído
    pta_derecho = _calculate_pta(oido_derecho["va"])
    pta_izquierdo = _calculate_pta(oido_izquierdo["va"])
    
    # Construir frecuencias detectadas
    all_freqs = set()
    for ear in [oido_derecho, oido_izquierdo]:
        all_freqs.update(ear["va"].keys())
        all_freqs.update(ear["vo"].keys())
    
    frecuencias_detectadas = sorted(all_freqs, key=lambda f: int(f))
    
    # Calcular completitud documental
    max_freqs_per_ear = max(len(oido_derecho["va"]), len(oido_izquierdo["va"]))
    if max_freqs_per_ear >= 6:
        completitud_documental = "suficiente"
    elif max_freqs_per_ear >= 3:
        completitud_documental = "parcial"
    else:
        completitud_documental = "no_concluyente"
    
    result = {
        "oido_derecho": {
            "va": oido_derecho["va"],
            "vo": oido_derecho["vo"],
            "pta": pta_derecho
        },
        "oido_izquierdo": {
            "va": oido_izquierdo["va"],
            "vo": oido_izquierdo["vo"],
            "pta": pta_izquierdo
        },
        "frecuencias_detectadas": frecuencias_detectadas,
        "completitud_documental": completitud_documental,
        "notas_calidad": "Datos extraídos directamente desde XML del audiómetro DD65 V2. Valores exactos sin interpretación de IA."
    }
    
    # Agregar datos del paciente si están disponibles
    if patient_data:
        result.update(patient_data)
    
    return result


def _extract_patient_data(root: ET.Element) -> Dict[str, Any]:
    """Extrae datos del paciente del XML."""
    patient = root.find("Patient")
    if patient is None:
        return {}
    
    data = {}
    
    first_name = patient.find("FirstName")
    last_name = patient.find("LastName")
    if first_name is not None and last_name is not None:
        data["nombre_completo"] = f"{first_name.text} {last_name.text}"
    
    gender = patient.find("Gender")
    if gender is not None:
        data["sexo"] = gender.text
    
    birth_date = patient.find("BirthDate")
    if birth_date is not None and birth_date.text:
        data["fecha_nacimiento"] = birth_date.text
    
    return data


def _find_parent_audiogram(root: ET.Element, tone_point: ET.Element) -> Optional[ET.Element]:
    """
    Encuentra el AudiogramOfTonePoint padre de un TonePoint.
    ET no tiene método parent, así que buscamos recursivamente.
    """
    for audiogram in root.iter("AudiogramOfTonePoint"):
        points = audiogram.find("Points")
        if points is not None:
            for point in points.iter("TonePoint"):
                if point is tone_point:
                    return audiogram
    return None


def _calculate_pta(va: Dict[str, int]) -> Optional[int]:
    """
    Calcula PTA (Pure Tone Average) como promedio de 500, 1000, 2000 Hz.
    Si alguna frecuencia falta, retorna None.
    """
    required_freqs = ["500", "1000", "2000"]
    values = []
    
    for freq in required_freqs:
        if freq in va:
            values.append(va[freq])
    
    if len(values) == len(required_freqs):
        return round(sum(values) / len(values))
    
    return None
