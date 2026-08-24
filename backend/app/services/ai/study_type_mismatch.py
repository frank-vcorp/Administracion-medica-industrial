"""
SPEC-FIX-20260824-01: Detección estructurada de "documento incompatible con el
estudio seleccionado" (STUDY_TYPE_MISMATCH).

Caso: el usuario carga un PDF de un estudio (p.ej. Espirometría) dentro del
estudio de otro tipo (p.ej. Audiometría). El proveedor extractivo (M3, Gemini,
Featherless) responde con texto libre rechazando la extracción porque el
documento no es del tipo solicitado. Como ese rechazo NO es JSON, el parser
tolerante lanza `ValueError("Respuesta de X no es JSON válido: …")` y la UI
recibe el mensaje crudo del proveedor, exponiendo prompt/rechazo/stack al
usuario (FND-20260824-02).

Este módulo:
  1. Define `StudyTypeMismatchError`: excepción tipada que reemplaza al ValueError
     genérico cuando el rechazo del proveedor indica claramente un mismatch de
     modalidad. NO es transient → no dispara fallback a Gemini (FIX-20260812-12).
  2. Expone `detect_study_type_mismatch(response_text, selected_study_type)`:
     heurística CONSERVADORA y CONSciente DE NEGACIÓN (FIX-20260824-01 follow-up
     por QA-20260824-12 F-1) que devuelve `StudyTypeMismatchAssessment` sólo
     cuando (a) la respuesta contiene una señal de rechazo/refutación clara y
     (b) menciona en contexto AFIRMADO un tipo canónico diferente al
     seleccionado. Las menciones negadas de otros tipos NO se clasifican
     como `detected` (reducen el riesgo de falso positivo cuando el modelo
     describe qué NO es el documento sin afirmar qué es).

Privacidad y seguridad (FIX-20260824-01 §Protecciones):
  - El `provider_text` crudo (que puede contener prompt, paciente, PII o
    secretos si el modelo los repitió) sólo persiste en `provider_text` del
    `StudyTypeMismatchError` y en el log de servidor. NUNCA se serializa al
    frontend (la capa HTTP de `main.py` sólo expone `message` + códigos).
  - La heurística sólo lee el TEXTO DE RESPUESTA — no examina el prompt ni el
    archivo del paciente.
  - "Confianza baja" (sin mention clara de tipo) → `detectedStudyType=None` y
    el caller muestra mensaje genérico, NO afirma un tipo detectado que no es
    confiable.
  - El log de servidor NUNCA imprime el contenido de `provider_text`
    (sólo longitud y huella SHA-256 truncada — ver F-4 follow-up).

Este módulo NO modifica proveedores, prompts clínicos, calibraciones V3,
publicación, snapshots, migraciones, auth, DR7/MedGemma ni los gates de
prediagnóstico. Es código nuevo, reversible y aislado.

SPEC: context/SPECs/SPEC-FIX-20260824-01-STUDY-MISMATCH.md
DEC:  discovery/DECISIONS.md → DEC-20260824-01
FND:  discovery/FINDINGS.md  → FND-20260824-02
QA:  context/reviews/QA-20260824-12-FIX-STUDY-MISMATCH.md (F-1 IMPLEMENTATION_DEFECT)
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Tipos canónicos que el modelo podría mencionar al rechazar. Mantener
# sincronizado con DocumentClassification.tipo y EXTRACTION_PROVIDERS.
# Sólo strings literales — sin fuzzy matching ni stemming para no inventar
# detecciones.
# ---------------------------------------------------------------------------
CANONICAL_STUDY_TYPES: frozenset = frozenset({
    "Audiometria",
    "Audiometría",  # con tilde — modelos hispanohablantes
    "Espirometria",
    "Espirometría",
    "Laboratorio",
    "Rayos_X",
    "Rayos X",      # normalizado por el modelo
    "Campimetria",
    "Campimetría",
    "Electrocardiograma",
    "RiesgoCardiovascular",
})

# Mapeo normalizado → canónico sin tilde (lo que consume el resto del backend).
_NORMALIZED_STUDY_TYPE: dict = {
    "audiometria": "Audiometria",
    "audiometría": "Audiometria",
    "espirometria": "Espirometria",
    "espirometría": "Espirometria",
    "laboratorio": "Laboratorio",
    "rayos_x": "Rayos_X",
    "rayos x": "Rayos_X",
    "campimetria": "Campimetria",
    "campimetría": "Campimetria",
    "electrocardiograma": "Electrocardiograma",
    "riesgocardiovascular": "RiesgoCardiovascular",
}

# Nombres visibles para el usuario (con tildes y formato natural). Usados
# por `build_user_facing_message` para alinear el copy con el ejemplo de
# DEC-20260824-01 ("Audiometría", "Espirometría"). Mantener sincronizado
# con `CANONICAL_STUDY_TYPES`.
_DISPLAY_NAME: dict = {
    "Audiometria": "Audiometría",
    "Espirometria": "Espirometría",
    "Laboratorio": "Laboratorio",
    "Rayos_X": "Rayos X",
    "Campimetria": "Campimetría",
    "Electrocardiograma": "Electrocardiograma",
    "RiesgoCardiovascular": "Riesgo Cardiovascular",
}

# Alias explícitos en texto natural del rechazo (modelo puede decir
# "prueba de función pulmonar", "espirometría", "audiograma", etc.). Sólo
# aquellos con señal inequívoca de que el documento es de un TIPO diferente.
_TEXTUAL_TYPE_HINTS: dict = {
    # clave: substring a buscar (lowercase), valor: tipo canónico normalizado
    "espirometría": "Espirometria",
    "espirometria": "Espirometria",
    "spirometry": "Espirometria",
    "pulmonary function test": "Espirometria",
    "lung function test": "Espirometria",
    "estudio de función pulmonar": "Espirometria",
    "prueba de función pulmonar": "Espirometria",
    "prueba pulmonar": "Espirometria",
    "flujo respiratorio": "Espirometria",
    "audiometría": "Audiometria",
    "audiometria": "Audiometria",
    "audiograma": "Audiometria",
    "audiogram": "Audiometria",
    "prueba auditiva": "Audiometria",
    "hearing test": "Audiometria",
    "rayos x": "Rayos_X",
    "rayos_x": "Rayos_X",
    "radiografía": "Rayos_X",
    "radiografia": "Rayos_X",
    "radiograph": "Rayos_X",
    "radiología": "Rayos_X",
    "radiologia": "Rayos_X",
    "x-ray": "Rayos_X",
    "electrocardiograma": "Electrocardiograma",
    "ecg": "Electrocardiograma",
    "ekg": "Electrocardiograma",
    "electrocardiograph": "Electrocardiograma",
    "electrocardiografía": "Electrocardiograma",
    "campimetría": "Campimetria",
    "campimetria": "Campimetria",
    "campo visual": "Campimetria",
    "visual field": "Campimetria",
    "perimetría": "Campimetria",
    "laboratorio": "Laboratorio",
    "análisis de sangre": "Laboratorio",
    "analisis de sangre": "Laboratorio",
    "blood test": "Laboratorio",
    "biometría hemática": "Laboratorio",
    "química sanguínea": "Laboratorio",
    "quimica sanguinea": "Laboratorio",
    "riesgo cardiovascular": "RiesgoCardiovascular",
    "cardiovascular risk": "RiesgoCardiovascular",
    "escala de riesgo cardiovascular": "RiesgoCardiovascular",
}

# ---------------------------------------------------------------------------
# Señales de rechazo/refutación (ES + EN). El modelo suele usar alguna de
# estas cuando NO puede extraer del documento porque no es del tipo esperado.
# Mantener la lista conservadora: si la respuesta sólo contiene "no" sin más
# contexto, NO disparar mismatch (reducir falsos positivos).
# ---------------------------------------------------------------------------
_REFUSAL_SIGNALS: tuple = (
    # Español
    "no parece ser",
    "no parece un",
    "no corresponde a",
    "no corresponde al",
    "no es un documento de",
    "no es un estudio de",
    "no es un estudio",
    "no es el estudio",
    "no es la prueba",
    "no es este estudio",
    "no es de tipo",
    "no es un",
    "no es una",
    "este documento es",
    "el documento es",
    "el archivo es",
    "este archivo es",
    "el documento parece",
    "el archivo parece",
    "este documento parece",
    "parece ser un",
    "parece ser una",
    "parece ser el estudio",
    "parece corresponder",
    "no puedo extraer",
    "no puedo analizar",
    "no puedo procesar",
    "no es posible extraer",
    "no es posible procesar",
    "no es compatible con",
    "no es adecuado para",
    "no es apropiado para",
    "no es válido",
    "no es valido",
    "el documento no es",
    "el archivo no es",
    "este documento no es",
    "el tipo de documento",
    "el tipo de estudio",
    "tipo de prueba",
    "se trata de un",
    "se trata de una",
    "esto es un",
    "esto es una",
    "esto no es",
    "este no es",
    "tampoco es",
    "tampoco parece",
    "ni audiograma",
    "ni audiometría",
    "ni espirometría",
    "ni espiro",
    "ni radiografía",
    "ni rayos",
    "ni electrocardiograma",
    "ni ecg",
    "ni campimetría",
    # English
    "this document is",
    "this is not",
    "this isn't",
    "this isn't a",
    "this isn't an",
    "it isn't",
    "it is not",
    "this appears to be",
    "this seems to be",
    "the document is",
    "the file is",
    "i cannot extract",
    "i can't extract",
    "i cannot process",
    "i can't process",
    "cannot be extracted",
    "cannot be processed",
    "not a valid",
    "not a recognized",
    "is not a",
    "is not an",
    "isn't a",
    "isn't an",
    "does not appear to be",
    "doesn't appear to be",
    "is not the",
    "not the expected",
    "wrong study type",
    "study type mismatch",
    "not suitable for",
    "is not suitable",
    # QA-20260824-13 G-1: adverb + not (afirmaciones con énfasis negativo)
    "actually not",
    "really not",
    "just not",
    "simply not",
    "clearly not",
    "definitely not",
    # is + adverb + not
    "is actually not",
    "is really not",
    "is just not",
    "is clearly not",
)

# ---------------------------------------------------------------------------
# Marcadores de negación (QA-20260824-12 F-1). QA-20260824-12 reproduce que
# "This is not a radiografía; es una espirometría válida." con
# selected=Espirometria clasificaba erróneamente como Rayos_X porque el
# detector sólo buscaba la primera mention de tipo distinto al seleccionado,
# sin distinguir si esa mention aparecía bajo negación. La negación
# invierte la inferencia: una mention NEGADA de un tipo distinto significa
# "el documento NO es ese tipo" — NO es evidencia de mismatch.
#
# Mantener conservador: una mention se considera NEGADA sólo si una
# FRASE de negación termina dentro de los últimos 5 tokens previos a la
# mention. Esto evita falsos negativos del estilo "not ... <noun1>; ... <noun2>"
# donde la negación afecta sólo al noun1. Si no hay frase de negación
# cercana, se considera AFIRMADA (preservar la lectura del modelo).
# ---------------------------------------------------------------------------

# Frases de negación que "atan" al sustantivo siguiente. Cada entrada es
# una tupla de tokens en orden (lowercase, sin puntuación final). La frase
# debe terminar DENTRO de los últimos 5 tokens antes de la mention.
_NEGATION_PHRASES: tuple = (
    # English: 1 token
    ("not",),
    ("no",),
    ("never",),
    ("nunca",),
    ("isnt",),
    ("isn't",),
    ("arent",),
    ("aren't",),
    ("doesnt",),
    ("doesn't",),
    ("dont",),
    ("don't",),
    ("wont",),
    ("won't",),
    ("cant",),
    ("can't",),
    ("cannot",),
    # English: 2 tokens
    ("is", "not"),
    ("are", "not"),
    ("does", "not"),
    ("do", "not"),
    ("did", "not"),
    ("not", "a"),
    ("not", "an"),
    ("not", "the"),
    # English: 3 tokens
    ("is", "not", "a"),
    ("is", "not", "an"),
    ("is", "not", "the"),
    ("are", "not", "a"),
    ("are", "not", "an"),
    ("this", "is", "not"),
    ("it", "is", "not"),
    # English: 4 tokens
    ("this", "is", "not", "a"),
    ("this", "is", "not", "an"),
    ("this", "is", "not", "the"),
    ("it", "is", "not", "a"),
    ("it", "is", "not", "an"),
    # English: adverb + "not" (QA-20260824-13 G-1 cobertura adicional)
    ("actually", "not"),
    ("really", "not"),
    ("just", "not"),
    ("simply", "not"),
    ("clearly", "not"),
    ("definitely", "not"),
    # English: 5 tokens
    ("does", "not", "appear", "to", "be"),
    ("doesn't", "appear", "to", "be"),
    ("did", "not", "appear", "to", "be"),
    ("didn't", "appear", "to", "be"),
    # Español: 1 token
    ("no",),
    ("nunca",),
    ("tampoco",),
    ("ni",),
    ("jamas",),
    ("jamás",),
    # Español: 2 tokens
    ("no", "es"),
    ("no", "son"),
    ("no", "parece"),
    ("no", "puede"),
    ("no", "está"),
    ("no", "esta"),
    ("tampoco", "es"),
    ("tampoco", "parece"),
    # Español: 3 tokens
    ("no", "es", "un"),
    ("no", "es", "una"),
    ("no", "es", "el"),
    ("no", "es", "la"),
    ("no", "parece", "ser"),
    ("no", "parece", "un"),
    ("no", "parece", "una"),
    ("no", "puede", "ser"),
    ("no", "está", "siendo"),
    # Español: 4 tokens
    ("no", "parece", "ser", "un"),
    ("no", "parece", "ser", "una"),
    ("no", "es", "de", "tipo"),
    ("no", "es", "un", "estudio"),
    ("no", "es", "una", "prueba"),
    ("tampoco", "es", "un"),
    ("tampoco", "es", "una"),
    ("tampoco", "es", "el"),
    ("tampoco", "es", "la"),
    ("tampoco", "parece", "ser"),
    ("tampoco", "parece", "un"),
    ("tampoco", "parece", "una"),
)


@dataclass(frozen=True)
class StudyTypeMismatchAssessment:
    """
    Resultado del detector `detect_study_type_mismatch`.

    Attributes:
        is_mismatch: True si la heurística considera que el rechazo del
            proveedor indica claramente un documento de estudio diferente al
            seleccionado. False → el caller muestra mensaje genérico.
        selected_study_type: tipo seleccionado por el operador (eco del input).
        detected_study_type: tipo canónico normalizado que el rechazo
            menciona en contexto AFIRMADO; `None` cuando no hay mention
            afirmada de un tipo distinto (confianza baja o coincidencia con
            el seleccionado).
        provider_text: TEXTO CRUDO de la respuesta del proveedor (≤300 chars,
            igual al que ya trunca `M3VisionBase.call_m3` al construir el
            ValueError). NUNCA debe serializarse al frontend: sólo log de
            servidor y `audit` interno.
    """

    is_mismatch: bool
    selected_study_type: Optional[str]
    detected_study_type: Optional[str]
    provider_text: str


class StudyTypeMismatchError(Exception):
    """
    SPEC-FIX-20260824-01: Excepción tipada que reemplaza al ValueError genérico
    cuando el rechazo del proveedor extractivo indica claramente un documento
    de estudio diferente al seleccionado.

    Categoría de error:
      - NO es transient (a diferencia de 5xx/timeout/4xx persistente) → NO
        dispara fallback a Gemini (FIX-20260812-12). El dispatcher debe
        propagarla sin `_call_with_dispatch` fallback.
      - NO es auth (401/403) → NO se mapea a `ExtractionAuthError`.
      - Es un error de DOMINIO (input del operador incorrecto) que debe
        llegar al frontend como respuesta estructurada sanitizada.

    Attributes:
        selected_study_type: estudio que el operador eligió en la papeleta.
        detected_study_type: tipo canónico que el rechazo del proveedor
            indica; `None` cuando la detección no es confiable.
        provider: nombre del proveedor extractivo ("m3" | "gemini" |
            "featherless") que originó el rechazo.
        provider_text: TEXTO CRUDO del rechazo (≤300 chars). NUNCA debe
            serializarse al frontend.
        message: mensaje user-friendly ya redactado por la capa HTTP. Sólo se
            usa para logging/debug.
    """

    def __init__(
        self,
        *,
        selected_study_type: Optional[str],
        detected_study_type: Optional[str],
        provider: str,
        provider_text: str,
        message: str,
    ) -> None:
        super().__init__(message)
        self.selected_study_type = selected_study_type
        self.detected_study_type = detected_study_type
        self.provider = provider
        # Mantener una versión truncada del texto crudo para log/audit.
        # El caller debe cuidar de NO exponer este campo al frontend
        # (ver `sanitize_provider_text_for_log` para uso seguro en logs).
        self.provider_text = (provider_text or "")[:300]

    def __str__(self) -> str:  # noqa: D401 — override explícito
        return (
            f"[{self.provider}] STUDY_TYPE_MISMATCH "
            f"selected={self.selected_study_type!r} "
            f"detected={self.detected_study_type!r}"
        )


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

def _normalize_for_match(text: str) -> str:
    """Lower-case + colapsa whitespace + quita acentos del texto de respuesta.

    Mantener simple: NO eliminar puntuación (las señales de rechazo usan
    espacios como delimitador y los modelos pueden emitir "...no parece..."
    con puntos suspensivos). Sólo colapsamos whitespace.
    """
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _normalize_selected(selected: Optional[str]) -> Optional[str]:
    """Canoniza el estudio seleccionado para comparar con menciones."""
    if not selected:
        return None
    key = selected.strip().lower()
    return _NORMALIZED_STUDY_TYPE.get(key, selected)


# Mapa local para no contaminar el namespace.
_NORMALIZE: dict = _NORMALIZED_STUDY_TYPE


# ---------------------------------------------------------------------------
# Modificadores/adverbios que pueden interponerse entre la frase de negación
# y el sustantivo sin cambiar el sentido. Lista conservadora (sólo fillers
# que NO especifican el tipo) — QA-20260824-13 G-1 ("this is not a valid
# radiograph" donde "valid" se interpone entre "not a" y "radiograph").
# ---------------------------------------------------------------------------
_NEGATION_MODIFIERS: frozenset = frozenset({
    # Adjetivos "filler" (no especifican el tipo)
    "valid", "real", "mere", "simple", "proper", "complete",
    "actual", "ordinary", "common", "clear", "true", "false",
    # Adverbios que pueden preceder al verbo negado o al artículo
    "actually", "really", "quite", "just", "only", "simply",
    "exactly", "precisely", "presumably", "likely",
    "especially", "particularly", "definitely", "clearly",
    "obviously", "honestly", "apparently", "seemingly",
    "evidently", "supposedly",
})


def _is_negated_context(normalized_text: str, mention_pos: int) -> bool:
    """
    Determina si la mention en `mention_pos` aparece en contexto NEGADO
    (precedida por una frase de negación que TERMINA dentro de los últimos
    6 tokens previos, permitiendo ARTÍCULOS y MODIFICADORES interpuestos).

    QA-20260824-12 F-1: distingue menciones negadas ("This is not a
    radiograph; it is a valid spirometry") de afirmadas ("It's an ECG").

    QA-20260824-13 G-1 (cierre): el algoritmo anterior truncaba frases modales
    EN no contraídas ("does not appear to be an audiogram") porque la ventana
    de 5 tokens dejaba "does" fuera; y no reconocía modificadores interpuestos
    ("is not a valid radiograph" donde "valid" se interpone entre "not a" y
    "radiograph"). Cubre ahora:
      - Ventana de 6 tokens (cubre frases hasta 5 tokens + 1 artículo).
      - Stripping ITERATIVO de artículos/determinantes (1 slot típico) Y
        modificadores/adverbios filler (1-2 slots típicos) desde el final
        antes de comparar. Mantiene un set conservador de modificadores
        para evitar falsos positivos ("This is a real radiograph" sigue
        siendo AFIRMADO).
      - "does not appear to be an X" → strip "an" → 5-token phrase match.
      - "is not a valid X" → strip "valid" (modifier) → strip "a" (article)
        → 2-token phrase ("is", "not") match.

    Args:
        normalized_text: texto ya normalizado (lowercase + whitespace colapsado).
        mention_pos: posición de inicio de la mention dentro de `normalized_text`.

    Returns:
        True si la mention está precedida por una frase de negación que
        termina (antes de artículos/modificadores interpuestos)
        inmediatamente antes de la mention.
    """
    # Artículos/determinantes que pueden preceder a la mention sin romper
    # la ventana de negación. Si el último token es uno de estos, miramos
    # la frase ANTES del artículo.
    _ARTICLES: frozenset = frozenset({
        # English
        "a", "an", "the",
        # Español
        "un", "una", "el", "la", "los", "las",
        "este", "esta", "estos", "estas",
        "ese", "esa", "esos", "esas",
        "aquel", "aquella", "aquellos", "aquellas",
    })

    # Ventana 6 tokens (cubre frases de 5 tokens + 1 artículo final).
    window_start = max(0, mention_pos - 60)
    preceding = normalized_text[window_start:mention_pos]
    tokens = preceding.split()
    last_tokens = tokens[-6:] if len(tokens) >= 6 else tokens
    # Limpiar puntuación al final de cada token (mantener apostrophes de
    # contracciones como "it's" -> "its").
    cleaned = [t.strip(".,;:!?¿¡()[]{}\"`") for t in last_tokens]

    # Stripping ITERATIVO de artículos + modificadores desde el final.
    # Cubre patrones como:
    #   "X ... is not a valid"     → strip "valid" → strip "a"     → match
    #   "X ... does not appear to be an" → strip "an" → match
    # Conservador: max 3 iteraciones para evitar falsos positivos con
    # cláusulas largas.
    iterations = 0
    while cleaned and iterations < 3:
        last = cleaned[-1]
        if last in _ARTICLES or last in _NEGATION_MODIFIERS:
            cleaned = cleaned[:-1]
            iterations += 1
        else:
            break

    # Frases ordenadas por longitud DESC (preferir match largo).
    phrases_sorted = sorted(_NEGATION_PHRASES, key=len, reverse=True)
    for phrase in phrases_sorted:
        n = len(phrase)
        if n > len(cleaned):
            continue
        # La frase debe terminar EXACTAMENTE en el último token actual.
        if tuple(cleaned[-n:]) == phrase:
            return True
    return False


@dataclass(frozen=True)
class _TypeMentions:
    """Resultado del clasificador de menciones de tipo (interno, F-1)."""
    affirmed_others: frozenset  # tipos canónicos distintos al seleccionado, mencionados SIN negación
    affirmed_selected: bool     # el tipo seleccionado fue mencionado SIN negación
    negated_others: frozenset    # tipos canónicos distintos al seleccionado, mencionados CON negación
    negated_selected: bool       # el tipo seleccionado fue mencionado CON negación


def _collect_type_mentions(
    normalized_text: str, exclude: Optional[str]
) -> _TypeMentions:
    """
    Recorre todas las menciones de tipo (canónicas o por pista textual) en
    `normalized_text` y las clasifica según el contexto de negación.

    Algoritmo:
      1. Itera `_TEXTUAL_TYPE_HINTS` ordenado por longitud DESC (longest match
         primero, evita solapamiento "prueba" vs "prueba de función pulmonar").
      2. Para cada hint, encuentra TODAS las ocurrencias en el texto y
         clasifica cada una con `_is_negated_context`.
      3. Si un hint matchea, registra el canonical y SALTA la posición (para
         no duplicar con el recorrido canónico posterior).
      4. Itera los nombres canónicos literales y aplica la misma lógica.
    """
    exclude_norm = _normalize_selected(exclude)

    affirmed_others = set()
    negated_others = set()
    affirmed_selected = False
    negated_selected = False

    # Trackear posiciones ya cubiertas por hints largos para no recontar con
    # nombres canónicos más cortos solapados.
    covered_positions: set = set()

    # 1) Pistas textuales (longest match primero para reducir solapamientos).
    hints_sorted = sorted(
        _TEXTUAL_TYPE_HINTS.items(),
        key=lambda kv: len(kv[0]),
        reverse=True,
    )
    for needle, canonical in hints_sorted:
        start = 0
        while True:
            pos = normalized_text.find(needle, start)
            if pos == -1:
                break
            # Si esta posición está dentro de un match ya cubierto, saltar.
            if any(p <= pos < p + len(needle) for p in covered_positions):
                start = pos + len(needle)
                continue
            is_neg = _is_negated_context(normalized_text, pos)
            is_sel = (canonical == exclude_norm)
            if is_neg:
                if is_sel:
                    negated_selected = True
                else:
                    negated_others.add(canonical)
            else:
                if is_sel:
                    affirmed_selected = True
                else:
                    affirmed_others.add(canonical)
            covered_positions.add(pos)
            start = pos + len(needle)

    # 2) Nombres canónicos literales (con y sin tilde).
    for typed in CANONICAL_STUDY_TYPES:
        typed_lower = typed.lower()
        start = 0
        while True:
            pos = normalized_text.find(typed_lower, start)
            if pos == -1:
                break
            # Si esta posición ya está cubierta por un hint más largo, saltar.
            if any(p <= pos < p + len(typed_lower) for p in covered_positions):
                start = pos + len(typed_lower)
                continue
            canonical = _NORMALIZE.get(typed_lower, typed)
            is_neg = _is_negated_context(normalized_text, pos)
            is_sel = (canonical == exclude_norm)
            if is_neg:
                if is_sel:
                    negated_selected = True
                else:
                    negated_others.add(canonical)
            else:
                if is_sel:
                    affirmed_selected = True
                else:
                    affirmed_others.add(canonical)
            covered_positions.add(pos)
            start = pos + len(typed_lower)

    return _TypeMentions(
        affirmed_others=frozenset(affirmed_others),
        affirmed_selected=affirmed_selected,
        negated_others=frozenset(negated_others),
        negated_selected=negated_selected,
    )


def detect_study_type_mismatch(
    response_text: str,
    selected_study_type: Optional[str],
) -> StudyTypeMismatchAssessment:
    """
    Heurística CONSERVADORA y CONSciente DE NEGACIÓN para detectar si la
    respuesta del proveedor extractivo indica claramente que el documento
    NO corresponde al estudio seleccionado.

    QA-20260824-12 F-1 (follow-up): el detector original clasificaba como
    `detected` la primera mention de tipo canónico distinto al seleccionado,
    sin distinguir si estaba NEGADA ("This is not a radiografía") o
    AFIRMADA ("Es un electrocardiograma"). Esto producía falsos positivos
    cuando el modelo describía qué NO era el documento sin afirmar qué era.

    Reglas (todas deben cumplirse para `is_mismatch=True`):
      (a) Texto no vacío.
      (b) Al menos UNA señal de rechazo/refutación (`_REFUSAL_SIGNALS`).
      (c) Análisis de menciones:
          - Si hay mention AFIRMADA de un tipo distinto al seleccionado
            → mismatch, `detected` = ese tipo (confianza alta).
          - Si hay mention NEGADA del seleccionado (modelo dice "no es X"
            siendo X el seleccionado) y NO hay mention AFIRMADA de otro tipo
            → mismatch, `detected=None` (confianza baja: el modelo niega el
            seleccionado pero no afirma qué es).
          - Si todas las menciones de otros tipos están NEGADAS y el
            seleccionado aparece AFIRMADO → NO mismatch (el documento es el
            seleccionado; el modelo sólo niega otros tipos).
          - Si no hay menciones de tipo en absoluto → is_mismatch=True con
            `detected=None` (confianza baja, mensaje genérico).
          - Si todo lo anterior no aplica → is_mismatch=False.

    Args:
        response_text: texto crudo devuelto por el proveedor.
        selected_study_type: tipo canónico que el operador eligió al subir el
            archivo.

    Returns:
        StudyTypeMismatchAssessment. Si no aplica mismatch, is_mismatch=False.
    """
    text = response_text or ""
    if not text.strip():
        return StudyTypeMismatchAssessment(
            is_mismatch=False,
            selected_study_type=selected_study_type,
            detected_study_type=None,
            provider_text=text[:300],
        )

    normalized = _normalize_for_match(text)

    # Regla (b): al menos una señal de rechazo/refutación.
    has_refusal_signal = any(signal in normalized for signal in _REFUSAL_SIGNALS)
    if not has_refusal_signal:
        return StudyTypeMismatchAssessment(
            is_mismatch=False,
            selected_study_type=selected_study_type,
            detected_study_type=None,
            provider_text=text[:300],
        )

    mentions = _collect_type_mentions(normalized, selected_study_type)

    # Regla (c): análisis de menciones con conciencia de negación.

    # Caso 1: hay mention AFIRMADA de un tipo distinto al seleccionado.
    # Es la señal más fuerte de mismatch con tipo detectado confiable.
    if mentions.affirmed_others:
        detected = sorted(mentions.affirmed_others)[0]
        return StudyTypeMismatchAssessment(
            is_mismatch=True,
            selected_study_type=selected_study_type,
            detected_study_type=detected,
            provider_text=text[:300],
        )

    # Caso 2: modelo niega el seleccionado Y no hay affirmation de otro.
    # Mismatch pero confianza baja (no sabemos qué es el documento).
    if mentions.negated_selected and not mentions.affirmed_selected:
        return StudyTypeMismatchAssessment(
            is_mismatch=True,
            selected_study_type=selected_study_type,
            detected_study_type=None,
            provider_text=text[:300],
        )

    # Caso 3: modelo niega otros tipos Y afirma el seleccionado.
    # → El documento ES el seleccionado; NO mismatch. (F-1 cierre.)
    if (
        mentions.affirmed_selected
        and not mentions.negated_selected
        and not mentions.affirmed_others
    ):
        return StudyTypeMismatchAssessment(
            is_mismatch=False,
            selected_study_type=selected_study_type,
            detected_study_type=None,
            provider_text=text[:300],
        )

    # Caso 4: sólo menciones negadas de OTROS tipos (sin affirmations).
    # Mismatch con confianza baja (sabemos qué NO es, no qué es).
    if mentions.negated_others:
        return StudyTypeMismatchAssessment(
            is_mismatch=True,
            selected_study_type=selected_study_type,
            detected_study_type=None,
            provider_text=text[:300],
        )

    # Caso 5: no hay menciones de tipo en absoluto. Mismatch con confianza
    # baja (mensaje genérico).
    return StudyTypeMismatchAssessment(
        is_mismatch=True,
        selected_study_type=selected_study_type,
        detected_study_type=None,
        provider_text=text[:300],
    )


def extract_raw_response_text_from_value_error(err: ValueError) -> str:
    """
    SPEC-FIX-20260824-01: extrae el texto crudo que el proveedor devolvió
    (≤300 chars) a partir del `ValueError` lanzado por
    `M3VisionBase.call_m3` / `GeminiBase.call_gemini` /
    `FeatherlessVisionBase.call_featherless_vision`.

    Estrategia:
      1. `str(err)` contiene el patrón "Respuesta de X no es JSON válido: …"
         o "Respuesta de X no es JSON parseable: …".
      2. Buscamos el último ":" del mensaje y devolvemos lo que sigue,
         trimado y truncado. Si no hay ":", devolvemos el mensaje completo.

    Esta función es defensiva: si el ValueError no encaja con el formato
    esperado, devuelve el `str(err)` truncado — la heurística del detector
    rechazará el contenido (regla (a)) y no se clasificará como mismatch.
    """
    raw = str(err or "")
    if not raw:
        return ""
    # El formato canónico del proveedor incluye ": {text[:300]!r}" → el repr
    # viene con comillas. Devolvemos el texto crudo sin truncar manualmente
    # porque `detect_study_type_mismatch` ya aplica [:300].
    last_colon = raw.rfind(":")
    if last_colon == -1:
        return raw.strip()
    tail = raw[last_colon + 1 :].strip()
    # Quitar repr() simple si el ValueError usó `{!r}`.
    if len(tail) >= 2 and tail[0] in ("'", '"') and tail[-1] == tail[0]:
        tail = tail[1:-1]
    return tail


def sanitize_provider_text_for_log(provider_text: str) -> dict:
    """
    QA-20260824-12 F-4: helper para imprimir el `provider_text` en logs de
    servidor SIN filtrar contenido del modelo. Devuelve un dict seguro
    que sólo expone:

      - `len`: longitud del texto crudo (cuantificación; detecta respuestas
        anormalmente largas que puedan incluir PII/prompt repetido).
      - `sha256_16`: huella SHA-256 truncada a 16 hex chars (rastreabilidad
        entre logs — permite deduplicar/correlar sin exponer contenido).

    NUNCA incluir el `provider_text` (ni siquiera truncado) en el log:
    DEC-20260824-01 pide "auditoría/log seguro sin PII ni secretos". Un
    truncado a 80 chars aún podría contener PII del paciente si el modelo
    lo repitió ("Paciente: Juan Pé..."). Por seguridad, NO se incluye
    ningún fragmento del texto original.
    """
    raw = provider_text or ""
    sha = hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()[:16]
    return {
        "len": len(raw),
        "sha256_16": sha,
    }


def build_user_facing_message(
    selected_study_type: Optional[str],
    detected_study_type: Optional[str],
) -> str:
    """
    SPEC-FIX-20260824-01 §Objetivo + QA-20260824-12 F-5 (tildes):
    redacta el mensaje user-friendly en función de la confianza de la
    detección.

    Returns:
        - Si `detected_study_type` está presente (confianza alta):
            "Seleccionaste <selected_display>, pero el documento parece ser
             <detected_display>. Abre <detected_display> y vuelve a cargar
             el archivo."
        - Si `detected_study_type` es None (confianza baja):
            "El documento no parece corresponder al estudio seleccionado.
             Verifica el archivo y vuelve a intentarlo."

    Los nombres se mapean vía `_DISPLAY_NAME` (con tildes) para alinear con
    el ejemplo de DEC-20260824-01 ("Audiometría", "Espirometría"). Si el
    tipo no está en el mapa, se usa el string crudo (defensa).

    El caller (capa HTTP `main.py`) debe sanitizar aún más antes de enviar
    al frontend. Aquí asumimos que ya están canonizados.
    """
    sel_display = _DISPLAY_NAME.get(selected_study_type or "", selected_study_type or "el estudio actual")
    if detected_study_type and detected_study_type != selected_study_type:
        det_display = _DISPLAY_NAME.get(detected_study_type, detected_study_type)
        return (
            f"Seleccionaste {sel_display}, pero el documento parece ser "
            f"{det_display}. Abre {det_display} y vuelve a cargar el archivo."
        )
    return (
        "El documento no parece corresponder al estudio seleccionado. "
        "Verifica el archivo y vuelve a intentarlo."
    )