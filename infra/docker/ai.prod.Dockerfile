# ============================================================
# AI Service — Production Dockerfile
# Much lighter than the API image (no LibreDWG, no tesseract)
# ============================================================
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/ai/ .

RUN mkdir -p temp logs

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8001}/health || exit 1

CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001} --workers 2"
