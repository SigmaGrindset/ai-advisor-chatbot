"""Serving the built frontend from the application, on a single origin.

The bundle and the API share one origin, so there is no CORS configuration
anywhere in the project. Any path the API does not claim resolves to the
single-page application, so a client-side route survives a page reload.
"""

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)


def mount_frontend(app: FastAPI, static_dir: Path) -> None:
    """Serve the built bundle, if there is one.

    In development the bundle is served by Vite instead, so an absent build
    directory is not an error.
    """
    index = static_dir / "index.html"
    if not index.is_file():
        logger.warning("No frontend build at %s — serving the API only", static_dir)
        return

    @app.get("/{requested_path:path}", include_in_schema=False)
    async def serve_frontend(requested_path: str) -> FileResponse:
        if requested_path == "api" or requested_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        asset = _built_asset(static_dir, requested_path)
        return FileResponse(asset or index)


def _built_asset(static_dir: Path, requested_path: str) -> Path | None:
    """The built file this path names, or None if it names a client-side route."""
    if not requested_path:
        return None
    candidate = (static_dir / requested_path).resolve()
    if not candidate.is_relative_to(static_dir.resolve()):
        return None
    return candidate if candidate.is_file() else None
