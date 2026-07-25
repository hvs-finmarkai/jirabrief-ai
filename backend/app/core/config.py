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

    # Encryption key for stored Jira API tokens. Deliberately separate from
    # supabase_jwt_secret: if the login secret ever leaks, that must not also
    # hand over every customer's Jira credentials. Generate with:
    #   openssl rand -hex 32
    token_encryption_key: str = ""

    # AI providers, tried in order: Claude -> Ollama -> deterministic fallback.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"
    anthropic_effort: str = "medium"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    ai_provider: str = "auto"

    # Background scheduler. Set false on any replica that must not run jobs.
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 60

    # Outbound-request guard: block requests to private/internal addresses so a
    # user-supplied Jira/Slack/Confluence URL cannot be aimed at internal
    # infrastructure. Only enable for local development against localhost.
    allow_private_network_targets: bool = False

    # How many trusted reverse proxies sit in front of the app. 0 means read the
    # peer address directly; behind a load balancer that is the balancer's IP, so
    # every user would share one rate-limit bucket. Set to 1 on Render/Fly/Vercel
    # and similar. Never set it higher than the real hop count: each extra hop
    # lets a client forge one more X-Forwarded-For entry.
    trusted_proxy_hops: int = 0

    sentry_dsn: str = ""
    resend_api_key: str = ""
    resend_from_email: str = "reports@jirabrief.ai"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod")


@lru_cache
def get_settings() -> Settings:
    return Settings()
