from __future__ import annotations
import json
import logging
from abc import ABC, abstractmethod
from functools import lru_cache
import httpx
from pydantic import BaseModel
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AIProviderError(RuntimeError):
    """A provider could not produce a usable report."""


class AIProvider(ABC):
    name: str
    model: str

    @abstractmethod
    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        output_model: type[BaseModel] | None = None,
    ) -> str:
        """Return a JSON string. `output_model`, when given, is the expected shape."""

    @abstractmethod
    async def health_check(self) -> bool:
        pass


class ClaudeProvider(AIProvider):
    name = "anthropic"

    def __init__(self):
        settings = get_settings()
        self.model = settings.anthropic_model
        self._effort = settings.anthropic_effort
        self._api_key = settings.anthropic_api_key

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        output_model: type[BaseModel] | None = None,
    ) -> str:
        import anthropic

        client = _anthropic_client()

        # Structured outputs constrain the response to the report's schema, so a
        # malformed or truncated JSON body can't reach the parser at all. Without
        # a model to constrain against we fall back to asking for JSON in-prompt.
        kwargs = {
            "model": self.model,
            # Generous headroom: max_tokens covers thinking plus the report body,
            # and adaptive thinking is on by default for this model.
            "max_tokens": 16000,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "output_config": {"effort": self._effort},
        }

        try:
            if output_model is not None:
                message = await client.messages.parse(output_format=output_model, **kwargs)
                if message.stop_reason == "refusal":
                    raise AIProviderError("Claude declined to generate this report")
                if message.parsed_output is not None:
                    return message.parsed_output.model_dump_json()
            else:
                message = await client.messages.create(**kwargs)
                if message.stop_reason == "refusal":
                    raise AIProviderError("Claude declined to generate this report")

            text = next((b.text for b in message.content if b.type == "text"), "")
            if not text.strip():
                raise AIProviderError("Claude returned an empty response")
            return text

        except anthropic.NotFoundError as exc:
            raise AIProviderError(f"Unknown Claude model '{self.model}'") from exc
        except anthropic.AuthenticationError as exc:
            raise AIProviderError("ANTHROPIC_API_KEY is invalid") from exc
        except anthropic.RateLimitError as exc:
            raise AIProviderError("Claude rate limit reached") from exc
        except anthropic.APIStatusError as exc:
            raise AIProviderError(f"Claude API error {exc.status_code}") from exc
        except anthropic.APIConnectionError as exc:
            raise AIProviderError("Could not reach the Claude API") from exc

    async def health_check(self) -> bool:
        if not self._api_key:
            return False
        try:
            await _anthropic_client().models.retrieve(self.model)
            return True
        except Exception:
            return False


class OllamaProvider(AIProvider):
    name = "ollama"

    def __init__(self):
        settings = get_settings()
        self._base_url = settings.ollama_base_url
        self.model = settings.ollama_model

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        output_model: type[BaseModel] | None = None,
    ) -> str:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self._base_url}/api/generate",
                    json={
                        "model": self.model,
                        "system": system_prompt,
                        "prompt": user_prompt,
                        "format": "json",
                        "stream": False,
                        "options": {"temperature": 0.3, "num_predict": 3000},
                    },
                )
                response.raise_for_status()
                return response.json().get("response", "")
        except httpx.HTTPError as exc:
            raise AIProviderError(f"Ollama request failed: {exc}") from exc

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self._base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False


@lru_cache(maxsize=1)
def _anthropic_client():
    import anthropic

    settings = get_settings()
    return anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key or None)


def get_providers() -> list[AIProvider]:
    """Providers to try, best first. Callers fall back to a deterministic
    report if every provider in this list fails."""
    settings = get_settings()
    choice = settings.ai_provider.lower()

    if choice == "claude":
        return [ClaudeProvider()]
    if choice == "ollama":
        return [OllamaProvider()]

    providers: list[AIProvider] = []
    if settings.anthropic_api_key:
        providers.append(ClaudeProvider())
    providers.append(OllamaProvider())
    return providers


def get_ai_provider() -> AIProvider:
    return get_providers()[0]


def parse_ai_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return json.loads(text)
