## Product Comparison API - Dockerfile
# Target: Python 3.12, non-root runtime, small image

# -----------------------------------------------------------------------------
# Base image
# -----------------------------------------------------------------------------
# FROM python:3.12-slim AS base
FROM 076614340621.dkr.ecr.us-east-1.amazonaws.com/lgcomus-base-python-shared:v3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VIRTUALENVS_CREATE=false

# Install system deps for building wheels of common libs
# RUN apt-get update -y && \
#     apt-get install -y --no-install-recommends \
#         build-essential \
#         curl \
#         ca-certificates \
#         libpq-dev \
#         default-libmysqlclient-dev && \
#     rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# -----------------------------------------------------------------------------
# Install Python dependencies
# -----------------------------------------------------------------------------
# Copy only the project metadata first to leverage docker layer caching.
# We install the project itself (including dependencies) via pip.
#COPY product_comparison/pyproject.toml ./product_comparison/pyproject.toml
COPY requirements.txt ./requirements.txt
COPY pyproject.toml ./pyproject.toml

# Install the package (this will resolve dependencies from pyproject.toml)
RUN python -m pip install --upgrade pip && \
    python -m pip install -r requirements.txt

COPY . ./

# Download NLTK data for Guardrails AI validators to shared location
# RUN mkdir -p /usr/local/share/nltk_data && \
#     python -c "import nltk; nltk.download('punkt', download_dir='/usr/local/share/nltk_data', quiet=True); nltk.download('punkt_tab', download_dir='/usr/local/share/nltk_data', quiet=True); nltk.download('averaged_perceptron_tagger', download_dir='/usr/local/share/nltk_data', quiet=True); nltk.download('averaged_perceptron_tagger_eng', download_dir='/usr/local/share/nltk_data', quiet=True)" && \
#     chmod -R a+r /usr/local/share/nltk_data

# -----------------------------------------------------------------------------
# Runtime user
# -----------------------------------------------------------------------------

# Configure guardrails
#ARG GUARDRAILS_API_KEY=""
# RUN if [ -n "$GUARDRAILS_API_KEY" ]; then \
#         guardrails configure --token "$GUARDRAILS_API_KEY" --disable-metrics --disable-remote-inferencing && \
#         guardrails hub install hub://guardrails/competitor_check --quiet; \
#     fi

RUN addgroup --system app && adduser --system --ingroup app --home /home/app app

# RUN mkdir -p /home/app && \
#     if [ -f /root/.guardrailsrc ]; then \
#         cp /root/.guardrailsrc /home/app/.guardrailsrc && \
#         chown -R app:app /home/app; \
#     fi

# Ensure all files are readable by the app user
RUN chmod -R a+r /app && \
    find /app -type d -exec chmod a+x {} \;

USER app

# -----------------------------------------------------------------------------
# Expose and default command (can be overridden)
# -----------------------------------------------------------------------------
EXPOSE 8000

# Default to uvicorn. The app module will be added in Phase 2.
# You can override CMD at runtime if needed.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
