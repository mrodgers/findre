from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from enum import Enum


class PropertyType(str, Enum):
    SINGLE_FAMILY = "single_family"
    CONDO = "condo"
    TOWNHOUSE = "townhouse"
    MULTI_FAMILY = "multi_family"
    LAND = "land"
    ANY = "any"


class PropertyCategory(str, Enum):
    EXACT = "exact"
    DERIVATIVE = "derivative"
    OPPORTUNITY = "opportunity"


class UserPreferences(BaseModel):
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    location: str = ""
    radius_miles: float = 10.0
    property_type: List[str] = Field(default_factory=list)
    bedrooms_min: Optional[int] = None
    bathrooms_min: Optional[float] = None
    sqft_min: Optional[int] = None
    lot_size_min: Optional[int] = None
    single_family_only: bool = False
    commute_location: Optional[str] = None
    school_rating_min: Optional[float] = None
    must_haves: List[str] = Field(default_factory=list)
    nice_to_haves: List[str] = Field(default_factory=list)
    deal_breakers: List[str] = Field(default_factory=list)
    freeform_goal: Optional[str] = None


class ScoreWeights(BaseModel):
    match: float = 40
    value: float = 35
    opportunity: float = 25


class SearchArea(BaseModel):
    center_lat: float
    center_lng: float
    radius_miles: float
    label: str


class PropertyScore(BaseModel):
    match: int = 0
    value: int = 0
    opportunity: int = 0
    composite: int = 0


class PropertyExplanation(BaseModel):
    why_matches: str = ""
    why_interesting: str = ""
    tradeoffs: str = ""
    confidence: float = 0.7
    highlights: List[str] = Field(default_factory=list)


class Property(BaseModel):
    id: str
    address: str
    city: str
    state: str
    zip: str
    price: float
    beds: int
    baths: float
    sqft: int
    lot_sqft: Optional[int] = None
    year_built: Optional[int] = None
    property_type: str = "single_family"
    latitude: float
    longitude: float
    images: List[str] = Field(default_factory=list)
    listing_url: Optional[str] = None
    days_on_market: Optional[int] = None
    price_reductions: Optional[int] = None
    price_per_sqft: float
    description: Optional[str] = None
    features: List[str] = Field(default_factory=list)
    scores: PropertyScore = Field(default_factory=PropertyScore)
    category: PropertyCategory = PropertyCategory.EXACT
    explanation: PropertyExplanation = Field(default_factory=PropertyExplanation)


class ChatRequest(BaseModel):
    message: str
    session_id: str
    current_preferences: Optional[UserPreferences] = None


class ChatResponse(BaseModel):
    message: str
    preferences: Optional[UserPreferences] = None
    search_area: Optional[SearchArea] = None
    complete: bool = False
    follow_up: Optional[str] = None


class SearchRequest(BaseModel):
    preferences: UserPreferences
    search_area: SearchArea
    weights: ScoreWeights
    session_id: str


class SearchResponse(BaseModel):
    properties: List[Property]
    search_area: SearchArea
    total_found: int
    categories: dict
    quota_exhausted: bool = False


class ApiStatus(BaseModel):
    ollama_available: bool
    ollama_model: Optional[str] = None
    zillow_configured: bool
    using_demo_data: bool
    quota_exhausted: bool = False


class PropertyDetails(BaseModel):
    zpid: str
    description: Optional[str] = None
    zestimate: Optional[int] = None
    zestimate_low_pct: Optional[int] = None
    zestimate_high_pct: Optional[int] = None
    days_on_zillow: Optional[int] = None
    favorite_count: Optional[int] = None
    page_view_count: Optional[int] = None
    hoa_fee: Optional[float] = None
    hoa_frequency: Optional[str] = None
    street_view_url: Optional[str] = None
    photos_high_res: List[str] = Field(default_factory=list)
    virtual_tour_url: Optional[str] = None
    floor_plan_url: Optional[str] = None
    has_cooling: Optional[bool] = None
    has_garage: Optional[bool] = None
    garage_spaces: Optional[int] = None
    has_pool: Optional[bool] = None
    at_a_glance: List[dict] = Field(default_factory=list)
    price_change: Optional[dict] = None


class ZillowKeyRequest(BaseModel):
    api_key: str


class InteractionRequest(BaseModel):
    property_id: str
    action: str
    session_id: str
