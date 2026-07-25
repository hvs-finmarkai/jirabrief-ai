from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/jirabrief"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    cors_origins: list[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
