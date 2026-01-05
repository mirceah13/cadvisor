# API Service Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
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
    && rm -rf /var/lib/apt/lists/*

# Install LibreDWG from source for DWG conversion
RUN cd /tmp && \
    git clone --depth 1 --branch 0.13.3 https://github.com/LibreDWG/libredwg.git && \
    cd libredwg && \
    sh autogen.sh && \
    ./configure --disable-bindings && \
    make && \
    make install && \
    ldconfig && \
    cd / && \
    rm -rf /tmp/libredwg

# Copy requirements
COPY services/api/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY services/api/ .

# Create necessary directories
RUN mkdir -p uploads temp logs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
