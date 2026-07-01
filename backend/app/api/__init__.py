"""API package para routers FastAPI.
IMPL-20260630-03: Routers v2 modulares.
"""
from app.api.reports import router as reports_router

__all__ = ["reports_router"]