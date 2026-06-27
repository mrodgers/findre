from abc import ABC, abstractmethod
from typing import List, Optional
from models.schemas import Property, SearchArea, UserPreferences


class BasePropertyProvider(ABC):
    """Abstract base for all property data providers."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    async def search(
        self,
        search_area: SearchArea,
        preferences: UserPreferences,
        limit: int = 50,
    ) -> List[Property]:
        """Fetch raw listings from the provider."""
        ...

    @abstractmethod
    async def get_comparable_sales(
        self,
        latitude: float,
        longitude: float,
        radius_miles: float = 0.5,
        sqft: int = 1500,
    ) -> List[dict]:
        """Fetch recent comparable sales for value scoring."""
        ...
