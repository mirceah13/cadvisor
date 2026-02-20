# ============================================================
# API Service — Production Dockerfile
# Differences from dev:
#   - Uses requirements.prod.txt (no torch/transformers/opencv)
#   - Railway injects $PORT; uvicorn binds to it
#   - No --reload flag
#   - LibreDWG still compiled (needed for DWG parsing)
# ============================================================
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libpq-dev \
    wget \
    autoconf \
    automake \
    libtool \
    texinfo \
    tesseract-ocr \
    tesseract-ocr-ron \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# LibreDWG — required for DWG → DXF conversion
RUN cd /tmp && \
    git clone --depth 1 --branch 0.13.3 https://github.com/LibreDWG/libredwg.git && \
    cd libredwg && \
    sh autogen.sh && \
    ./configure --disable-bindings && \
    make && \
    make install && \
    ldconfig && \
    cd / && rm -rf /tmp/libredwg && \
    echo "LibreDWG installed"

# Python dependencies (slim production set)
COPY services/api/requirements.prod.txt .
RUN pip install --no-cache-dir -r requirements.prod.txt

# Application code
COPY services/api/ .

RUN mkdir -p uploads temp logs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Railway sets $PORT automatically; fall back to 8000 for other hosts
CMD sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"
