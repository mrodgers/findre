import os
import json
import httpx
import asyncio
from typing import Optional, List

MODEL_PRIORITY = [
    "qwen3.6:35b",
    "qwen3.5:35b",
    "qwen3:30b",
    "gemma4:26b",
    "gemma4:latest",
    "gemma4:e2b",
    "qwen3:latest",
    "gemma3:latest",
    "deepseek-r1:latest",
    "qwen3-coder-next",  # Last: 51GB, very slow
]

_selected_model: Optional[str] = None
_ollama_available: bool = False

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")


def detect_ollama() -> tuple[bool, Optional[str]]:
    global _ollama_available, _selected_model

    try:
        import httpx as _httpx
        resp = _httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        resp.raise_for_status()
        data = resp.json()
        available_models = [m["name"] for m in data.get("models", [])]
        selected = _select_best_model(available_models)
        _ollama_available = True
        _selected_model = selected
        return True, selected
    except Exception:
        pass

    # Fallback: try subprocess (local dev)
    try:
        import subprocess
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            available_models = []
            for line in result.stdout.strip().split("\n")[1:]:
                parts = line.split()
                if parts:
                    available_models.append(parts[0])
            selected = _select_best_model(available_models)
            _ollama_available = True
            _selected_model = selected
            return True, selected
    except Exception:
        pass

    return False, None


def _select_best_model(available: List[str]) -> Optional[str]:
    for preferred in MODEL_PRIORITY:
        for model in available:
            if model.startswith(preferred) or preferred.startswith(model.split(":")[0]):
                return model
    return available[0] if available else None


async def generate(prompt: str, system: Optional[str] = None, json_mode: bool = False) -> str:
    global _selected_model, _ollama_available

    if not _ollama_available or not _selected_model:
        raise RuntimeError("Ollama not available")

    payload: dict = {
        "model": _selected_model,
        "prompt": prompt,
        "stream": False,
        "think": False,  # Disable thinking mode for qwen3.x / reasoning models
        "options": {
            "temperature": 0.3,
            "num_predict": 4096,
        },
    }
    if system:
        payload["system"] = system
    if json_mode:
        payload["format"] = "json"

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{OLLAMA_HOST}/api/generate",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")


async def generate_structured(prompt: str, system: str) -> dict:
    # Don't use json_mode — it returns empty with many models including qwen3.6
    # Instead instruct via system prompt and extract from raw output
    enhanced_system = system + "\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown fences, no explanation, no thinking tags outside the JSON. Start your response with { and end with }."
    raw = await generate(prompt, system=enhanced_system, json_mode=False)
    return _extract_json(raw)


def _extract_json(raw: str) -> dict:
    if not raw:
        return {}
    raw = raw.strip()

    # Strip thinking tags (qwen3 uses <think>...</think>)
    import re
    raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip()

    # Try direct parse first
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Find the outermost JSON object
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {}


def get_status() -> tuple[bool, Optional[str]]:
    return _ollama_available, _selected_model
