from __future__ import annotations
import json
from abc import ABC, abstractmethod
import httpx
from app.models.schemas import NormalizedSprintData, ReportData
from app.config import settings


class AIProvider(ABC):
    @abstractmethod
    async def generate_report(self, prompt: str, normalized_data: NormalizedSprintData) -> dict:
        pass


class OllamaProvider(AIProvider):
    def __init__(self):
        self._base_url = settings.ollama_base_url
        self._model = settings.ollama_model

    async def generate_report(self, prompt: str, normalized_data: NormalizedSprintData) -> dict:
        full_prompt = f"{prompt}\n\nJira Data:\n{normalized_data.model_dump_json(indent=2)}"

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self._base_url}/api/generate",
                json={
                    "model": self._model,
                    "prompt": full_prompt,
                    "format": "json",
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 2048,
                    },
                },
            )
            response.raise_for_status()
            result = response.json()
            raw_text = result.get("response", "")

        return self._parse_json(raw_text)

    def _parse_json(self, text: str) -> dict:
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)

        return json.loads(text)


def get_ai_provider() -> AIProvider:
    return OllamaProvider()
