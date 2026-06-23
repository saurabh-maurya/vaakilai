"""
VakilAI AI Service — FastAPI + LangGraph
Exposes AI endpoints for consultation, documents, research, and matching.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from motor.motor_asyncio import AsyncIOMotorClient
import logging
import uuid
import certifi

from config import settings
from routes import consult, documents, research, match, cases_rag, predict, legal_tasks, judge_analytics, litigation_safety, risk_score, doc_compare

# ── Sentry (error tracking) ───────────────────────────────────────────────────
if settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.1,
            send_default_pii=False,
        )
    except ImportError:
        pass  # sentry-sdk not installed — non-fatal

# ── Rate limiter (Redis-backed for multi-worker safety) ───────────────────────
if settings.redis_url:
    limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)
else:
    limiter = Limiter(key_func=get_remote_address)

# ── MongoDB client (shared with backend for token blacklist) ──────────────────

_mongo_client: AsyncIOMotorClient = None


def get_db():
    if _mongo_client is None:
        return None
    return _mongo_client[settings.mongodb_db_name]


# ── Middleware ────────────────────────────────────────────────────────────────

MAX_JSON_BODY_BYTES = 1 * 1024 * 1024  # 1 MB


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject JSON API requests whose Content-Length exceeds 1 MB."""
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_type = request.headers.get("content-type", "")
            if "multipart/form-data" not in content_type:
                content_length = request.headers.get("content-length")
                if content_length and int(content_length) > MAX_JSON_BODY_BYTES:
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request body too large. Maximum is 1 MB."},
                    )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "frame-ancestors 'none';"
        )
        if not settings.debug:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response


class MetricsAuthMiddleware(BaseHTTPMiddleware):
    """Block unauthenticated access to /metrics (Prometheus scrape endpoint)."""
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/metrics":
            token = settings.metrics_token
            if token:
                auth = request.headers.get("Authorization", "")
                if auth != f"Bearer {token}":
                    from fastapi.responses import JSONResponse
                    return JSONResponse(status_code=401, content={"detail": "Metrics endpoint requires authorization"})
        return await call_next(request)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Propagate or generate X-Request-ID for distributed tracing."""
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class InternalServiceKeyMiddleware(BaseHTTPMiddleware):
    """
    When INTERNAL_SERVICE_KEY is configured, mark requests that carry the
    correct key so downstream handlers can skip user-JWT validation for
    internal service-to-service calls (e.g. WhatsApp webhook → /ai/consult).
    """
    async def dispatch(self, request: Request, call_next):
        key = settings.internal_service_key
        if key and request.headers.get("X-Internal-Key") == key:
            request.state.is_internal = True
        else:
            request.state.is_internal = False
        return await call_next(request)


# ── Structured JSON logging (SIEM-compatible) ─────────────────────────────────
try:
    from pythonjsonlogger import jsonlogger
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s")
    handler.setFormatter(formatter)
    logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO, handlers=[handler])
except ImportError:
    logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VakilAI AI Service",
    description="LangGraph-powered AI service for Indian legal intelligence",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Prometheus metrics (/metrics — bound to 127.0.0.1 only via Docker) ───────
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator(
        should_group_status_codes=True,
        excluded_handlers=["/health", "/metrics"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
    logger.info("Prometheus metrics exposed at /metrics")
except ImportError:
    logger.warning("prometheus-fastapi-instrumentator not installed — metrics disabled")

app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(MetricsAuthMiddleware)
app.add_middleware(InternalServiceKeyMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(consult.router,    prefix="/ai/consult",    tags=["Consultation"])
app.include_router(documents.router,  prefix="/ai/documents",  tags=["Documents"])
app.include_router(research.router,   prefix="/ai/research",   tags=["Research"])
app.include_router(match.router,      prefix="/ai/match",      tags=["Matching"])
app.include_router(cases_rag.router,  prefix="/ai/cases",      tags=["Case Search (RAG)"])
app.include_router(predict.router,       prefix="/ai/predict",       tags=["Outcome Prediction"])
app.include_router(legal_tasks.router,      prefix="/ai/legal-tasks",      tags=["Legal Tasks (Aalap)"])
app.include_router(judge_analytics.router,  prefix="/ai/judge-analytics",  tags=["Judge Analytics"])
app.include_router(litigation_safety.router, prefix="/ai/safety",          tags=["Litigation Safety"])
app.include_router(risk_score.router,       prefix="/ai/risk",             tags=["Case Risk Score"])
app.include_router(doc_compare.router,      prefix="/ai/docs",             tags=["Document Compare"])


@app.get("/health")
async def health():
    from fastapi.responses import JSONResponse
    db_status = "ok"
    if _mongo_client is not None:
        try:
            await _mongo_client.admin.command("ping")
        except Exception:
            db_status = "unreachable"
    else:
        db_status = "not_connected"
    status = "ok" if db_status == "ok" else "degraded"
    return JSONResponse(
        status_code=200 if status == "ok" else 503,
        content={"status": status, "service": "vakilai-ai-service", "db": db_status},
    )


@app.on_event("startup")
async def startup():
    global _mongo_client
    # Fail-fast on missing secrets in production
    if settings.app_env == "production":
        if not settings.internal_service_key:
            raise RuntimeError(
                "FATAL: INTERNAL_SERVICE_KEY must be set in production. "
                "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
    logger.info(f"VakilAI AI Service starting — model: {settings.model_name}")

    # Connect to MongoDB (shared with backend for token blacklist)
    try:
        _mongo_client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
        logger.info("AI service connected to MongoDB")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e} — token blacklist check will be skipped")

    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set — AI features will fail")
    if not settings.pinecone_api_key:
        logger.warning("PINECONE_API_KEY not set — using FAISS for local vector search")
    if not settings.huggingface_api_token and settings.ai_provider == "huggingface":
        logger.warning("HUGGINGFACE_API_TOKEN not set — HuggingFace provider will fail")
    logger.info(f"AI provider: {settings.ai_provider}")

    # Pre-load FAISS index
    from rag.vector_store import case_store
    case_store._load()


@app.on_event("shutdown")
async def shutdown():
    global _mongo_client
    if _mongo_client:
        _mongo_client.close()
        logger.info("AI service disconnected from MongoDB")
