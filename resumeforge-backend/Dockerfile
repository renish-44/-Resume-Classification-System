# ResumeForge backend - inference-only API container.
#
# Build:  docker build -t resumeforge-backend .
# Run:    docker run --rm -p 8000:8000 --env-file .env resumeforge-backend
#
# The models directory is expected to be mounted (see docker-compose.yml); the
# image never contains model artifacts.

FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    RESUMEFORGE_BASE_DIR=/app \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO

WORKDIR /app

# Install dependencies first so the layer is cached.
COPY requirements.txt ./
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

# Application code (never the model artifacts).
COPY api ./api
COPY src ./src
COPY models ./models
COPY reports ./reports

# Run as a non-root user.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
