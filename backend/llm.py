"""
LLM abstraction layer.

Provides a unified interface for different LLM backends:
- Local: Ollama (Gemma, Llama, etc.)
- Cloud: Anthropic (Claude), OpenAI (GPT-4)

Usage:
    from llm import get_llm_client

    client = get_llm_client()
    response = await client.chat(messages)
"""

from abc import ABC, abstractmethod
from typing import Optional
import requests

from config import Config


class LLMClient(ABC):
    """Abstract base class for LLM clients."""

    @abstractmethod
    def chat(self, messages: list[dict], system_prompt: Optional[str] = None) -> str:
        """Send messages and get a response."""
        pass

    @abstractmethod
    def health_check(self) -> dict:
        """Check if the LLM is accessible."""
        pass


class OllamaClient(LLMClient):
    """Client for local Ollama server."""

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model

    def chat(self, messages: list[dict], system_prompt: Optional[str] = None) -> str:
        """Send messages to Ollama and get response."""
        full_messages = []

        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})

        full_messages.extend(messages)

        resp = requests.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "messages": full_messages,
                "stream": False,
            },
            timeout=120,
        )
        resp.raise_for_status()

        data = resp.json()
        return data["message"]["content"]

    def health_check(self) -> dict:
        """Check Ollama connection and model availability."""
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=5)
            resp.raise_for_status()
            models = resp.json().get("models", [])
            model_installed = any(m["name"].startswith(self.model.split(":")[0]) for m in models)

            return {
                "status": "ok",
                "provider": "ollama",
                "model": self.model,
                "model_installed": model_installed,
                "available_models": [m["name"] for m in models],
            }
        except requests.exceptions.ConnectionError:
            return {
                "status": "error",
                "provider": "ollama",
                "error": "Cannot connect to Ollama server",
            }
        except Exception as e:
            return {
                "status": "error",
                "provider": "ollama",
                "error": str(e),
            }


class AnthropicClient(LLMClient):
    """Client for Anthropic Claude API."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.anthropic.com/v1"

    def chat(self, messages: list[dict], system_prompt: Optional[str] = None) -> str:
        """Send messages to Claude and get response."""
        # Convert messages format for Anthropic
        anthropic_messages = []
        for msg in messages:
            if msg["role"] in ("user", "assistant"):
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        headers = {
            "x-api-key": self.api_key,
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": anthropic_messages,
        }

        if system_prompt:
            payload["system"] = system_prompt

        resp = requests.post(
            f"{self.base_url}/messages",
            headers=headers,
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()

        data = resp.json()
        return data["content"][0]["text"]

    def health_check(self) -> dict:
        """Check Anthropic API connectivity."""
        try:
            # Simple API test - just check if we can make a request
            headers = {
                "x-api-key": self.api_key,
                "content-type": "application/json",
                "anthropic-version": "2023-06-01",
            }
            # Use a minimal request to test
            resp = requests.post(
                f"{self.base_url}/messages",
                headers=headers,
                json={
                    "model": self.model,
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "hi"}],
                },
                timeout=10,
            )

            if resp.ok:
                return {
                    "status": "ok",
                    "provider": "anthropic",
                    "model": self.model,
                }
            elif resp.status_code == 401:
                return {
                    "status": "error",
                    "provider": "anthropic",
                    "error": "Invalid API key",
                }
            else:
                return {
                    "status": "error",
                    "provider": "anthropic",
                    "error": f"API error: {resp.status_code}",
                }
        except Exception as e:
            return {
                "status": "error",
                "provider": "anthropic",
                "error": str(e),
            }


class OpenAIClient(LLMClient):
    """Client for OpenAI API."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.openai.com/v1"

    def chat(self, messages: list[dict], system_prompt: Optional[str] = None) -> str:
        """Send messages to OpenAI and get response."""
        full_messages = []

        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})

        full_messages.extend(messages)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        resp = requests.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json={
                "model": self.model,
                "messages": full_messages,
            },
            timeout=120,
        )
        resp.raise_for_status()

        data = resp.json()
        return data["choices"][0]["message"]["content"]

    def health_check(self) -> dict:
        """Check OpenAI API connectivity."""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
            }
            resp = requests.get(
                f"{self.base_url}/models",
                headers=headers,
                timeout=10,
            )

            if resp.ok:
                return {
                    "status": "ok",
                    "provider": "openai",
                    "model": self.model,
                }
            elif resp.status_code == 401:
                return {
                    "status": "error",
                    "provider": "openai",
                    "error": "Invalid API key",
                }
            else:
                return {
                    "status": "error",
                    "provider": "openai",
                    "error": f"API error: {resp.status_code}",
                }
        except Exception as e:
            return {
                "status": "error",
                "provider": "openai",
                "error": str(e),
            }


def get_llm_client() -> LLMClient:
    """Get the appropriate LLM client based on configuration."""
    if Config.is_local():
        return OllamaClient(
            base_url=Config.OLLAMA_URL,
            model=Config.OLLAMA_MODEL,
        )
    else:
        if Config.LLM_PROVIDER == "anthropic":
            return AnthropicClient(
                api_key=Config.ANTHROPIC_API_KEY,
                model=Config.ANTHROPIC_MODEL,
            )
        elif Config.LLM_PROVIDER == "openai":
            return OpenAIClient(
                api_key=Config.OPENAI_API_KEY,
                model=Config.OPENAI_MODEL,
            )
        else:
            raise ValueError(f"Unknown LLM provider: {Config.LLM_PROVIDER}")


# Singleton instance
_llm_client: Optional[LLMClient] = None


def get_client() -> LLMClient:
    """Get or create the singleton LLM client."""
    global _llm_client
    if _llm_client is None:
        _llm_client = get_llm_client()
    return _llm_client
