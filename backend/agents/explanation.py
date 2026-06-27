"""
Explanation Agent — generates human-readable explanations for property recommendations.
"""
from typing import List
from models.schemas import Property, UserPreferences, PropertyExplanation, PropertyCategory
from services import ollama_service


def generate_rule_based_explanation(
    prop: Property,
    preferences: UserPreferences,
    neighborhood_median_psf: float = 0,
) -> PropertyExplanation:
    """Fast rule-based explanations when AI is unavailable or for performance."""
    highlights = []
    why_matches = []
    why_interesting = []
    tradeoffs = []

    # Match signals
    if prop.scores.match >= 75:
        why_matches.append(f"This property directly aligns with your criteria")
    elif prop.scores.match >= 50:
        why_matches.append(f"This property partially matches your requirements")
    else:
        why_matches.append(f"This property doesn't fully match your criteria but has other strengths")

    if preferences.bedrooms_min and prop.beds >= preferences.bedrooms_min:
        why_matches.append(f"Has {prop.beds} bedrooms meeting your {preferences.bedrooms_min}+ requirement")

    if preferences.budget_max and prop.price <= preferences.budget_max:
        pct = (1 - prop.price / preferences.budget_max) * 100
        if pct >= 10:
            why_matches.append(f"Priced {pct:.0f}% under your max budget")
            highlights.append(f"{pct:.0f}% under budget — room to negotiate or upgrade")

    # Value signals
    if neighborhood_median_psf > 0:
        pct_diff = (neighborhood_median_psf - prop.price_per_sqft) / neighborhood_median_psf * 100
        if pct_diff >= 15:
            why_interesting.append(f"${prop.price_per_sqft}/sqft is {pct_diff:.0f}% below the neighborhood average")
            highlights.append(f"{pct_diff:.0f}% below area average price per sqft")
        elif pct_diff >= 5:
            why_interesting.append(f"Slightly below neighborhood price per sqft")
        elif pct_diff < -10:
            tradeoffs.append(f"Priced above neighborhood average at ${prop.price_per_sqft}/sqft")

    # Opportunity signals
    dom = prop.days_on_market or 0
    if dom > 90:
        why_interesting.append(f"Has been on market {dom} days — seller may be motivated")
        highlights.append(f"{dom} days listed — strong negotiation position")
    elif dom > 60:
        why_interesting.append(f"On market for {dom} days with potential for negotiation")

    reductions = prop.price_reductions or 0
    if reductions >= 2:
        why_interesting.append(f"Price reduced {reductions} times — seller is motivated")
        highlights.append(f"{reductions}x price reduced — seller needs to sell")
    elif reductions == 1:
        why_interesting.append(f"Price was reduced once, showing seller flexibility")

    # Category-specific
    if prop.category == PropertyCategory.OPPORTUNITY:
        if not why_interesting:
            why_interesting.append(f"This property shows characteristics of an overlooked opportunity")
    elif prop.category == PropertyCategory.DERIVATIVE:
        why_interesting.append(f"Located near your target area with potentially better value")

    # Features
    for feature in preferences.must_haves:
        feature_lower = feature.lower()
        for f in prop.features:
            if feature_lower in f.lower() or f.lower() in feature_lower:
                why_matches.append(f"Has {f} (one of your must-haves)")
                break

    # Lot size
    if preferences.lot_size_min:
        if prop.lot_sqft and prop.lot_sqft >= preferences.lot_size_min:
            why_matches.append(f"Lot is {prop.lot_sqft:,} sqft — meets your {preferences.lot_size_min:,} sqft minimum")
            highlights.append(f"{prop.lot_sqft:,} sqft lot ✓")
        elif prop.lot_sqft and prop.lot_sqft < preferences.lot_size_min:
            tradeoffs.append(f"Lot is {prop.lot_sqft:,} sqft — below your {preferences.lot_size_min:,} sqft minimum")
        else:
            tradeoffs.append("Lot size not listed on Zillow — verify before scheduling a showing")
            highlights.append("Lot size unverified — confirm with agent")

    # Tradeoffs
    if preferences.budget_max and prop.price > preferences.budget_max:
        over = prop.price - preferences.budget_max
        tradeoffs.append(f"${over:,.0f} over your budget of ${preferences.budget_max:,.0f}")

    if preferences.bedrooms_min and prop.beds < preferences.bedrooms_min:
        tradeoffs.append(f"{prop.beds} beds vs your minimum of {preferences.bedrooms_min}")

    if preferences.sqft_min and prop.sqft < preferences.sqft_min:
        tradeoffs.append(f"{prop.sqft:,} sqft is below your {preferences.sqft_min:,} sqft minimum")

    if not tradeoffs:
        tradeoffs.append("No major tradeoffs identified based on your stated criteria")

    confidence = _estimate_confidence(prop, preferences)

    return PropertyExplanation(
        why_matches=". ".join(why_matches) if why_matches else "Meets several of your search criteria.",
        why_interesting=". ".join(why_interesting) if why_interesting else "Worth considering for its overall profile.",
        tradeoffs=". ".join(tradeoffs),
        confidence=confidence,
        highlights=highlights[:3],
    )


def _estimate_confidence(prop: Property, prefs: UserPreferences) -> float:
    """Estimate confidence in this recommendation."""
    base = 0.65

    # Higher confidence when match score is high
    if prop.scores.match >= 75:
        base += 0.15
    elif prop.scores.match >= 50:
        base += 0.08

    # Higher confidence when we have good data
    if prop.days_on_market is not None:
        base += 0.05
    if prop.price_reductions is not None:
        base += 0.03
    if prop.year_built:
        base += 0.02

    return min(0.95, base)


async def generate_ai_explanations(
    properties: List[Property],
    preferences: UserPreferences,
    neighborhood_psf_map: dict,
) -> List[Property]:
    """
    Generate AI explanations for top properties.
    Falls back to rule-based for all others.
    qwen3.6:35b takes ~30s per call, so limit to top 1 to keep search under ~35s total.
    """
    # Rule-based first pass for all (instant)
    for prop in properties:
        prop.explanation = generate_rule_based_explanation(
            prop, preferences,
            neighborhood_psf_map.get(prop.city, 0)
        )

    if not ollama_service._ollama_available:
        return properties

    # AI upgrade for #1 result only — keeps total search time under ~35s
    if properties:
        try:
            median_psf = neighborhood_psf_map.get(properties[0].city, 0)
            properties[0].explanation = await _ai_explain(properties[0], preferences, median_psf)
        except Exception:
            pass  # Keep the rule-based explanation already set above

    return properties


async def _ai_explain(
    prop: Property,
    prefs: UserPreferences,
    neighborhood_median_psf: float,
) -> PropertyExplanation:
    system = """You are a real estate analyst. Given property data and buyer preferences,
generate a concise, insightful explanation for why this property was recommended.
Respond in JSON with keys: why_matches, why_interesting, tradeoffs, confidence (0-1), highlights (array of 3 short strings)."""

    prop_summary = f"""
Property: {prop.address}, {prop.city}, {prop.state}
Price: ${prop.price:,.0f} (${prop.price_per_sqft}/sqft)
Beds: {prop.beds}, Baths: {prop.baths}, Sqft: {prop.sqft:,}
Days on market: {prop.days_on_market or 'unknown'}
Price reductions: {prop.price_reductions or 0}
Features: {', '.join(prop.features) if prop.features else 'None listed'}
Category: {prop.category.value}
Neighborhood avg psf: ${neighborhood_median_psf:.0f}

Buyer preferences:
Budget: ${prefs.budget_min or 0:,.0f} - ${prefs.budget_max or '?':,}
Needs: {prefs.bedrooms_min or '?'} beds, {prefs.sqft_min or '?'} sqft min
Must-haves: {', '.join(prefs.must_haves) if prefs.must_haves else 'none specified'}
Goal: {prefs.freeform_goal or 'Not specified'}

Scores: Match={prop.scores.match}, Value={prop.scores.value}, Opportunity={prop.scores.opportunity}"""

    result = await ollama_service.generate_structured(
        f"Explain why this property was recommended:\n{prop_summary}",
        system
    )

    if not result:
        raise ValueError("Empty AI response")

    return PropertyExplanation(
        why_matches=result.get("why_matches", "Meets your search criteria."),
        why_interesting=result.get("why_interesting", "Worth considering."),
        tradeoffs=result.get("tradeoffs", "Review details carefully."),
        confidence=float(result.get("confidence", 0.7)),
        highlights=[str(h) for h in result.get("highlights", [])[:3]],
    )
