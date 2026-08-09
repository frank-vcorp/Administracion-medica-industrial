"""
IMPL-20260809-09 — ARCH-20260809-05: Servicio de "Probar conexión" para
proveedores IA (Gemini, MiniMax M3, DR7/MedGemma).

Hace una llamada **real mínima** al endpoint del proveedor con prompt
trivial ("Hola", `max_tokens:16`) y timeout 12s. Reutiliza `KeyResolver.resolve`
para que el probe pruebe la key efectiva en producción (BD o env).

Política de privacidad:
  - NUNCA loguear la key en claro, el header Authorization, el ciphertext/nonce/tag,
    ni la URL con querystring `?key=` (Gemini manda la key en query — loguear sólo el path).
  - NUNCA exponer body de error del proveedor (puede contener eco de key).
  - Mensaje sanitizado con `_sanitize_error`.

Rate limit:
  - 1 probe por proveedor cada 30 s **por proceso** (dict in-memory `_last_probe_ts`).
  - Si se excede → 429 con `retryAfterSec`.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

import httpx

from app.services.ai.keys import KeyResolver, get_key_resolver

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate limit in-memory por proceso
# ---------------------------------------------------------------------------
_PROBE_RATE_LIMIT_SECONDS = 30
_last_probe_ts: Dict[str, float] = {}
_probe_rate_lock = asyncio.Lock()


async def _check_probe_rate_limit(provider: str) -> Tuple[bool, int]:
    """
    Retorna `(allowed, retry_after_sec)`.
    True si el probe puede proceder; False si acaba de haber uno en los últimos
    `_PROBE_RATE_LIMIT_SECONDS`.
    """
    async with _probe_rate_lock:
        now = time.monotonic()
        last = _last_probe_ts.get(provider)
        if last is not None:
            elapsed = now - last
            if elapsed < _PROBE_RATE_LIMIT_SECONDS:
                retry = int(_PROBE_RATE_LIMIT_SECONDS - elapsed) + 1
                return False, retry
        _last_probe_ts[provider] = now
        return True, 0


# ---------------------------------------------------------------------------
# Helpers de sanitización local (no loguear key ni URL con ?key=)
# ---------------------------------------------------------------------------
_GOOGLE_API_KEY_RE = __import__("re").compile(r"AIza[A-Za-z0-9_\-]{30,}")


def _redact_url(url: str) -> str:
    """Elimina querystring de URLs (Gemini manda la key en `?key=`)."""
    try:
        from urllib.parse import urlsplit
        parts = urlsplit(url)
        # Reconstruye sin query
        if parts.query:
            return f"{parts.scheme}://{parts.netloc}{parts.path}"
        return url
    except Exception:
        return "[URL_REDACTED]"


def _sanitize_message(msg: str, max_len: int = 200) -> str:
    """Trunca y redacta keys (Google-style AIza...) en mensajes de error."""
    if not msg:
        return ""
    clean = _GOOGLE_API_KEY_RE.sub("[API_KEY_REDACTED]", str(msg))
    return clean[:max_len]


# ---------------------------------------------------------------------------
# Tipos de error del probe
# ---------------------------------------------------------------------------
# Coinciden con la enumeración del frontend (`ProbeErrorKind` en types/ai-keys.ts).
ERROR_KIND_NOT_CONFIGURED = "not_configured"
ERROR_KIND_DECRYPT_ERROR = "decrypt_error"
ERROR_KIND_AUTH = "auth"
ERROR_KIND_TIMEOUT = "timeout"
ERROR_KIND_NETWORK = "network"
ERROR_KIND_HTTP_4XX = "http_4xx"
ERROR_KIND_HTTP_5XX = "http_5xx"
ERROR_KIND_PARSE = "parse"
ERROR_KIND_RATE_LIMITED = "rate_limited"
ERROR_KIND_UNKNOWN = "unknown"

PROBE_TIMEOUT_SECONDS = 12


# ---------------------------------------------------------------------------
# Implementación por proveedor
# ---------------------------------------------------------------------------
async def _probe_gemini(resolution, client: httpx.AsyncClient) -> Dict[str, Any]:
    """
    Gemini v1beta: POST {base}/v1beta/models/{model}:generateContent?key={API_KEY}
    """
    if not resolution.api_key:
        return {
            "ok": False,
            "errorKind": ERROR_KIND_NOT_CONFIGURED,
            "message": "GEMINI_API_KEY no configurada",
        }

    # Gemini no overridea base_url por AIProviderKey.baseUrl (oficial v1beta).
    base = "https://generativelanguage.googleapis.com"
    model = resolution.default_model or os.environ.get("GEMINI_MODEL_EXTRACTION") or "gemini-2.5-flash"
    url = f"{base}/v1beta/models/{model}:generateContent"
    log_url = _redact_url(f"{url}?key={resolution.api_key}")

    body = {
        "contents": [{"parts": [{"text": "Hola"}]}],
        "generationConfig": {"maxOutputTokens": 16, "temperature": 0},
    }

    started = time.monotonic()
    try:
        resp = await client.post(
            url,
            params={"key": resolution.api_key},
            json=body,
            timeout=PROBE_TIMEOUT_SECONDS,
        )
        latency_ms = int((time.monotonic() - started) * 1000)
        status = resp.status_code

        if status == 200:
            try:
                data = resp.json()
                text = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                if not text:
                    return {
                        "ok": False,
                        "errorKind": ERROR_KIND_PARSE,
                        "message": "Respuesta vacía del proveedor",
                        "httpStatus": status,
                        "latencyMs": latency_ms,
                    }
                return {
                    "ok": True,
                    "message": text[:50] or "Hola!!",
                    "httpStatus": status,
                    "latencyMs": latency_ms,
                }
            except Exception as e:
                return {
                    "ok": False,
                    "errorKind": ERROR_KIND_PARSE,
                    "message": _sanitize_message(f"JSON inválido: {e}"),
                    "httpStatus": status,
                    "latencyMs": latency_ms,
                }

        # Errores HTTP
        kind = ERROR_KIND_HTTP_5XX if 500 <= status < 600 else (
            ERROR_KIND_AUTH if status in (401, 403) else (
                ERROR_KIND_RATE_LIMITED if status == 429 else ERROR_KIND_HTTP_4XX
            )
        )
        message = {
            401: "No autorizado (401)",
            403: "Acceso denegado (403)",
            429: "Cuota agotada (429)",
        }.get(status, f"Error HTTP {status} del proveedor")
        return {
            "ok": False,
            "errorKind": kind,
            "message": message,
            "httpStatus": status,
            "latencyMs": latency_ms,
        }

    except httpx.TimeoutException:
        return {
            "ok": False,
            "errorKind": ERROR_KIND_TIMEOUT,
            "message": f"Timeout ({PROBE_TIMEOUT_SECONDS}s)",
        }
    except httpx.HTTPError as e:
        logger.warning("Gemini probe error: %s", _sanitize_message(type(e).__name__))
        return {
            "ok": False,
            "errorKind": ERROR_KIND_NETWORK,
            "message": "Error de red",
        }
    except Exception as e:
        logger.warning(
            "Gemini probe unexpected: %s",
            _sanitize_message(f"{type(e).__name__}: {e}"),
        )
        return {
            "ok": False,
            "errorKind": ERROR_KIND_UNKNOWN,
            "message": "Error inesperado",
        }


async def _probe_openai_compatible(
    provider_label: str, resolution, client: httpx.AsyncClient
) -> Dict[str, Any]:
    """
    Probe para proveedores OpenAI-compatible (M3 y DR7).
    POST {base_url}/chat/completions con Authorization Bearer.
    """
    if not resolution.api_key:
        return {
            "ok": False,
            "errorKind": ERROR_KIND_NOT_CONFIGURED,
            "message": f"{provider_label.upper()}_API_KEY no configurada",
        }

    base_url = resolution.base_url or "https://api.example.com/v1"
    # M3 / DR7 exponen /chat/completions al final del base_url.
    # DR7_BASE_URL ya apunta a /chat/completions; si lo trae, usarlo tal cual.
    url = base_url if base_url.rstrip("/").endswith("/chat/completions") else f"{base_url.rstrip('/')}/chat/completions"
    model = resolution.default_model or "unknown-model"
    log_url = _redact_url(url)

    body = {
        "model": model,
        "messages": [{"role": "user", "content": "Hola"}],
        "max_tokens": 16,
        "temperature": 0,
    }

    started = time.monotonic()
    try:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {resolution.api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=PROBE_TIMEOUT_SECONDS,
        )
        latency_ms = int((time.monotonic() - started) * 1000)
        status = resp.status_code

        if status == 200:
            try:
                data = resp.json()
                content = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                if not content:
                    return {
                        "ok": False,
                        "errorKind": ERROR_KIND_PARSE,
                        "message": "Respuesta vacía del proveedor",
                        "httpStatus": status,
                        "latencyMs": latency_ms,
                    }
                return {
                    "ok": True,
                    "message": content[:50] or "Hola!!",
                    "httpStatus": status,
                    "latencyMs": latency_ms,
                }
            except Exception as e:
                return {
                    "ok": False,
                    "errorKind": ERROR_KIND_PARSE,
                    "message": _sanitize_message(f"JSON inválido: {e}"),
                    "httpStatus": status,
                    "latencyMs": latency_ms,
                }

        kind = ERROR_KIND_HTTP_5XX if 500 <= status < 600 else (
            ERROR_KIND_AUTH if status in (401, 403) else (
                ERROR_KIND_RATE_LIMITED if status == 429 else ERROR_KIND_HTTP_4XX
            )
        )
        message = {
            401: "No autorizado (401)",
            403: "Acceso denegado (403)",
            429: "Cuota agotada (429)",
        }.get(status, f"Error HTTP {status} del proveedor")
        return {
            "ok": False,
            "errorKind": kind,
            "message": message,
            "httpStatus": status,
            "latencyMs": latency_ms,
        }

    except httpx.TimeoutException:
        return {
            "ok": False,
            "errorKind": ERROR_KIND_TIMEOUT,
            "message": f"Timeout ({PROBE_TIMEOUT_SECONDS}s)",
        }
    except httpx.HTTPError as e:
        logger.warning(
            "%s probe error: %s", provider_label, _sanitize_message(type(e).__name__)
        )
        return {
            "ok": False,
            "errorKind": ERROR_KIND_NETWORK,
            "message": "Error de red",
        }
    except Exception as e:
        logger.warning(
            "%s probe unexpected: %s",
            provider_label,
            _sanitize_message(f"{type(e).__name__}: {e}"),
        )
        return {
            "ok": False,
            "errorKind": ERROR_KIND_UNKNOWN,
            "message": "Error inesperado",
        }


# ---------------------------------------------------------------------------
# Punto de entrada público
# ---------------------------------------------------------------------------
async def probe_provider(provider: str) -> Dict[str, Any]:
    """
    Ejecuta un probe real al endpoint del proveedor. Retorna dict con:
      - ok: bool
      - provider: "m3" | "gemini" | "dr7"
      - message: str (sanitizado)
      - latencyMs: int (si ok=True)
      - httpStatus: int (si ok=True o HTTP 4xx/5xx)
      - errorKind: str (solo si ok=False)
      - rateLimited: bool (si rate limit interno)
      - retryAfterSec: int (si rate limited)
    """
    if provider not in ("gemini", "m3", "dr7"):
        return {
            "ok": False,
            "provider": provider,
            "errorKind": ERROR_KIND_UNKNOWN,
            "message": f"provider inválido: {provider}",
        }

    # 1. Rate limit interno (antes de descifrar).
    allowed, retry = await _check_probe_rate_limit(provider)
    if not allowed:
        return {
            "ok": False,
            "provider": provider,
            "errorKind": ERROR_KIND_RATE_LIMITED,
            "message": "Rate limit interno (1/30s por proveedor).",
            "rateLimited": True,
            "retryAfterSec": retry,
        }

    # 2. Resolver key efectiva.
    resolver: KeyResolver = get_key_resolver()
    try:
        resolution = await resolver.resolve(provider)
    except Exception as e:
        logger.warning(
            "Probe: KeyResolver.resolve(%s) falló: %s",
            provider,
            _sanitize_message(type(e).__name__),
        )
        return {
            "ok": False,
            "provider": provider,
            "errorKind": ERROR_KIND_UNKNOWN,
            "message": "Error resolviendo key",
        }

    if not resolution.api_key:
        return {
            "ok": False,
            "provider": provider,
            "errorKind": ERROR_KIND_NOT_CONFIGURED,
            "message": "Sin API key configurada",
        }

    # Si el resolver cayó con decrypt_error, lo señalamos.
    if resolution.warning == "decrypt_error":
        return {
            "ok": False,
            "provider": provider,
            "errorKind": ERROR_KIND_DECRYPT_ERROR,
            "message": "No se pudo descifrar la key de BD",
        }

    # 3. Ejecutar probe HTTP.
    async with httpx.AsyncClient() as client:
        if provider == "gemini":
            result = await _probe_gemini(resolution, client)
        else:
            label = "m3" if provider == "m3" else "dr7"
            result = await _probe_openai_compatible(label, resolution, client)

    # Siempre inyectar provider en el resultado.
    result["provider"] = provider
    return result
