"""
Discovery Agent — finds derivative and opportunity matches beyond exact criteria.
Also expands search radius to surface hidden gems in nearby areas.
"""
import math
from typing import List, Tuple
from models.schemas import Property, UserPreferences, SearchArea, PropertyCategory
from providers.base import BasePropertyProvider


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def expand_search(
    properties: List[Property],
    preferences: UserPreferences,
    search_area: SearchArea,
    provider: BasePropertyProvider,
) -> List[Property]:
    """
    If we have fewer than 10 properties or few opportunity matches,
    expand the search radius slightly to surface more options.
    """
    opportunity_count = sum(1 for p in properties if p.category == PropertyCategory.OPPORTUNITY)

    if len(properties) >= 15 and opportunity_count >= 3:
        return properties

    # Try expanded radius
    expanded_area = SearchArea(
        center_lat=search_area.center_lat,
        center_lng=search_area.center_lng,
        radius_miles=min(search_area.radius_miles * 1.5, search_area.radius_miles + 10),
        label=search_area.label,
    )

    try:
        extra = await provider.search(expanded_area, preferences, limit=30)
        existing_ids = {p.id for p in properties}
        new_props = [p for p in extra if p.id not in existing_ids]
        properties.extend(new_props[:20])
    except Exception:
        pass

    return properties


def identify_opportunities(properties: List[Property], preferences: UserPreferences) -> List[Property]:
    """
    Post-processing pass to ensure we surface real opportunity matches.
    This runs after initial scoring to make sure opportunities aren't buried.
    """
    budget_max = preferences.budget_max or float('inf')

    for prop in properties:
        is_opportunity = False

        # Long time on market with decent value
        if (prop.days_on_market or 0) > 60 and prop.scores.value >= 55:
            is_opportunity = True

        # Significant price reductions
        if (prop.price_reductions or 0) >= 2:
            is_opportunity = True

        # Significantly underpriced vs neighborhood
        if prop.scores.value >= 80 and prop.price <= budget_max * 1.1:
            is_opportunity = True

        # Well under budget with good features
        if (budget_max < float('inf') and
                prop.price <= budget_max * 0.80 and
                prop.scores.match >= 40 and
                len(prop.features) >= 3):
            is_opportunity = True

        if is_opportunity and prop.category != PropertyCategory.EXACT:
            prop.category = PropertyCategory.OPPORTUNITY

    return properties


def generate_derivative_areas(
    search_area: SearchArea,
    properties: List[Property],
    preferences: UserPreferences,
) -> List[Tuple[float, float, str]]:
    """
    Suggest nearby areas worth exploring based on value signals.
    Returns list of (lat, lng, label) tuples.
    """
    if not properties:
        return []

    # Find neighborhoods with best value scores
    city_value: dict = {}
    for p in properties:
        if p.city not in city_value:
            city_value[p.city] = []
        city_value[p.city].append(p.scores.value)

    city_avg_value = {
        city: sum(scores) / len(scores)
        for city, scores in city_value.items()
    }

    # Get top value cities that aren't the primary search city
    sorted_cities = sorted(city_avg_value.items(), key=lambda x: x[1], reverse=True)

    suggestions = []
    for city, avg_val in sorted_cities[:3]:
        city_props = [p for p in properties if p.city == city and avg_val > 65]
        if city_props:
            # Use centroid of city properties
            lat = sum(p.latitude for p in city_props) / len(city_props)
            lng = sum(p.longitude for p in city_props) / len(city_props)
            suggestions.append((lat, lng, f"{city} — avg value score {avg_val:.0f}"))

    return suggestions
