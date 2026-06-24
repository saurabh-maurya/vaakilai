from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
import uuid

from config import settings
from database import connect_db, close_db
from routes import auth, users, marketplace, consultations, payments, cases, clients, documents, analytics, notifications, ecourts, whatsapp, compliance, verification, video, odr, client_portal, ipc_bns, news, annotations, contracts_clm, ip_portfolio, citations, admin

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

# ── Sentry (error tracking) ───────────────────────────────────────────────────
if settings.sentry_dsn and settings.sentry_dsn.strip():
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
        logger.info("Sentry initialised (env=%s)", settings.app_env)
    except ImportError:
        logger.warning("sentry-sdk not installed — pip install sentry-sdk[fastapi]")

# ── Rate limiter (Redis-backed for multi-worker safety) ───────────────────────
if settings.redis_url:
    limiter = Limiter(key_func=get_remote_address, storage_uri=settings.redis_url)
    logger.info("Rate limiter: Redis-backed (%s)", settings.redis_url.split("@")[-1])
else:
    limiter = Limiter(key_func=get_remote_address)
    if settings.app_env == "production":
        logger.warning(
            "REDIS_URL not set — rate limiter uses in-memory storage. "
            "This is NOT safe for multi-worker production deployments. Set REDIS_URL."
        )


MAX_JSON_BODY_BYTES = 1 * 1024 * 1024  # 1 MB for non-file JSON requests


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject JSON API requests whose Content-Length exceeds 1 MB.
    File uploads are exempt — they are limited per-endpoint (25 MB)."""
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_type = request.headers.get("content-type", "")
            if "multipart/form-data" not in content_type:
                content_length = request.headers.get("content-length")
                if content_length and int(content_length) > MAX_JSON_BODY_BYTES:
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request body too large. Maximum is 1 MB for JSON endpoints."},
                    )
        return await call_next(request)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Propagate or generate X-Request-ID for distributed tracing."""
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail-fast on weak secrets in production
    weak_secrets = {"change-me-in-production", "your-super-secret-jwt-key-change-in-production", "secret", ""}
    if settings.app_env == "production":
        if settings.jwt_secret in weak_secrets or len(settings.jwt_secret) < 32:
            raise RuntimeError("FATAL: JWT_SECRET is weak or placeholder. Set a cryptographically random 32+ character secret.")
        if not settings.internal_service_key:
            raise RuntimeError("FATAL: INTERNAL_SERVICE_KEY must be set in production. Generate with: python -c \"import secrets; print(secrets.token_hex(32))\"")
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="VakilAI Backend API",
    description="Backend for VakilAI — India's Legal AI Platform",
    version="1.0.0",
    lifespan=lifespan,
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Request-ID"],
)

# Mount all routers
app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Auth"])
app.include_router(users.router,         prefix="/api/v1/users",          tags=["Users"])
app.include_router(marketplace.router,   prefix="/api/v1/marketplace",    tags=["Marketplace"])
app.include_router(consultations.router, prefix="/api/v1/consultations",  tags=["Consultations"])
app.include_router(payments.router,      prefix="/api/v1/payments",       tags=["Payments"])
app.include_router(cases.router,         prefix="/api/v1/cases",          tags=["Cases"])
app.include_router(clients.router,       prefix="/api/v1/clients",        tags=["Clients"])
app.include_router(documents.router,     prefix="/api/v1/documents",      tags=["Documents"])
app.include_router(analytics.router,     prefix="/api/v1/analytics",      tags=["Analytics"])
app.include_router(notifications.router,  prefix="/api/v1/notifications",   tags=["Notifications"])
app.include_router(ecourts.router,        prefix="/api/v1/ecourts",          tags=["eCourts"])
app.include_router(whatsapp.router,       prefix="/api/v1/whatsapp",         tags=["WhatsApp"])
app.include_router(compliance.router,     prefix="/api/v1/compliance",       tags=["Compliance"])
app.include_router(verification.router,   prefix="/api/v1/verification",     tags=["BCI Verification"])
app.include_router(video.router,          prefix="/api/v1/video",            tags=["Video"])
app.include_router(odr.router,            prefix="/api/v1/odr",              tags=["ODR"])
app.include_router(client_portal.router,  prefix="/api/v1/client",           tags=["Client Portal"])
app.include_router(ipc_bns.router,        prefix="/api/v1/ipc-bns",           tags=["IPC-BNS Converter"])
app.include_router(news.router,           prefix="/api/v1/news",              tags=["Legal News"])
app.include_router(annotations.router,    prefix="/api/v1/annotations",       tags=["Annotations"])
app.include_router(contracts_clm.router,  prefix="/api/v1/contracts",         tags=["Contract CLM"])
app.include_router(ip_portfolio.router,   prefix="/api/v1/ip",                tags=["IP Portfolio"])
app.include_router(citations.router,      prefix="/api/v1/citations",         tags=["Citations"])
app.include_router(admin.router,          prefix="/api/v1/admin",             tags=["Admin"])


@app.get("/health")
async def health():
    from database import get_client
    try:
        await get_client().admin.command("ping")
        db_status = "ok"
    except Exception:
        db_status = "unreachable"
    status = "ok" if db_status == "ok" else "degraded"
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=200 if status == "ok" else 503,
        content={"status": status, "service": "vakilai-backend", "db": db_status},
    )
