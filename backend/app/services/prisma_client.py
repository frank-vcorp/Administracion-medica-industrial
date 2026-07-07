"""
IMPL-20260630-06: Singleton Prisma client para AMI backend.

Patrón:
- En runtime (Railway), se inicializa vía lifespan en main.py y se comparte
  con todos los routers/servicios que lo soliciten vía set_prisma_client().
- En tests (pytest), se inyecta un mock vía set_prisma_client() y NO se
  llama a init_prisma_client() (los tests montan su propia FastAPI app y
  nunca importan app.main, por lo que el lifespan no se ejecuta).

Refs: ARCH-20260630-02.
"""
from typing import Any, Optional

_prisma_client: Optional[Any] = None


def get_prisma_client() -> Any:
    """Obtiene el cliente Prisma singleton (debe haber sido inicializado antes)."""
    if _prisma_client is None:
        raise RuntimeError(
            "Prisma client no inicializado. Llamar init_prisma_client() desde "
            "main.py lifespan o set_prisma_client() desde tests."
        )
    return _prisma_client


def init_prisma_client() -> Any:
    """Inicializa el cliente Prisma singleton (llamar desde FastAPI lifespan).

    FIX-20260706-14: connect() debe ser await (Prisma client internamente es
    async). Llamarlo sync retorna una coroutine que nunca se ejecuta, dejando
    el cliente en estado 'no conectado' — lo que provoca ClientNotConnectedError
    en la primera query.

    Esta función solo crea la instancia. La conexión real debe hacerse
    en el lifespan via `await connect_prisma_client()` (async).
    """
    global _prisma_client
    if _prisma_client is not None:
        return _prisma_client
    from prisma import Prisma
    _prisma_client = Prisma()
    return _prisma_client


async def connect_prisma_client() -> None:
    """Conecta el cliente Prisma al motor de queries (async).

    FIX-20260706-14: connect() es async. Esta función envuelve el await.
    """
    global _prisma_client
    if _prisma_client is None:
        init_prisma_client()
    await _prisma_client.connect()


def set_prisma_client(client: Any) -> None:
    """Inyecta un cliente Prisma (para tests con mocks)."""
    global _prisma_client
    _prisma_client = client


async def disconnect_prisma_client() -> None:
    """Desconecta el cliente Prisma (llamar desde FastAPI lifespan shutdown)."""
    global _prisma_client
    if _prisma_client is not None:
        try:
            await _prisma_client.disconnect()
        except Exception:
            pass
        _prisma_client = None