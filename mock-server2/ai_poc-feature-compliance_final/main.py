from __future__ import annotations

import contextlib
import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from pydantic import ValidationError as PydanticValidationError

# Observability
from prometheus_fastapi_instrumentator import Instrumentator
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

# Services Routers
from services.product_comparison.apis import router as api_router
from services.compliance.api import router as compliance_router
from services.scm_dashboard.api.dashboard import router as dashboard_router
from services.scm_dashboard.api.orders import router as orders_router
from services.scm_dashboard.api.etl import router as etl_router

from common.lib.middleware.middleware import RequestLoggingMiddleware
from common.config import get_logger, get_request_id, get_settings, setup_logging
from common.models import ErrorDetail, ErrorResponse
from common.models.health import HealthResponse
from common.models.exceptions import (
    AppException,
    ErrorCode,
)

# Initialize logging early
settings = get_settings()
setup_logging(
    level=settings.app_log_level,
    json_format=settings.is_production,
)

logger = get_logger(__name__)


def setup_telemetry(app: FastAPI):
    """Setup Prometheus metrics and OpenTelemetry tracing."""

    # Prometheus Metrics
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

    # OpenTelemetry Tracing (Basic Console Exporter for POC, OTLP for Production)
    # In a real setup, you'd export to Jaeger/Tempo via OTLP
    if settings.is_production or os.getenv("ENABLE_TRACING"):
        provider = TracerProvider()
        # For POC/Dev -> Console, For Prod -> OTLP (not configured here to keep it simple)
        processor = BatchSpanProcessor(ConsoleSpanExporter())
        provider.add_span_processor(processor)
        trace.set_tracer_provider(provider)

        FastAPIInstrumentor.instrument_app(app)
        logger.info("OpenTelemetry tracing enabled")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info(
        "Application starting",
        extra={
            "event": "app_startup",
            "app_name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.app_env,
            "log_level": settings.app_log_level,
        },
    )

    yield

    # Shutdown
    logger.info(
        "Application shutting down",
        extra={"event": "app_shutdown"},
    )


def _build_error_response(
    code: str,
    message: str,
    status_code: int,
    details: dict | None = None,
) -> JSONResponse:
    """Build a standardized JSON error response."""
    request_id = get_request_id()
    error_detail = ErrorDetail(code=code, message=message, details=details)
    response = ErrorResponse(error=error_detail, request_id=request_id)
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(exclude_none=True),
    )


def create_app() -> FastAPI:
    logger.debug("Creating FastAPI application")

    app = FastAPI(
        title=settings.app_name,
        description="""
### Available Services:

* **Product Comparison** - AI-driven product comparison and analysis
* **SCM Dashboard** - Supply Chain Management dashboard with analytics and ETL operations

        """,
        version=settings.app_version,
        lifespan=lifespan,
    )

    # -------------------------------------------------------------------------
    # Exception Handlers
    # -------------------------------------------------------------------------

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        """Handle all custom application exceptions."""
        logger.warning(
            "Application exception",
            extra={
                "event": "app_exception",
                "error_code": exc.code.value,
                "error_message": exc.message,
                "status_code": exc.status_code,
                "details": exc.details,
                "path": request.url.path,
            },
        )
        return _build_error_response(
            code=exc.code.value,
            message=exc.message,
            status_code=exc.status_code,
            details=exc.details if settings.app_env != "production" else None,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Handle FastAPI/Pydantic request validation errors."""
        errors = exc.errors()
        # Extract field names from validation errors
        field_errors = []
        for error in errors:
            loc = ".".join(str(x) for x in error.get("loc", []))
            msg = error.get("msg", "Invalid value")
            field_errors.append(f"{loc}: {msg}")

        message = "Request validation failed"
        details = {"validation_errors": field_errors} if field_errors else None

        logger.warning(
            "Request validation failed",
            extra={
                "event": "validation_error",
                "path": request.url.path,
                "errors": errors,
            },
        )
        return _build_error_response(
            code=ErrorCode.VALIDATION_INVALID_REQUEST.value,
            message=message,
            status_code=422,
            details=details if settings.app_env != "production" else None,
        )

    @app.exception_handler(PydanticValidationError)
    async def pydantic_validation_handler(
        request: Request, exc: PydanticValidationError
    ) -> JSONResponse:
        """Handle Pydantic validation errors from response models."""
        logger.error(
            "Pydantic validation error",
            extra={
                "event": "pydantic_error",
                "path": request.url.path,
                "error_count": exc.error_count(),
            },
        )
        return _build_error_response(
            code=ErrorCode.PARSE_SCHEMA_INVALID.value,
            message="Response validation failed",
            status_code=500,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Catch-all handler for unhandled exceptions."""
        logger.exception(
            "Unhandled exception",
            extra={
                "event": "unhandled_exception",
                "error_type": type(exc).__name__,
                "error": str(exc),
                "path": request.url.path,
            },
        )
        # Don't expose internal error details in production
        message = "An unexpected error occurred"
        details = None
        if settings.app_env != "production":
            message = f"{type(exc).__name__}: {str(exc)}"
            details = {"error_type": type(exc).__name__}

        return _build_error_response(
            code=ErrorCode.INTERNAL_UNEXPECTED.value,
            message=message,
            status_code=500,
            details=details,
        )

    # -------------------------------------------------------------------------
    # Middleware
    # -------------------------------------------------------------------------

    # Add request logging middleware (must be added first to wrap everything)
    app.add_middleware(RequestLoggingMiddleware)

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -------------------------------------------------------------------------
    # Routes
    # -------------------------------------------------------------------------

    @app.get("/", include_in_schema=False)
    async def redirect_to_docs():
        """Redirect root to API documentation."""
        return RedirectResponse(url="/docs")

    # Mount API routes
    app.include_router(api_router, prefix=f"{settings.api_prefix}/compare")
    app.include_router(compliance_router, prefix=f"{settings.api_prefix}")
    app.include_router(dashboard_router, prefix=f"{settings.api_prefix}/scm-dashboard")
    app.include_router(orders_router, prefix=f"{settings.api_prefix}/scm-dashboard")
    app.include_router(etl_router, prefix=f"{settings.api_prefix}/scm-dashboard")

    @app.get(f"{settings.api_prefix}/health", response_model=HealthResponse)
    async def health_check():
        """Health check endpoint."""
        return HealthResponse(status="healthy", version=settings.app_version)

    # Serve mock UI (for POC/Demo purposes)
    @app.get(f"{settings.api_prefix}/mock-ui", include_in_schema=False)
    async def serve_mock_ui():
        import os

        path = "services/product_comparison/mock_ui.html"
        if not os.path.exists(path):
            path = "mock_ui.html"
        return FileResponse(path)

    # Setup Telemetry (Metrics & Tracing)
    setup_telemetry(app)

    logger.info(
        "Application created",
        extra={
            "event": "app_created",
            "api_prefix": settings.api_prefix,
        },
    )

    return app


app = create_app()
