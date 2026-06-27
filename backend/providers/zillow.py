"""
Zillow provider via Zillo Realtime Scraper on RapidAPI.
Host: zillo-realtime-scraper.p.rapidapi.com

API key must be set via /api/config/zillow-key or ZILLOW_API_KEY env var.

NOTE: The free plan allows 5 calls/month. Searches are cached aggressively (12h TTL)
to minimise consumption. Each unique bounding box + filter combo counts as one call.
"""
import math
import httpx
import os
import logging
from typing import List, Optional

log = logging.getLogger(__name__)
from models.schemas import Property, SearchArea, UserPreferences
from providers.base import BasePropertyProvider
from storage.cache import config_get, cache_get, cache_set, make_cache_key

RAPIDAPI_HOST = "zillo-realtime-scraper.p.rapidapi.com"
RAPIDAPI_BASE = f"https://{RAPIDAPI_HOST}"

# Cache live results for 12 hours to conserve the monthly API quota
SEARCH_CACHE_TTL = 43200


class QuotaExhaustedError(RuntimeError):
    """Raised when the RapidAPI monthly quota is exhausted (HTTP 429)."""


def _bounding_box(center_lat: float, center_lng: float, radius_miles: float) -> dict:
    """Convert center + radius to a lat/lng bounding box."""
    lat_deg = radius_miles / 69.0
    lng_deg = radius_miles / (69.0 * math.cos(math.radians(center_lat)))
    return {
        "north_latitude": round(center_lat + lat_deg, 6),
        "south_latitude": round(center_lat - lat_deg, 6),
        "east_longitude": round(center_lng + lng_deg, 6),
        "west_longitude": round(center_lng - lng_deg, 6),
    }


def _property_type_label(raw: str) -> str:
    mapping = {
        "singleFamily": "single_family",
        "condo": "condo",
        "townhouse": "townhouse",
        "multiFamily": "multi_family",
        "land": "land",
    }
    return mapping.get(raw, raw or "single_family")


class ZillowProvider(BasePropertyProvider):
    name = "zillow"

    def __init__(self):
        self._api_key: Optional[str] = None
        self.quota_exhausted: bool = False

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def load_key(self):
        key = os.environ.get("ZILLOW_API_KEY") or await config_get("zillow_api_key")
        self._api_key = key

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "x-rapidapi-key": self._api_key or "",
            "x-rapidapi-host": RAPIDAPI_HOST,
        }

    async def search(
        self,
        search_area: SearchArea,
        preferences: UserPreferences,
        limit: int = 50,
    ) -> List[Property]:
        cache_key = make_cache_key("zillo_search", {
            "lat": round(search_area.center_lat, 2),
            "lng": round(search_area.center_lng, 2),
            "radius": search_area.radius_miles,
            "budget_max": preferences.budget_max,
            "budget_min": preferences.budget_min,
            "beds_min": preferences.bedrooms_min,
            "baths_min": preferences.bathrooms_min,
            "sqft_min": preferences.sqft_min,
        })

        cached = await cache_get(cache_key)
        if cached:
            return [Property(**p) for p in cached]

        bbox = _bounding_box(search_area.center_lat, search_area.center_lng, search_area.radius_miles)

        body: dict = {
            "location": search_area.label or f"{search_area.center_lat},{search_area.center_lng}",
            "search_type": "sale",
            **bbox,
        }
        if preferences.budget_max:
            body["price_max"] = int(preferences.budget_max)
        if preferences.budget_min:
            body["price_min"] = int(preferences.budget_min)
        if preferences.bedrooms_min:
            body["beds_min"] = preferences.bedrooms_min
        if preferences.bathrooms_min:
            body["baths_min"] = int(preferences.bathrooms_min)
        if preferences.sqft_min:
            body["sqft_min"] = preferences.sqft_min

        log.info("Zillow search body: %s", body)
        print(f"[Zillow] Searching: {body}", flush=True)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{RAPIDAPI_BASE}/search_homes/index.php",
                headers=self._headers(),
                json=body,
            )
            if resp.status_code == 429:
                self.quota_exhausted = True
                raise QuotaExhaustedError(
                    "Monthly API quota exhausted. Upgrade at rapidapi.com or wait until next month."
                )
            resp.raise_for_status()
            data = resp.json()

        success = data.get("success")
        raw_results = (data.get("data") or {}).get("searchResults") or []
        print(f"[Zillow] Response: success={success}, raw_results={len(raw_results)}, top-level keys={list(data.keys())}", flush=True)
        if not success:
            print(f"[Zillow] Error response: {data}", flush=True)

        if not data.get("success"):
            raise RuntimeError(f"Zillow API error: {data.get('message')}")

        results = raw_results
        props = []
        for item in results[:limit]:
            try:
                p = self._parse_result(item)
                if p:
                    props.append(p)
            except Exception as e:
                log.warning("Failed to parse result: %s", e)
                continue

        print(f"[Zillow] Parsed {len(props)} / {len(results)} results", flush=True)

        await cache_set(cache_key, [p.model_dump() for p in props], ttl_seconds=SEARCH_CACHE_TTL)
        return props

    def _parse_result(self, item: dict) -> Optional[Property]:
        prop = item.get("property", {})
        if not prop:
            return None

        price_data = prop.get("price") or {}
        price = price_data.get("value") if isinstance(price_data, dict) else price_data

        loc = prop.get("location") or {}
        lat = loc.get("latitude")
        lng = loc.get("longitude")

        if not price or not lat or not lng:
            return None

        addr = prop.get("address") or {}
        sqft = prop.get("livingArea") or 1200
        lot = (prop.get("lotSizeWithUnit") or {}).get("lotSize")

        # Build listing URL from zpid
        zpid = prop.get("zpid")
        listing_url = f"https://www.zillow.com/homedetails/{zpid}_zpid/" if zpid else None

        # Photos
        photo_links = (prop.get("media") or {}).get("propertyPhotoLinks") or {}
        image = photo_links.get("highResolutionLink") or photo_links.get("mediumSizeLink") or photo_links.get("defaultLink")
        images = [image] if image else []

        # PSF
        psf = price_data.get("pricePerSquareFoot") if isinstance(price_data, dict) else None
        if not psf and sqft:
            psf = round(float(price) / int(sqft))

        return Property(
            id=str(zpid or id(prop)),
            address=addr.get("streetAddress", "Unknown"),
            city=addr.get("city", ""),
            state=addr.get("state", "CA"),
            zip=addr.get("zipcode", ""),
            price=float(price),
            beds=int(prop.get("bedrooms") or 0),
            baths=float(prop.get("bathrooms") or 0),
            sqft=int(sqft),
            lot_sqft=int(lot) if lot else None,
            year_built=prop.get("yearBuilt"),
            property_type=_property_type_label(prop.get("propertyType") or ""),
            latitude=float(lat),
            longitude=float(lng),
            images=images,
            listing_url=listing_url,
            days_on_market=prop.get("daysOnZillow"),
            price_reductions=None,  # Not in search results; would need home_details call
            price_per_sqft=int(psf) if psf else 0,
            description=None,
            features=[],
        )

    async def get_home_details(self, zpid: str, listing_url: str) -> dict:
        """
        Fetch enriched home details on demand (called when user opens a property).
        Cached per zpid for 24 hours — each call costs 1 quota unit.
        Returns a dict with zestimate, description, demand signals, photos, etc.
        """
        cache_key = make_cache_key("zillo_details", {"zpid": zpid})
        cached = await cache_get(cache_key)
        if cached:
            return cached

        url = listing_url or f"https://www.zillow.com/homedetails/{zpid}_zpid/"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{RAPIDAPI_BASE}/home_details/index.php",
                headers=self._headers(),
                json={"zillow_url": url},
            )
            if resp.status_code == 429:
                self.quota_exhausted = True
                raise QuotaExhaustedError("Monthly API quota exhausted.")
            resp.raise_for_status()
            data = resp.json()

        prop = (
            (data.get("data") or {})
            .get("home_details", {})
            .get("data", {})
            .get("property", {})
        ) or {}

        rr = prop.get("resoFacts") or {}
        photo_list = prop.get("photoUrlsHighRes") or prop.get("photoUrls") or []
        photos = [p["url"] for p in photo_list if isinstance(p, dict) and p.get("url")]

        rich = prop.get("richMedia") or {}
        tours = rich.get("virtualTour") or []
        floor_plans = rich.get("floorPlan") or []

        result = {
            "zpid": zpid,
            "description": prop.get("description"),
            "zestimate": prop.get("zestimate"),
            "zestimate_low_pct": prop.get("zestimateLowPercent"),
            "zestimate_high_pct": prop.get("zestimateHighPercent"),
            "days_on_zillow": prop.get("daysOnZillow"),
            "favorite_count": prop.get("favoriteCount"),
            "page_view_count": prop.get("pageViewCount"),
            "hoa_fee": prop.get("hoaFee"),
            "hoa_frequency": prop.get("hoaFeeFrequency"),
            "street_view_url": prop.get("streetViewImageUrl"),
            "photos_high_res": photos[:12],
            "virtual_tour_url": tours[0].get("viewerUrl") if tours else None,
            "floor_plan_url": floor_plans[0].get("viewerUrl") if floor_plans else None,
            "has_cooling": rr.get("hasCooling"),
            "has_garage": rr.get("hasGarage"),
            "garage_spaces": rr.get("garageParkingCapacity"),
            "has_pool": rr.get("hasPrivatePool"),
            "at_a_glance": rr.get("atAGlanceFacts") or [],
            "price_change": (prop.get("formattedChip") or {}).get("priceChange"),
        }

        await cache_set(cache_key, result, ttl_seconds=86400)
        return result

    async def get_comparable_sales(
        self,
        latitude: float,
        longitude: float,
        radius_miles: float = 0.5,
        sqft: int = 1500,
    ) -> List[dict]:
        """
        Fetch recently sold comps for value scoring.
        Uses a tight bounding box to stay near the subject property.
        Cached for 24 hours to conserve the monthly API quota.
        """
        cache_key = make_cache_key("zillo_comps", {
            "lat": round(latitude, 2),
            "lng": round(longitude, 2),
        })
        cached = await cache_get(cache_key)
        if cached:
            return cached

        bbox = _bounding_box(latitude, longitude, radius_miles)
        body = {
            "location": f"{latitude},{longitude}",
            "search_type": "recently_sold",
            **bbox,
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{RAPIDAPI_BASE}/search_homes/index.php",
                    headers=self._headers(),
                    json=body,
                )
                resp.raise_for_status()
                data = resp.json()

            results = (data.get("data") or {}).get("searchResults") or []
            comps = []
            for item in results[:8]:
                p = item.get("property") or {}
                price_data = p.get("price") or {}
                price = price_data.get("value") if isinstance(price_data, dict) else price_data
                living_area = p.get("livingArea") or sqft
                if price:
                    comps.append({"price": int(price), "sqft": int(living_area)})

            await cache_set(cache_key, comps, ttl_seconds=86400)
            return comps
        except Exception:
            return []
