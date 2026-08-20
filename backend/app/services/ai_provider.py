import json
import urllib.error
import urllib.request

from app.core.config import get_settings


class AiProviderUnavailable(RuntimeError):
    pass


def local_chat_completion(messages: list[dict], *, max_tokens: int = 500, temperature: float = 0.2) -> str:
    settings = get_settings()
    if settings.ai_provider not in {"local_openai", "openai_compatible"}:
        raise AiProviderUnavailable("AI provider is disabled or rule-based only.")
    if not settings.ai_base_url:
        raise AiProviderUnavailable("AI base URL is not configured.")

    body = json.dumps(
        {
            "model": settings.ai_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "reasoning_effort": "none",
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{settings.ai_base_url.rstrip('/')}/chat/completions",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.ai_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        raise AiProviderUnavailable(str(exc)) from exc

    try:
        message = payload["choices"][0]["message"]
        content = str(message.get("content") or "").strip()
        if content:
            return content
        return str(message.get("reasoning_content") or "").strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise AiProviderUnavailable("AI provider returned an unexpected response.") from exc


def ai_provider_status() -> dict:
    settings = get_settings()
    if settings.ai_provider not in {"local_openai", "openai_compatible"} or not settings.ai_base_url:
        return {
            "provider": settings.ai_provider,
            "enabled": False,
            "model": settings.ai_model,
            "base_url": settings.ai_base_url,
        }

    request = urllib.request.Request(f"{settings.ai_base_url.rstrip('/')}/models", method="GET")
    try:
        with urllib.request.urlopen(request, timeout=settings.ai_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        models = [item.get("id") for item in payload.get("data", [])]
        return {
            "provider": settings.ai_provider,
            "enabled": True,
            "reachable": True,
            "model": settings.ai_model,
            "base_url": settings.ai_base_url,
            "models": models,
        }
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        return {
            "provider": settings.ai_provider,
            "enabled": True,
            "reachable": False,
            "model": settings.ai_model,
            "base_url": settings.ai_base_url,
            "error": str(exc),
        }
