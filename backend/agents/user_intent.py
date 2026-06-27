"""
User Intent Agent — converts conversational input into structured UserPreferences.
"""
import json
from typing import Optional, Tuple
from models.schemas import UserPreferences, SearchArea
from services import ollama_service
from geopy.geocoders import Nominatim

_geocoder = Nominatim(user_agent="find-real-estate-mvp")

SYSTEM_PROMPT = """You are a real estate intake agent. Extract search criteria from user messages and respond with a JSON object.

Required JSON keys:
- preferences: object with these optional fields: budget_min (number), budget_max (number), location (string: city or zip), radius_miles (number, default 10), property_type (array), bedrooms_min (number), bathrooms_min (number), sqft_min (number), lot_size_min (number), single_family_only (boolean — set true when user says "not shared", "private lot", "no apartments", "single family", "no tenants", "just one home on the lot"), must_haves (array of strings), nice_to_haves (array), deal_breakers (array), freeform_goal (string)
- complete: boolean
- message: string - brief acknowledgement of what you captured; if missing info ask for it
- search_area: object with center_lat (null), center_lng (null), radius_miles (number), label (string description of location)

Budget parsing: "$800k" = 800000, "$1.2M" = 1200000, "$750k-1.2M" → budget_min=750000 budget_max=1200000. Radius parsing: "within 20 miles" = radius_miles 20.

CRITICAL RULES:
1. Set complete=true the instant BOTH location (city, zip, or neighborhood) AND budget_max are present — whether from this message or previous ones.
2. NEVER ask "shall I proceed?", "would you like me to search?", or any confirmation question. The app searches automatically when complete=true.
3. If the user says "proceed", "go", "search", "yes", "go ahead", or similar, check the existing context — if location+budget are already known, set complete=true immediately.
4. Keep your message short. Do not re-list all the criteria. Just confirm and move on.

Respond ONLY with the JSON object."""

FALLBACK_RESPONSES = [
    "I'd love to help you find the perfect home! Could you tell me your target area and budget?",
    "Great start! To search effectively, I need to know: what city or zip code are you targeting, and what's your price range?",
    "I'm your real estate scout! Share your location and budget, and I'll find properties you'd never discover through a standard search.",
]

_fallback_idx = 0


async def process_message(
    message: str,
    session_id: str,
    current_preferences: Optional[UserPreferences] = None,
    conversation_history: list = None,
) -> Tuple[str, Optional[UserPreferences], Optional[SearchArea], bool]:
    """
    Returns: (response_message, updated_preferences, search_area, is_complete)
    """
    context = ""
    if current_preferences:
        context = f"\nCurrently captured: {current_preferences.model_dump_json()}"

    history_text = ""
    if conversation_history:
        recent = conversation_history[-6:]
        history_text = "\n".join(
            f"{m['role'].upper()}: {m['content']}"
            for m in recent
        )

    prompt = f"""Conversation history:
{history_text}

New user message: {message}
{context}

Extract preferences and respond as described."""

    try:
        result = await ollama_service.generate_structured(prompt, SYSTEM_PROMPT)
        if not result:
            raise ValueError("Empty result")
    except Exception:
        global _fallback_idx
        response = FALLBACK_RESPONSES[_fallback_idx % len(FALLBACK_RESPONSES)]
        _fallback_idx += 1
        return response, current_preferences, None, False

    response_msg = result.get("message", "I understand. Could you tell me more about what you're looking for?")
    complete = result.get("complete", False)

    # Parse preferences
    prefs_data = result.get("preferences", {})
    if prefs_data:
        try:
            # Merge with existing preferences
            existing = current_preferences.model_dump() if current_preferences else {}
            for k, v in prefs_data.items():
                if v is not None and v != [] and v != "":
                    existing[k] = v
            updated_prefs = UserPreferences(**existing)
        except Exception:
            updated_prefs = current_preferences
    else:
        updated_prefs = current_preferences

    # Force complete server-side when both required fields are present — don't trust LLM alone
    if updated_prefs and updated_prefs.location and updated_prefs.budget_max:
        complete = True

    # Geocode whenever location is known — not only when complete — so search_area is
    # cached in the session from the first message that mentions a location.
    search_area = None
    area_data = result.get("search_area", {}) or {}

    if updated_prefs and updated_prefs.location:
        lat = area_data.get("center_lat")
        lng = area_data.get("center_lng")

        if not lat or not lng:
            lat, lng = await _geocode_location(updated_prefs.location)

        if lat and lng:
            radius = area_data.get("radius_miles") or updated_prefs.radius_miles or 10
            search_area = SearchArea(
                center_lat=lat,
                center_lng=lng,
                radius_miles=radius,
                label=area_data.get("label") or updated_prefs.location,
            )
            if updated_prefs:
                updated_prefs.radius_miles = radius
        elif complete:
            # Geocoding failed and we were about to search — ask user to clarify
            complete = False
            response_msg = f"I couldn't locate \"{updated_prefs.location}\" — could you provide a city, state, or zip code?"

    return response_msg, updated_prefs, search_area, complete


async def _geocode_location(location: str) -> Tuple[Optional[float], Optional[float]]:
    """Geocode a location string to lat/lng, constrained to the US."""
    try:
        import asyncio
        import re
        loop = asyncio.get_event_loop()

        is_zip = bool(re.match(r'^\d{5}$', location.strip()))

        # For US zip codes skip the bare query — Nominatim returns the first
        # global match (e.g. 92120 = Raahe, Finland) before San Diego, CA.
        # Always anchor zips to ", USA". City names try plain first, then USA.
        queries = (
            [f"{location}, USA", location]
            if is_zip
            else [location, f"{location}, USA"]
        )

        for query in queries:
            result = await loop.run_in_executor(
                None,
                lambda q=query: _geocoder.geocode(q, timeout=10)
            )
            if result:
                return result.latitude, result.longitude
    except Exception:
        pass

    # Fallback: well-known zip codes (San Diego area)
    zip_coords = {
        "92108": (32.7650, -117.1494),
        "92101": (32.7157, -117.1617),
        "92103": (32.7440, -117.1600),
        "92115": (32.7440, -117.0700),
        "91942": (32.7678, -117.0230),
        "92020": (32.7948, -116.9625),
        "91910": (32.6401, -117.0842),
        "92071": (32.8380, -116.9739),
    }

    loc_clean = location.strip()
    if loc_clean in zip_coords:
        return zip_coords[loc_clean]

    # City-level fallbacks for popular metros
    metro_coords = {
        "san diego": (32.7157, -117.1611),
        "los angeles": (34.0522, -118.2437),
        "san francisco": (37.7749, -122.4194),
        "seattle": (47.6062, -122.3321),
        "portland": (45.5051, -122.6750),
        "denver": (39.7392, -104.9903),
        "austin": (30.2672, -97.7431),
        "dallas": (32.7767, -96.7970),
        "chicago": (41.8781, -87.6298),
        "miami": (25.7617, -80.1918),
        "new york": (40.7128, -74.0060),
        "boston": (42.3601, -71.0589),
        "phoenix": (33.4484, -112.0740),
        "atlanta": (33.7490, -84.3880),
        "nashville": (36.1627, -86.7816),
        "charlotte": (35.2271, -80.8431),
    }
    for city, coords in metro_coords.items():
        if city in location.lower():
            return coords

    return None, None  # Return None to signal geocoding failure
