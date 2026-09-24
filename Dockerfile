# syntax=docker/dockerfile:1

# One image: the frontend is built with Node, then served by the Python process
# alongside the API. One origin, so the bundle is built with no API base URL and
# the browser never makes a cross-origin request.

FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


FROM python:3.13-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    STATIC_DIR=/srv/static

COPY backend/pyproject.toml /src/pyproject.toml
COPY backend/app /src/app
RUN pip install /src && rm -rf /src

WORKDIR /srv
COPY --from=frontend /build/dist /srv/static

RUN useradd --create-home --uid 10001 runtime
USER runtime

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
