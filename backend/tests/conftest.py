"""
Conftest that works around a pre-existing env issue: in this environment,
`from prisma._fields import Json as PrismaJson` hangs indefinitely during
`import app.main` (specifically at `prisma._types` → `TypedDict` from
typing_extensions on Python 3.14). This blocks ALL FastAPI endpoint tests,
including `test_upload_public_scope.py`. We pre-stub `prisma._fields` with a
dummy `Json` class so `app.main` can finish loading.
"""
import sys
import types


def _ensure_prisma_fields_stub():
    """Install a stub for `prisma._fields` so module-level `from prisma._fields
    import Json as PrismaJson` does not hang in this environment."""
    if "prisma._fields" in sys.modules:
        return

    # Build a fake prisma._fields module exposing the names that
    # app.services.pending_order_service imports.
    mod = types.ModuleType("prisma._fields")

    class _StubJson:
        """Stub pydantic.Json replacement used only at type-annotation time."""
        pass

    class _StubBase64:
        pass

    mod.Json = _StubJson
    mod.Base64 = _StubBase64
    sys.modules["prisma._fields"] = mod


_ensure_prisma_fields_stub()
