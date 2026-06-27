"""
Demo data provider — generates realistic synthetic listings for development/testing.
Used when no real API credentials are configured.
"""
import random
import math
import uuid
from typing import List
from models.schemas import Property, SearchArea, UserPreferences
from providers.base import BasePropertyProvider

# San Diego neighborhoods with realistic characteristics
SD_NEIGHBORHOODS = [
    {"name": "Mission Valley", "lat": 32.7650, "lng": -117.1494, "avg_psf": 450, "school_rating": 7.0},
    {"name": "North Park", "lat": 32.7440, "lng": -117.1302, "avg_psf": 580, "school_rating": 7.5},
    {"name": "Ocean Beach", "lat": 32.7470, "lng": -117.2469, "avg_psf": 700, "school_rating": 7.0},
    {"name": "La Mesa", "lat": 32.7678, "lng": -117.0230, "avg_psf": 380, "school_rating": 8.0},
    {"name": "El Cajon", "lat": 32.7948, "lng": -116.9625, "avg_psf": 310, "school_rating": 6.5},
    {"name": "Chula Vista", "lat": 32.6401, "lng": -117.0842, "avg_psf": 350, "school_rating": 7.0},
    {"name": "Santee", "lat": 32.8380, "lng": -116.9739, "avg_psf": 340, "school_rating": 7.5},
    {"name": "Lakeside", "lat": 32.8578, "lng": -116.9219, "avg_psf": 290, "school_rating": 6.0},
    {"name": "Spring Valley", "lat": 32.7450, "lng": -116.9989, "avg_psf": 320, "school_rating": 6.5},
    {"name": "Lemon Grove", "lat": 32.7261, "lng": -117.0314, "avg_psf": 360, "school_rating": 7.0},
    {"name": "National City", "lat": 32.6781, "lng": -117.0992, "avg_psf": 330, "school_rating": 6.0},
    {"name": "Poway", "lat": 32.9628, "lng": -117.0359, "avg_psf": 420, "school_rating": 9.0},
    {"name": "Ramona", "lat": 33.0417, "lng": -116.8697, "avg_psf": 250, "school_rating": 7.0},
    {"name": "Alpine", "lat": 32.8350, "lng": -116.7641, "avg_psf": 270, "school_rating": 7.5},
    {"name": "Rancho Bernardo", "lat": 33.0153, "lng": -117.0717, "avg_psf": 460, "school_rating": 9.5},
]

FEATURE_POOL = [
    "Large garage", "Workshop space", "Pool", "Spa", "Solar panels",
    "ADU/granny flat", "Mountain views", "Ocean views", "Cul-de-sac",
    "Large lot", "Remodeled kitchen", "Updated bathrooms", "Hardwood floors",
    "Vaulted ceilings", "Open floor plan", "3-car garage", "RV parking",
    "Fruit trees", "Vegetable garden area", "Central A/C", "Fireplace",
    "Built-in storage", "Walk-in closet", "Home office", "Bonus room",
    "Smart home", "EV charger", "Energy efficient", "New roof",
]

STREET_NAMES = [
    "Oak", "Maple", "Cedar", "Pine", "Willow", "Elm", "Birch", "Sycamore",
    "Vista", "Canyon", "Mesa", "Valley", "Hillside", "Mission", "Pacific",
    "Garden", "Spring", "Sunrise", "Sunset", "Sierra",
]

STREET_TYPES = ["St", "Ave", "Blvd", "Dr", "Ln", "Way", "Ct", "Rd", "Pl", "Cir"]


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _random_offset(miles: float) -> tuple[float, float]:
    angle = random.uniform(0, 2 * math.pi)
    dist = random.uniform(0, miles)
    lat_offset = dist / 69.0 * math.cos(angle)
    lng_offset = dist / 69.0 * math.sin(angle)
    return lat_offset, lng_offset


def _generate_property(
    hood: dict,
    rng: random.Random,
    budget_max: float = 1_200_000,
    dom_boost: bool = False,
    price_drop: bool = False,
) -> Property:
    beds = rng.choices([2, 3, 3, 3, 4, 4, 5], weights=[5, 20, 20, 20, 20, 10, 5])[0]
    baths = rng.choice([1.0, 1.5, 2.0, 2.5, 3.0, 3.5] if beds >= 3 else [1.0, 1.5, 2.0])
    base_sqft = 600 + beds * 250 + rng.randint(-150, 300)
    sqft = max(700, base_sqft + rng.randint(-100, 400))

    # Price variance: sometimes underpriced (opportunity!)
    price_variance = rng.gauss(1.0, 0.12)
    if dom_boost:
        price_variance *= rng.uniform(0.88, 0.96)
    if price_drop:
        price_variance *= rng.uniform(0.90, 0.97)

    psf = hood["avg_psf"] * price_variance
    price = round(psf * sqft / 10000) * 10000
    price = min(price, budget_max * 1.15)  # Allow slightly over budget

    lat_off, lng_off = _random_offset(0.8)
    lat = hood["lat"] + lat_off
    lng = hood["lng"] + lng_off

    street_num = rng.randint(100, 9999)
    street = f"{rng.choice(STREET_NAMES)} {rng.choice(STREET_TYPES)}"
    address = f"{street_num} {street}"

    year_built = rng.randint(1955, 2023)
    lot_sqft = rng.randint(4000, 25000) if rng.random() > 0.3 else None

    features = rng.sample(FEATURE_POOL, rng.randint(2, 6))

    dom = rng.randint(90, 240) if dom_boost else rng.randint(1, 60)
    reductions = rng.randint(1, 3) if price_drop else (1 if dom_boost and rng.random() > 0.5 else 0)

    return Property(
        id=str(uuid.uuid4()),
        address=address,
        city=hood["name"],
        state="CA",
        zip=f"919{rng.randint(10, 99)}",
        price=price,
        beds=beds,
        baths=baths,
        sqft=sqft,
        lot_sqft=lot_sqft,
        year_built=year_built,
        property_type="single_family",
        latitude=lat,
        longitude=lng,
        images=[],
        listing_url=None,
        days_on_market=dom,
        price_reductions=reductions,
        price_per_sqft=round(price / sqft),
        description=None,
        features=features,
    )


class DemoProvider(BasePropertyProvider):
    name = "demo"

    @property
    def is_configured(self) -> bool:
        return True

    async def search(
        self,
        search_area: SearchArea,
        preferences: UserPreferences,
        limit: int = 60,
    ) -> List[Property]:
        rng = random.Random(hash(f"{search_area.center_lat:.3f}{search_area.center_lng:.3f}"))
        budget_max = preferences.budget_max or 1_000_000

        # Find nearby neighborhoods
        nearby = []
        for hood in SD_NEIGHBORHOODS:
            dist = _haversine(
                search_area.center_lat, search_area.center_lng,
                hood["lat"], hood["lng"]
            )
            if dist <= search_area.radius_miles * 1.3:
                nearby.append((dist, hood))

        # Fall back to closest if none in radius
        if not nearby:
            nearby = sorted(
                [(
                    _haversine(search_area.center_lat, search_area.center_lng, h["lat"], h["lng"]),
                    h
                ) for h in SD_NEIGHBORHOODS],
                key=lambda x: x[0]
            )[:5]

        properties = []

        for dist, hood in nearby[:8]:
            count = max(3, int(12 / max(1, len(nearby))))
            for i in range(count):
                is_opportunity = rng.random() < 0.25
                is_price_drop = rng.random() < 0.20
                p = _generate_property(
                    hood, rng,
                    budget_max=budget_max,
                    dom_boost=is_opportunity,
                    price_drop=is_price_drop,
                )
                if len(properties) < limit:
                    properties.append(p)

        return properties

    async def get_comparable_sales(
        self,
        latitude: float,
        longitude: float,
        radius_miles: float = 0.5,
        sqft: int = 1500,
    ) -> List[dict]:
        rng = random.Random(hash(f"{latitude:.3f}{longitude:.3f}"))
        base_psf = rng.uniform(300, 600)
        return [
            {"price": int(base_psf * sqft * rng.uniform(0.9, 1.1)), "sqft": sqft + rng.randint(-200, 200)}
            for _ in range(5)
        ]
