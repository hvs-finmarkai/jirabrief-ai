from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.rate_limit import RateLimitMiddleware
from app.auth.routes import router as auth_router
from app.organizations.routes import router as org_router
from app.demo.routes import router as demo_router
from app.jira.routes import router as jira_router
from app.reports.routes import router as reports_router
from app.schedules.routes import router as schedules_router
from app.notifications.routes import router as notifications_router
from app.delivery.routes import router as delivery_router
from app.admin.routes import router as admin_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.sentry_dsn:
        try:
            import sentry_sdk
            sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.app_env, traces_sample_rate=0.1)
        except ImportError:
            pass
    yield


app = FastAPI(
    title="JiraBrief AI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.app_env == "development" else None,
    redoc_url=None,
)

app.add_middleware(RateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Organization-Id", "X-Request-Id"],
    expose_headers=["X-Request-Id"],
)

app.include_router(auth_router)
app.include_router(org_router)
app.include_router(demo_router)
app.include_router(jira_router)
app.include_router(reports_router)
app.include_router(schedules_router)
app.include_router(notifications_router)
app.include_router(delivery_router)
app.include_router(admin_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "environment": settings.app_env}
