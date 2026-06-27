"""
Orchestrator — coordinates all agents to produce final recommendations.
"""
from typing import List, Optional, Dict
from models.schemas import Property, UserPreferences, SearchArea, ScoreWeights
from providers.base import BasePropertyProvider
from agents import scoring, discovery, explanation


# Session state: tracks session-level learning
_session_state: Dict[str, dict] = {}


def get_session(session_id: str) -> dict:
    if session_id not in _session_state:
        _session_state[session_id] = {
            "interactions": [],
            "adjusted_weights": None,
        }
    return _session_state[session_id]


async def run_search(
    preferences: UserPreferences,
    search_area: SearchArea,
    weights: ScoreWeights,
    provider: BasePropertyProvider,
    session_id: str,
) -> List[Property]:
    """
    Full orchestrated search pipeline:
    1. Fetch listings from provider
    2. Expand search if needed (Discovery Agent)
    3. Score all properties (Recommendation Agent)
    4. Identify opportunities (Discovery Agent)
    5. Generate explanations (Explanation Agent)
    6. Apply session learning adjustments
    """

    # Step 1: Fetch
    properties = await provider.search(search_area, preferences, limit=60)

    if not properties:
        return []

    # Step 1b: Hard filters — drop properties that can never satisfy hard requirements
    properties = _apply_hard_filters(properties, preferences)

    if not properties:
        return []

    # Step 2: Expand if sparse
    properties = await discovery.expand_search(properties, preferences, search_area, provider)

    # Deduplicate by address+city fingerprint
    seen = set()
    unique = []
    for p in properties:
        key = f"{p.address.lower().strip()}|{p.city.lower().strip()}"
        if key not in seen:
            seen.add(key)
            unique.append(p)
    properties = unique

    # Step 3: Compute neighborhood PSF map for value scoring
    neighborhood_psf_map = _compute_psf_map(properties)

    # Step 4: Score
    effective_weights = _apply_session_learning(weights, session_id)
    properties = scoring.score_all(properties, preferences, effective_weights, neighborhood_psf_map)

    # Step 5: Post-process opportunities
    properties = discovery.identify_opportunities(properties, preferences)

    # Re-sort after opportunity identification
    properties.sort(key=lambda p: p.scores.composite, reverse=True)

    # Step 6: Generate explanations (AI for top, rule-based for rest)
    properties = await explanation.generate_ai_explanations(properties, preferences, neighborhood_psf_map)

    return properties


def _apply_hard_filters(properties: List[Property], prefs: UserPreferences) -> List[Property]:
    """
    Drop properties that definitively fail a hard requirement.
    Only exclude when we have confirmed data — never exclude on missing data.
    """
    filtered = []
    excluded_types = set()

    # Build excluded property types
    if prefs.single_family_only or prefs.lot_size_min:
        # Multi-family and condos don't have private lots
        excluded_types = {"multi_family", "condo"}

    for prop in properties:
        # Hard lot size check — only drop if lot_sqft is known and too small
        if prefs.lot_size_min and prop.lot_sqft is not None:
            if prop.lot_sqft < prefs.lot_size_min:
                continue

        # Property type exclusion when a private lot is required
        if excluded_types and prop.property_type in excluded_types:
            continue

        filtered.append(prop)

    dropped = len(properties) - len(filtered)
    if dropped:
        print(f"[Filter] Hard filters removed {dropped}/{len(properties)} properties "
              f"(lot_size_min={prefs.lot_size_min}, single_family_only={prefs.single_family_only})",
              flush=True)

    return filtered


def _compute_psf_map(properties: List[Property]) -> dict:
    city_psf: dict = {}
    for p in properties:
        if p.city not in city_psf:
            city_psf[p.city] = []
        if p.price_per_sqft > 0:
            city_psf[p.city].append(p.price_per_sqft)

    result = {}
    for city, psfs in city_psf.items():
        if psfs:
            sorted_psfs = sorted(psfs)
            n = len(sorted_psfs)
            result[city] = sorted_psfs[n // 2]
    return result


def record_interaction(session_id: str, property_id: str, action: str, properties: List[Property]):
    """Record user interaction for session learning."""
    session = get_session(session_id)
    prop = next((p for p in properties if p.id == property_id), None)

    if prop:
        session["interactions"].append({
            "action": action,
            "scores": prop.scores.model_dump(),
            "category": prop.category.value,
        })


def _apply_session_learning(weights: ScoreWeights, session_id: str) -> ScoreWeights:
    """Adjust weights based on session interaction patterns."""
    session = get_session(session_id)
    interactions = session.get("interactions", [])

    if len(interactions) < 3:
        return weights  # Not enough signal yet

    likes = [i for i in interactions if i["action"] == "like"]
    dislikes = [i for i in interactions if i["action"] == "dislike"]

    if not likes and not dislikes:
        return weights

    # Compute average scores for liked vs disliked
    def avg_scores(interactions_list):
        if not interactions_list:
            return {"match": 50, "value": 50, "opportunity": 50}
        return {
            "match": sum(i["scores"]["match"] for i in interactions_list) / len(interactions_list),
            "value": sum(i["scores"]["value"] for i in interactions_list) / len(interactions_list),
            "opportunity": sum(i["scores"]["opportunity"] for i in interactions_list) / len(interactions_list),
        }

    like_avg = avg_scores(likes)

    # Boost weights for dimensions that are high in liked properties
    adjustments = {
        "match": (like_avg["match"] - 50) / 50 * 5,
        "value": (like_avg["value"] - 50) / 50 * 5,
        "opportunity": (like_avg["opportunity"] - 50) / 50 * 5,
    }

    new_weights = ScoreWeights(
        match=max(10, min(70, weights.match + adjustments["match"])),
        value=max(10, min(70, weights.value + adjustments["value"])),
        opportunity=max(10, min(70, weights.opportunity + adjustments["opportunity"])),
    )

    # Normalize
    total = new_weights.match + new_weights.value + new_weights.opportunity
    factor = 100 / total
    return ScoreWeights(
        match=round(new_weights.match * factor),
        value=round(new_weights.value * factor),
        opportunity=100 - round(new_weights.match * factor) - round(new_weights.value * factor),
    )
