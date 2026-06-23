FROM python:3.11-slim

WORKDIR /app

# Patch OS-level CVEs, install ClamAV, then clean up in the same layer
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        clamav \
        clamav-daemon \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Update ClamAV virus definitions (runs as root before user switch)
RUN freshclam --quiet || true

# Install Python deps as root, then drop privileges
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY --chown=appuser:appgroup . .

# Entrypoint: start ClamAV daemon then launch the app
COPY --chown=root:root docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
# No --reload in production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
