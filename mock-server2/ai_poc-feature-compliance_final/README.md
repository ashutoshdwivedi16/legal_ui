# Product Comparison API

AI-generated product comparison summaries for lg.com. Adds natural-language insights to the existing comparison modal.

## Features
- FastAPI service exposing `POST /ai/v1/compare/products/summary`
- Async data access (MySQL/Aurora via SQLAlchemy)
- Redis caching (7-day TTL default)
- LiteLLM client with retries/timeouts
- Validation for input/output (competitors, prohibited claims, hallucinations)

## Prerequisites
- Python 3.12
- Redis (local or remote)
- MySQL-compatible PDS (Aurora/MySQL) accessible from your dev env

## Agent Debug Command
> adk web --port 8081 ./common/agents

## Quickstart (Local)

1) Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
```

2) Install dependencies

```bash
pip install -r requirements.txt
```

Alternatively, from `pyproject.toml`:

```bash
pip install .
# or for dev extras
pip install .[dev]
```

3) Configure environment

Copy `.env.example` to `.env` and adjust values:

4) uvicorn main:app --host 0.0.0.0 --port 8000
```bash
cp .env.example .env
```

Key variables:
- APP_ENV, APP_DEBUG, APP_LOG_LEVEL
- PDS_DB_HOST, PDS_DB_PORT, PDS_DB_USER, PDS_DB_PASSWORD, PDS_DB_NAME
- REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD
- LLM_MODEL, AWS_* (if using Bedrock via LiteLLM)

## Compliance Quickstart (Includes Prompt Injection)

This section covers the compliance validator and prompt injection endpoints, which use the AI Postgres database.

### 1) Configure environment

Ensure these variables are set in `.env` (or your deployment environment):
- AI_DB_HOST, AI_DB_PORT, AI_DB_USER, AI_DB_PASSWORD, AI_DB_NAME
- LITELLM_BASE_URL, LITELLM_API_KEY, LLM_MODEL
- COMPLIANCE_PROJECTS_DIR=common/agents/compliance_validator/projects

### 2) Create compliance + prompt injection tables

Run the SQL init scripts against your AI Postgres database:

```bash
psql -h <host> -U <user> -d <db> -f services/compliance/db/init.sql
psql -h <host> -U <user> -d <db> -f services/prompt_injection/db/init.sql
```

Notes:
- `services/compliance/db/init.sql` creates compliance tables and inserts the 14 legal rules.
- `services/prompt_injection/db/init.sql` creates the prompt injection tables.

### 3) Start the API

```bash
uvicorn main:create_app --reload
```

### 4) Verify endpoints

Compliance:
- `GET /us/common/ai/v1/compliance/projects`
- `POST /us/common/ai/v1/compliance/validate-prompt`
- `POST /us/common/ai/v1/compliance/batch-run`

Prompt Injection:
- `GET /us/common/ai/v1/prompt-injection/cases`
- `POST /us/common/ai/v1/prompt-injection/run`
- `GET /us/common/ai/v1/prompt-injection/runs/latest`

## Running with docker-compose (recommended)

docker-compose will build and run the API alongside its dependencies (e.g., Redis) using `docker-compose.yaml` in the repo root.

- Build and start:

```bash
docker-compose up --build
```

- Run detached:

```bash
docker-compose up -d
```

- Tail logs:

```bash
docker-compose logs -f
```

- Stop and clean up:

```bash
docker-compose down
```

Service URLs (defaults):
- API: http://localhost:8080/ai/v1
- Health: http://localhost:8080/ai/v1/compare/health

Sample request:

```bash
curl -s \
  -X POST http://localhost:8080/ai/v1/compare/products/summary \
  -H 'Content-Type: application/json' \
  -d '{
    "products": ["MD09034027", "MD09033837"],
    "store": "OBS",
    "locale": "en-US"
  }' | jq
```

Notes:
- On validation failure or upstream failures, the endpoint returns `200` with `fallback: true` and reason.
- Cached responses set `cached: true`.

## Optional: Run directly (for quick local iteration)

You can run the API without containers if you prefer hot-reload and direct debugging:

```bash
uvicorn product_comparison.main:app --host 0.0.0.0 --port 8080 --reload
```

Health check:

```bash
curl -s http://localhost:8080/ai/v1/compare/health | jq
```

## Optional: Standalone Docker image

Build image:

```bash
docker build -t product-comparison:local .
```

Run container (expects `.env` in project root):

```bash
docker run --rm -p 8080:8080 --env-file .env product-comparison:local
```

## Project Structure
See `product_comparison/context.txt` for the full architecture and phase plan. Key dirs:
- `api/` FastAPI routes and dependencies
- `config/` Pydantic settings
- `schemas/` Pydantic models
- `services/` cache, LLM client, prompts, orchestration
- `repositories/` data access for PDS and prompts
- `validation/` input/output validations
- `prompts/templates/` fallback prompt files

## Integration Testing

We provide a robust integration testing setup using `docker-compose` to spin up the API along with a real Redis instance, MySQL database, and a Mock LLM service.

### Running Integration Tests
The included script automates the entire process:
1. Builds test containers (including a mock LLM server).
2. Starts the environment.
3. Waits for services to be healthy.
4. Runs end-to-end tests via `pytest`.
5. Tears down the environment.

```bash
./run_integration_tests.sh
```

### Manual Integration Testing
If you want to debug the test environment manually:

1. Start the test stack:
   ```bash
   docker-compose -f docker-compose.test.yaml up --build
   ```
2. Run tests against it:
   ```bash
   pytest tests/integration/test_e2e.py
   ```

## Development Tips
- Use `get_settings().cache_clear()` in tests to reload environment.
- Stub out external IO in unit tests (Redis, DB, LLM) and focus on control flow.
- Prefer async tests (`pytest-asyncio`).
