"""
Utilidades base para servicios de IA.
IMPL-20260225-01: Pipeline IA modular.
ARCH-20260519-13: FeatherlessVisionBase — base del frente extractivo Featherless + Qwen-VL.
"""

import os
import base64
import io
import mimetypes
import json
import re
import asyncio
from typing import Dict, Any, Optional
from pdf2image import convert_from_path

from .keys import key_resolver, KeyResolution, CANONICAL_PROVIDERS


def _read_env_var(key: str) -> str | None:
    """ARCH-20260326-02: Normaliza variables con whitespace accidental. Respaldo: context/checkpoints/CHK_ARCH-20260326-02-GEMINI-ENV-NORMALIZATION.md."""
    value = os.getenv(key)
    if value:
        return value.strip()

    for env_key, env_value in os.environ.items():
        if env_key.strip() == key and env_value:
            return env_value.strip()

    return None


async def _resolve_key_for(provider: str) -> KeyResolution:
    """
    IMPL-20260809-06 — Resuelve la key de un proveedor vía key_resolver singleton.
    Si la flag AI_KEYS_FROM_DB_ENABLED está off (default), el resolver cae
    transparentemente a env vars y retorna source='env' (comportamiento idéntico
    al actual — sin cambio observable).
    """
    return await key_resolver.resolve(provider)


class GeminiBase:
    """Base class para interacción con Gemini API."""

    @staticmethod
    def _extract_openai_choice_text(choice: Any) -> str:
        """
        IMPL-20260603-01. Respaldo: context/SPECs/SPEC_FIX-20260603-04-FEATHERLESS-CONTENT-NORMALIZATION.md.
        Normaliza contenido OpenAI-compatible para soportar texto plano, bloques segmentados y objetos equivalentes.
        """
        if choice is None:
            return ""

        message = getattr(choice, "message", None)
        content = getattr(message, "content", None)
        fragments: list[str] = []

        def _collect_text(node: Any) -> None:
            if node is None:
                return

            if isinstance(node, str):
                stripped = node.strip()
                if stripped:
                    fragments.append(stripped)
                return

            if isinstance(node, list):
                for item in node:
                    _collect_text(item)
                return

            if isinstance(node, dict):
                for key in ("text", "content", "value", "parts"):
                    if key in node:
                        _collect_text(node.get(key))
                return

            for attr in ("text", "content", "value", "parts"):
                if hasattr(node, attr):
                    _collect_text(getattr(node, attr))

        _collect_text(content)
        return "\n".join(fragments).strip()

    @staticmethod
    def _sanitize_model_json_text(text: str) -> str:
        """
        IMPL-20260603-01. Respaldo: context/SPECs/SPEC_FIX-20260603-04-FEATHERLESS-CONTENT-NORMALIZATION.md.
        Remueve fences Markdown y tokens de relleno antes del parseo tolerante.
        """
        cleaned_text = text or ""
        cleaned_text = re.sub(r"^\s*(?:<pad>\s*)+", "", cleaned_text, flags=re.IGNORECASE)
        cleaned_text = cleaned_text.replace("```json", "").replace("```JSON", "")
        cleaned_text = cleaned_text.replace("```", "")
        cleaned_text = re.sub(r"(?:\s*<pad>\s*)+", " ", cleaned_text, flags=re.IGNORECASE)
        return cleaned_text.strip()

    @staticmethod
    def _tolerant_json_parse(text: str) -> Dict[str, Any]:
        """
        Parseo tolerante de JSON: intenta recuperar respuestas de modelo con texto extra
        o cierres faltantes. Si falla, lanza ValueError informativo.
        IMPL-20260326-03 — sin dependencias externas.
        """
        # Intento directo
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Intento extrayendo primer { ... último } para ignorar texto extra al final
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

        raise ValueError(f"Respuesta del modelo no es JSON parseable: {text[:300]!r}")
    
    def __init__(self, api_key: str = None, model: str = "gemini-2.5-flash"):
        # IMPL-20260809-06 — ARCH-20260809-03:
        # Mantenemos el patrón legacy (api_key=... or env var) en __init__ para
        # no romper callers existentes y tests. La rotación real ocurre en
        # `_refresh_keys()` al inicio de cada call_* (si la flag está activa).
        # Cuando AI_KEYS_FROM_DB_ENABLED=false (default), este __init__ ya
        # tiene la key válida de env var y `_refresh_keys` no la cambia.
        self.api_key = api_key or _read_env_var("GEMINI_API_KEY") or ""
        self.model = model
        self.key_source: str = "env"
        self.key_resolution_warning: Optional[str] = None
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY no configurada")

    def _refresh_keys(self) -> None:
        """
        IMPL-20260809-06 — Si el flag AI_KEYS_FROM_DB_ENABLED está activo,
        relee la key vía resolver singleton (caché TTL). Con flag off,
        no-op — comportamiento idéntico al actual.

        FIX-20260810-06: lectura sincrónica de la caché TTL
        (`resolve_sync_cached`). El patrón anterior
        (`run_coroutine_threadsafe(...).result()` contra el loop corriente)
        DEADLOCKeaba cuando call_gemini corría en el hilo del event loop
        (handler async → pipeline sync): 5s de bloqueo + TimeoutError tragado
        → siempre env var. La caché se pre-calienta en la frontera async
        (`await key_resolver.resolve(...)` en el handler). Ver
        DICTAMEN_FIX-20260810-06.
        """
        from .keys import is_ai_keys_from_db_enabled
        if not is_ai_keys_from_db_enabled():
            # flag off: el resolver devolvería source='env', warning='flag_off'.
            self.key_source = "env"
            self.key_resolution_warning = "flag_off"
            return

        # Flag on: lectura sync de la caché TTL (nunca bloquear el loop).
        resolution = key_resolver.resolve_sync_cached("gemini")
        if resolution is None:
            # Caché fría (la frontera async no pre-calentó): conservar la
            # key de env var del __init__ (comportamiento legacy).
            self.key_source = "env"
            self.key_resolution_warning = "cache_cold"
            return
        self.api_key = resolution.api_key
        self.model = resolution.default_model or self.model
        self.key_source = resolution.source
        self.key_resolution_warning = resolution.warning
    
    def get_b64_content(self, file_path: str) -> str:
        """
        Convierte archivo (imagen o PDF) a base64.
        Los PDFs se convierten a JPEG en primera página.
        """
        mime_type, _ = mimetypes.guess_type(file_path)
        
        if mime_type == 'application/pdf' or file_path.lower().endswith('.pdf'):
            try:
                print(f"📄 Convirtiendo PDF a Imagen: {file_path}")
                pages = convert_from_path(file_path, first_page=1, last_page=1)
                if pages:
                    img_byte_arr = io.BytesIO()
                    pages[0].save(img_byte_arr, format='JPEG')
                    return base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
            except Exception as e:
                print(f"⚠️ PDF Conversion Error: {e}")
                raise
        
        # Lectura estándar de imagen
        with open(file_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def call_gemini(self, local_path: str, prompt: str) -> Dict[str, Any]:
        """
        Llama a Gemini API con imagen y retorna JSON parseado.

        IMPL-20260809-06: invoca `_refresh_keys()` al inicio para que la rotación
        de keys en BD tome efecto sin reinicio (cuando AI_KEYS_FROM_DB_ENABLED=true).
        """
        self._refresh_keys()
        import requests
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        b64_data = self.get_b64_content(local_path)
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": b64_data
                        }
                    }
                ]
            }]
        }
        
        try:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=(10, 60)  # 10s connect, 60s read timeout
            )
            response.raise_for_status()
            data = response.json()
            
            candidates = data.get('candidates', [])
            if not candidates:
                raise ValueError(f"Gemini API no devolvió candidatos: {data}")
                
            text_resp = (
                candidates[0]
                .get('content', {})
                .get('parts', [])[0]
                .get('text', '')
            )
            text_resp = text_resp.replace('```json', '').replace('```', '').strip()
            
            try:
                return GeminiBase._tolerant_json_parse(text_resp)
            except ValueError as e:
                print(f"❌ Error parseando JSON de Gemini: {text_resp}")
                raise ValueError(f"Respuesta de Gemini no es JSON válido: {e}")
        except Exception as e:
            print(f"❌ Gemini Error: {e}")
            raise


# ---------------------------------------------------------------------------
# ARCH-20260519-13: FeatherlessVisionBase — frente extractivo Featherless + Qwen-VL
#
# Clasificador (DocumentClassifierService) y extractor (ExtractorService) heredan
# de esta clase. La capa clínica (PrediagnosticService) sigue en GeminiBase / Featherless
# a través de _call_featherless_text_only — separada de FEATHERLESS_EXTRACTION_MODEL.
#
# Respaldo: context/SPECs/SPEC_ARCH-20260519-13-EXTRACCION-MULTIMODAL-FEATHERLESS-QWEN-VL.md
# ---------------------------------------------------------------------------

class FeatherlessVisionBase:
    """
    Base para el frente extractivo visual de Featherless.
    ARCH-20260519-13: Gemini no participa en clasificación ni extracción documental.

    Variables de entorno consumidas (NO mezclar con la capa clínica):
      FEATHERLESS_API_KEY             — token compartido del tenant Featherless
      FEATHERLESS_BASE_URL            — endpoint compatible OpenAI (default: https://api.featherless.ai/v1)
      FEATHERLESS_EXTRACTION_MODEL    — modelo visual inicial: Qwen/Qwen3-VL-30B-A3B-Instruct
    """

    @staticmethod
    def _tolerant_json_parse(text: str) -> Dict[str, Any]:
        """Parseo tolerante de JSON. Estrategia idéntica a GeminiBase."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

        raise ValueError(
            f"Respuesta de Featherless no es JSON parseable: {text[:300]!r}"
        )

    def __init__(
        self,
        api_key: str = None,
        base_url: str = None,
        model: str = None,
    ):
        """
        Args:
            api_key:  FEATHERLESS_API_KEY. Si None, lee de env. Sin validación estricta
                      para permitir instancias de test con mocks.
            base_url: Base URL API Featherless (compatible OpenAI).
            model:    Modelo visual a invocar.

        IMPL-20260809-06: Misma estrategia que GeminiBase — `__init__` mantiene
        comportamiento legacy; `_refresh_keys()` consulta el resolver en cada
        call_* cuando el flag está activo.
        """
        self.api_key = api_key or _read_env_var("FEATHERLESS_API_KEY") or ""
        self.base_url = (
            base_url
            or _read_env_var("FEATHERLESS_BASE_URL")
            or "https://api.featherless.ai/v1"
        )
        self.model = (
            model
            or _read_env_var("FEATHERLESS_EXTRACTION_MODEL")
            or "Qwen/Qwen3-VL-30B-A3B-Instruct"
        )
        self.key_source: str = "env"
        self.key_resolution_warning: Optional[str] = None

    def _refresh_keys(self) -> None:
        """
        IMPL-20260809-06 — Mismo patrón que GeminiBase. No-op si flag off.
        Featherless NO está habilitado actualmente (ARCH-20260519-15 rollback);
        la fila BD nunca existirá para provider='featherless', pero la lógica es
        simétrica para futuro revival.
        """
        from .keys import is_ai_keys_from_db_enabled
        if not is_ai_keys_from_db_enabled():
            self.key_source = "env"
            self.key_resolution_warning = "flag_off"
            return
        try:
            try:
                loop = asyncio.get_running_loop()
                resolution = asyncio.run_coroutine_threadsafe(
                    key_resolver.resolve("featherless"), loop
                ).result(timeout=5)
            except RuntimeError:
                resolution = asyncio.run(key_resolver.resolve("featherless"))
            if resolution.api_key:
                self.api_key = resolution.api_key
            if resolution.base_url:
                self.base_url = resolution.base_url
            if resolution.default_model:
                self.model = resolution.default_model
            self.key_source = resolution.source
            self.key_resolution_warning = resolution.warning
        except Exception as e:
            self.key_source = "env"
            self.key_resolution_warning = f"refresh_error:{type(e).__name__}"

    def get_b64_jpeg(self, file_path: str) -> str:
        """
        Convierte un archivo (imagen o PDF) a base64 JPEG.
        Los PDFs se convierten a JPEG de primera página antes de codificar.
        """
        mime_type, _ = mimetypes.guess_type(file_path)

        if mime_type == "application/pdf" or file_path.lower().endswith(".pdf"):
            try:
                print(f"📄 Convirtiendo PDF a imagen: {file_path}")
                pages = convert_from_path(file_path, first_page=1, last_page=1)
                if pages:
                    img_byte_arr = io.BytesIO()
                    pages[0].save(img_byte_arr, format="JPEG")
                    return base64.b64encode(img_byte_arr.getvalue()).decode("utf-8")
            except Exception as e:
                print(f"⚠️ PDF conversion error: {e}")
                raise

        with open(file_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")

    def call_featherless_vision(self, file_path: str, prompt: str) -> Dict[str, Any]:
        """
        Llama a Featherless con imagen + prompt y retorna JSON parseado.
        ARCH-20260519-13: único punto de entrada al proveedor extractivo visual.

        IMPL-20260809-06: refresca keys vía resolver al inicio.

        Protocolo:
          - Convierte el archivo a base64 JPEG.
          - Llama al modelo con content multimodal (texto + image_url base64).
          - Parsea la respuesta como JSON con tolerancia a texto extra.

        Raises:
            RuntimeError: Si openai SDK no está instalado.
            Exception:    Si Featherless devuelve error HTTP o la respuesta no es JSON.
        """
        self._refresh_keys()
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "openai SDK no instalado. Ejecuta: pip install openai>=1.0"
            ) from exc

        client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        b64_data = self.get_b64_jpeg(file_path)

        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{b64_data}"
                                },
                            },
                        ],
                    }
                ],
                temperature=0.1,
                max_tokens=4096,
            )
        except Exception as e:
            print(f"❌ Featherless Vision Error: {e}")
            raise

        # IMPL-20260603-01. Respaldo: context/SPECs/SPEC_FIX-20260603-04-FEATHERLESS-CONTENT-NORMALIZATION.md.
        raw_text = GeminiBase._sanitize_model_json_text(
            GeminiBase._extract_openai_choice_text(
                response.choices[0] if response.choices else None
            )
        )
        if not raw_text:
            raise ValueError("Respuesta Featherless vacia o sin bloques de texto recuperables")

        try:
            return FeatherlessVisionBase._tolerant_json_parse(raw_text)
        except ValueError as e:
            print(f"❌ Error parseando JSON de Featherless: {raw_text[:300]!r}")
            raise ValueError(f"Respuesta de Featherless no es JSON válido: {e}") from e


# ---------------------------------------------------------------------------
# ARCH-20260809-02: M3VisionBase — frente extractivo MiniMax M3 (OpenAI-compatible)
#
# Sigue el patrón de FeatherlessVisionBase: cliente OpenAI SDK, content
# multimodal con image_url base64, temperature=0.1, max_tokens=4096, y
# reutilización de los helpers de GeminiBase para parseo tolerante.
# Solo se invoca desde el dispatcher de ExtractorService (con fallback a
# Gemini ante 5xx/timeout/4xx-persistente). No reemplaza la firma pública
# de call_featherless_vision ni call_gemini.
#
# Respaldo: context/SPECs/SPEC_ARCH-20260809-02-SELECTOR-EXTRACCION-MULTI-PROVEEDOR.md
# ---------------------------------------------------------------------------

class M3VisionBase:
    """
    Base para el frente extractivo visual de MiniMax M3 (OpenAI-compatible).
    ARCH-20260809-02: cliente paralelo a FeatherlessVisionBase para el
    segundo proveedor de extracción. La capa clínica sigue con MedGemma/DR7.

    Variables de entorno consumidas (NO mezclar con la capa clínica):
      M3_API_KEY        — token del plan Pro para MiniMax M3.
      M3_BASE_URL       — endpoint OpenAI-compatible (default: https://api.minimax.io/v1).
      M3_DEFAULT_MODEL  — modelo default (default: MiniMax-M3).
    """

    @staticmethod
    def _tolerant_json_parse(text: str) -> Dict[str, Any]:
        """Parseo tolerante de JSON. Estrategia idéntica a GeminiBase/FeatherlessVisionBase."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

        raise ValueError(
            f"Respuesta de M3 no es JSON parseable: {text[:300]!r}"
        )

    def __init__(
        self,
        api_key: str = None,
        base_url: str = None,
        model: str = None,
    ):
        """
        Args:
            api_key:  M3_API_KEY. Si None, lee de env. Sin validación estricta
                      para permitir instancias de test con mocks.
            base_url: Base URL API M3 (compatible OpenAI).
            model:    Modelo visual a invocar.

        IMPL-20260809-06: Misma estrategia que GeminiBase/FeatherlessVisionBase.
        `__init__` mantiene el patrón legacy (api_key=... or env var). La rotación
        runtime ocurre en `_refresh_keys()` cuando AI_KEYS_FROM_DB_ENABLED=true.
        """
        self.api_key = api_key or _read_env_var("M3_API_KEY") or ""
        self.base_url = (
            base_url
            or _read_env_var("M3_BASE_URL")
            or "https://api.minimax.io/v1"
        )
        self.model = (
            model
            or _read_env_var("M3_DEFAULT_MODEL")
            or "MiniMax-M3"
        )
        self.key_source: str = "env"
        self.key_resolution_warning: Optional[str] = None

    def _refresh_keys(self) -> None:
        """
        IMPL-20260809-06 — Refresca keys vía resolver. No-op si flag off.

        FIX-20260810-06: lectura sincrónica de la caché TTL
        (`resolve_sync_cached`). El patrón anterior
        (`run_coroutine_threadsafe(...).result()` contra el loop corriente)
        DEADLOCKeaba cuando call_m3 corría en el hilo del event loop
        (handler async → dispatcher sync): 5s de bloqueo + TimeoutError
        tragado → siempre env var (vacía en prod con key en BD). La caché
        se pre-calienta en la frontera async. Ver DICTAMEN_FIX-20260810-06.
        """
        from .keys import is_ai_keys_from_db_enabled
        if not is_ai_keys_from_db_enabled():
            self.key_source = "env"
            self.key_resolution_warning = "flag_off"
            return
        resolution = key_resolver.resolve_sync_cached("m3")
        if resolution is None:
            # Caché fría (la frontera async no pre-calentó): conservar
            # valores de env var del __init__ (comportamiento legacy).
            self.key_source = "env"
            self.key_resolution_warning = "cache_cold"
            return
        if resolution.api_key:
            self.api_key = resolution.api_key
        if resolution.base_url:
            self.base_url = resolution.base_url
        if resolution.default_model:
            self.model = resolution.default_model
        self.key_source = resolution.source
        self.key_resolution_warning = resolution.warning

    def get_b64_jpeg(self, file_path: str) -> str:
        """
        Convierte un archivo (imagen o PDF) a base64 JPEG.
        Los PDFs se convierten a JPEG de primera página antes de codificar.
        Reutiliza exactamente la misma estrategia que FeatherlessVisionBase.
        """
        mime_type, _ = mimetypes.guess_type(file_path)

        if mime_type == "application/pdf" or file_path.lower().endswith(".pdf"):
            try:
                print(f"📄 Convirtiendo PDF a imagen: {file_path}")
                pages = convert_from_path(file_path, first_page=1, last_page=1)
                if pages:
                    img_byte_arr = io.BytesIO()
                    pages[0].save(img_byte_arr, format="JPEG")
                    return base64.b64encode(img_byte_arr.getvalue()).decode("utf-8")
            except Exception as e:
                print(f"⚠️ PDF conversion error: {e}")
                raise

        with open(file_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")

    def call_m3(self, file_path: str, prompt: str) -> Dict[str, Any]:
        """
        Llama a MiniMax M3 con imagen + prompt y retorna JSON parseado.
        ARCH-20260809-02: único punto de entrada al proveedor M3.

        IMPL-20260809-06: refresca keys vía resolver al inicio.

        Protocolo:
          - Convierte el archivo a base64 JPEG.
          - Llama al modelo con content multimodal (texto + image_url base64).
          - Parsea la respuesta como JSON con tolerancia a texto extra.

        Raises:
            RuntimeError: Si openai SDK no está instalado.
            Exception:    Si M3 devuelve error HTTP o la respuesta no es JSON.
            No devuelve dict vacío ante fallo — propaga la excepción para que
            el dispatcher de ExtractorService decida si dispara fallback a Gemini.
        """
        self._refresh_keys()
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "openai SDK no instalado. Ejecuta: pip install openai>=1.0"
            ) from exc

        client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        b64_data = self.get_b64_jpeg(file_path)

        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{b64_data}"
                                },
                            },
                        ],
                    }
                ],
                temperature=0.1,
                max_tokens=4096,
            )
        except Exception as e:
            # IMPL-20260809-04 PRIVACIDAD: nunca loguear M3_API_KEY ni tokens.
            print(f"❌ M3 Vision Error: {type(e).__name__}")
            raise

        # Reutiliza los helpers de GeminiBase (mismo formato OpenAI-compatible).
        raw_text = GeminiBase._sanitize_model_json_text(
            GeminiBase._extract_openai_choice_text(
                response.choices[0] if response.choices else None
            )
        )
        if not raw_text:
            raise ValueError("Respuesta M3 vacía o sin bloques de texto recuperables")

        try:
            return M3VisionBase._tolerant_json_parse(raw_text)
        except ValueError as e:
            print(f"❌ Error parseando JSON de M3: {raw_text[:300]!r}")
            raise ValueError(f"Respuesta de M3 no es JSON válido: {e}") from e
