"""
Recommendation Agent — scores properties against user preferences.
"""
import math
from typing import List, Optional
from models.schemas import Property, UserPreferences, ScoreWeights, PropertyScore, PropertyCategory


def score_all(
    properties: List[Property],
    preferences: UserPreferences,
    weights: ScoreWeights,
    neighborhood_psf_map: dict = None,
) -> List[Property]:
    """Score and categorize all properties."""
    if not properties:
        return []

    # Compute neighborhood PSF averages for relative value scoring
    if not neighborhood_psf_map:
        neighborhood_psf_map = _compute_psf_map(properties)

    global_median_psf = _median([p.price_per_sqft for p in properties if p.price_per_sqft > 0])

    scored = []
    for prop in properties:
        match = _match_score(prop, preferences)
        value = _value_score(prop, neighborhood_psf_map, global_median_psf)
        opportunity = _opportunity_score(prop, preferences)

        composite = int(
            (match * weights.match + value * weights.value + opportunity * weights.opportunity) / 100
        )

        prop.scores = PropertyScore(
            match=match,
            value=value,
            opportunity=opportunity,
            composite=composite,
        )

        prop.category = _categorize(prop, preferences)
        scored.append(prop)

    # Sort by composite score
    scored.sort(key=lambda p: p.scores.composite, reverse=True)
    return scored


def _match_score(prop: Property, prefs: UserPreferences) -> int:
    score = 100
    deductions = 0

    # Budget
    if prefs.budget_max and prop.price > prefs.budget_max:
        over_pct = (prop.price - prefs.budget_max) / prefs.budget_max
        deductions += min(60, int(over_pct * 200))
    elif prefs.budget_max and prop.price <= prefs.budget_max:
        # Reward being well under budget
        under_pct = (prefs.budget_max - prop.price) / prefs.budget_max
        score += min(10, int(under_pct * 30))

    if prefs.budget_min and prop.price < prefs.budget_min:
        deductions += 10  # Slightly concerning if way under min

    # Bedrooms
    if prefs.bedrooms_min and prop.beds < prefs.bedrooms_min:
        deductions += 25 * (prefs.bedrooms_min - prop.beds)

    # Bathrooms
    if prefs.bathrooms_min and prop.baths < prefs.bathrooms_min:
        deductions += 15 * int(prefs.bathrooms_min - prop.baths)

    # Square footage
    if prefs.sqft_min and prop.sqft < prefs.sqft_min:
        under_pct = (prefs.sqft_min - prop.sqft) / prefs.sqft_min
        deductions += int(under_pct * 40)

    # Must-haves
    for feature in prefs.must_haves:
        feature_lower = feature.lower()
        prop_features_lower = [f.lower() for f in prop.features]
        if not any(feature_lower in f or f in feature_lower for f in prop_features_lower):
            deductions += 15

    # Deal breakers (check description and features)
    prop_text = " ".join([prop.description or "", *prop.features, prop.property_type]).lower()
    for breaker in prefs.deal_breakers:
        if breaker.lower() in prop_text:
            deductions += 40

    return max(0, min(100, score - deductions))


def _value_score(prop: Property, psf_map: dict, global_median_psf: float) -> int:
    if prop.price_per_sqft <= 0 or global_median_psf <= 0:
        return 50

    # Compare to neighborhood average
    neighborhood_psf = psf_map.get(prop.city, global_median_psf)

    # Negative = cheaper than median (good)
    pct_diff = (prop.price_per_sqft - neighborhood_psf) / neighborhood_psf

    # Map: -30% or better → 95, at median → 55, +30% above → 20
    if pct_diff <= -0.30:
        value = 95
    elif pct_diff <= -0.15:
        value = int(95 - ((pct_diff + 0.30) / 0.15) * 20)
    elif pct_diff <= 0:
        value = int(75 - ((pct_diff + 0.15) / 0.15) * 20)
    elif pct_diff <= 0.15:
        value = int(55 - (pct_diff / 0.15) * 20)
    elif pct_diff <= 0.30:
        value = int(35 - ((pct_diff - 0.15) / 0.15) * 15)
    else:
        value = max(10, 20 - int((pct_diff - 0.30) * 30))

    # Bonus for large sqft relative to price
    if prop.sqft > 2000 and prop.price_per_sqft < neighborhood_psf * 0.85:
        value += 8

    return max(0, min(100, value))


def _opportunity_score(prop: Property, prefs: UserPreferences) -> int:
    score = 30  # Base opportunity score

    # Long days on market
    dom = prop.days_on_market or 0
    if dom > 90:
        score += 35
    elif dom > 60:
        score += 25
    elif dom > 30:
        score += 10

    # Price reductions
    reductions = prop.price_reductions or 0
    if reductions >= 2:
        score += 25
    elif reductions == 1:
        score += 15

    # Under budget with good features
    if prefs.budget_max and prop.price < prefs.budget_max * 0.85:
        score += 10

    # Nice-to-haves present (pleasant surprise)
    nice_matches = sum(
        1 for feature in prefs.nice_to_haves
        if any(feature.lower() in f.lower() or f.lower() in feature.lower()
               for f in prop.features)
    )
    score += nice_matches * 5

    return max(0, min(100, score))


def _categorize(prop: Property, prefs: UserPreferences) -> PropertyCategory:
    match = prop.scores.match
    value = prop.scores.value
    opportunity = prop.scores.opportunity

    # Opportunity: low match but high opportunity/value signals
    if opportunity >= 65 and (prop.days_on_market or 0) > 60:
        return PropertyCategory.OPPORTUNITY
    if (prop.price_reductions or 0) >= 2 and value >= 65:
        return PropertyCategory.OPPORTUNITY

    # Exact: good match score
    if match >= 65 and prop.scores.composite >= 55:
        return PropertyCategory.EXACT

    # Derivative: reasonable match or nearby
    if match >= 40 or (value >= 65 and prop.scores.composite >= 50):
        return PropertyCategory.DERIVATIVE

    # Check if it's an opportunity despite lower match
    if opportunity >= 55 and value >= 60:
        return PropertyCategory.OPPORTUNITY

    return PropertyCategory.DERIVATIVE


def _compute_psf_map(properties: List[Property]) -> dict:
    city_psf: dict = {}
    for p in properties:
        if p.city not in city_psf:
            city_psf[p.city] = []
        if p.price_per_sqft > 0:
            city_psf[p.city].append(p.price_per_sqft)
    return {city: _median(psfs) for city, psfs in city_psf.items() if psfs}


def _median(values: list) -> float:
    if not values:
        return 0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    mid = n // 2
    return sorted_vals[mid] if n % 2 else (sorted_vals[mid - 1] + sorted_vals[mid]) / 2
