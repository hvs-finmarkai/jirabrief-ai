from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.auth.routes import router as auth_router
from app.organizations.routes import router as org_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="JiraBrief AI", version="1.0.0", lifespan=lifespan)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
)

app.include_router(auth_router)
app.include_router(org_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "environment": settings.app_env}
