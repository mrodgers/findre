import traceback
import logging
import httpx
from fastapi import APIRouter, HTTPException
from models.schemas import (
    ChatRequest, ChatResponse, SearchRequest, SearchResponse,
    ApiStatus, ZillowKeyRequest, InteractionRequest, PropertyDetails
)
from agents import user_intent, orchestrator
from providers.zillow import ZillowProvider, QuotaExhaustedError
from providers.demo import DemoProvider
from storage.cache import config_set, record_interaction
from services import ollama_service

log = logging.getLogger(__name__)

router = APIRouter()

# Provider state
_zillow = ZillowProvider()
_demo = DemoProvider()

# Conversation history per session
_conversations: dict = {}


def _get_provider():
    if _zillow.is_configured:
        return _zillow
    return _demo


@router.get("/status", response_model=ApiStatus)
async def get_status():
    ollama_ok, model = ollama_service.get_status()
    quota_exhausted = _zillow.quota_exhausted
    return ApiStatus(
        ollama_available=ollama_ok,
        ollama_model=model,
        zillow_configured=_zillow.is_configured,
        using_demo_data=not _zillow.is_configured or quota_exhausted,
        quota_exhausted=quota_exhausted,
    )


@router.post("/onboard/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # Track conversation history for context
    if req.session_id not in _conversations:
        _conversations[req.session_id] = []

    history = _conversations[req.session_id]

    message, prefs, search_area, complete = await user_intent.process_message(
        req.message,
        req.session_id,
        req.current_preferences,
        history,
    )

    # Update history
    history.append({"role": "user", "content": req.message})
    history.append({"role": "assistant", "content": message})

    # Keep only last 20 messages
    _conversations[req.session_id] = history[-20:]

    return ChatResponse(
        message=message,
        preferences=prefs,
        search_area=search_area,
        complete=complete,
    )


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    provider = _get_provider()
    quota_fallback = False

    try:
        properties = await orchestrator.run_search(
            req.preferences,
            req.search_area,
            req.weights,
            provider,
            req.session_id,
        )
    except (QuotaExhaustedError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.NetworkError) as e:
        # Quota exhausted or transient network error — fall back to demo data
        log.warning("Zillow unavailable (%s: %s), falling back to demo data", type(e).__name__, e)
        print(f"⚠ Zillow unavailable ({type(e).__name__}) — falling back to demo data", flush=True)
        quota_fallback = True
        try:
            properties = await orchestrator.run_search(
                req.preferences,
                req.search_area,
                req.weights,
                _demo,
                req.session_id,
            )
        except Exception as inner_e:
            tb = traceback.format_exc()
            log.error("Demo fallback also failed: %s\n%s", inner_e, tb)
            raise HTTPException(status_code=500, detail=f"Search failed: {inner_e}")
    except Exception as e:
        tb = traceback.format_exc()
        log.error("Search error: %s\n%s", e, tb)
        print(f"SEARCH ERROR: {type(e).__name__}: {e}\n{tb}", flush=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {type(e).__name__}: {e}")

    categories = {
        "exact": sum(1 for p in properties if p.category.value == "exact"),
        "derivative": sum(1 for p in properties if p.category.value == "derivative"),
        "opportunity": sum(1 for p in properties if p.category.value == "opportunity"),
    }

    return SearchResponse(
        properties=properties,
        search_area=req.search_area,
        total_found=len(properties),
        categories=categories,
        quota_exhausted=quota_fallback,
    )


@router.get("/properties/{property_id}/details", response_model=PropertyDetails)
async def get_property_details(property_id: str, listing_url: str = ""):
    if not _zillow.is_configured or _zillow.quota_exhausted:
        raise HTTPException(status_code=404, detail="Live details not available in demo mode")
    try:
        details = await _zillow.get_home_details(property_id, listing_url)
        return PropertyDetails(**details)
    except QuotaExhaustedError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        tb = traceback.format_exc()
        log.error("home_details error: %s\n%s", e, tb)
        raise HTTPException(status_code=500, detail=f"Details fetch failed: {e}")


@router.get("/properties/{property_id}/similar")
async def get_similar(property_id: str, session_id: str = ""):
    return []


@router.post("/config/zillow-key")
async def set_zillow_key(req: ZillowKeyRequest):
    if not req.api_key or len(req.api_key) < 10:
        raise HTTPException(status_code=400, detail="Invalid API key")

    await config_set("zillow_api_key", req.api_key)
    _zillow._api_key = req.api_key

    return {"success": True, "message": "Zillow API key saved. Live data now active."}


@router.post("/interactions")
async def record_interaction_endpoint(req: InteractionRequest):
    await record_interaction(req.session_id, req.property_id, req.action)
    return {"ok": True}
