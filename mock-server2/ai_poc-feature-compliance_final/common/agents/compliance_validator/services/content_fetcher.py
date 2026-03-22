"""
Content Fetcher Service - Fetches AI-generated summaries from all project sources.

This service is responsible for:
1. Connecting to various content sources (databases, APIs, file systems)
2. Fetching AI-generated content (summaries, descriptions, etc.)
3. Transforming content into ContentItem format for compliance validation
"""

from typing import Optional
from abc import ABC, abstractmethod
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from common.agents.compliance_validator.models.schemas import ContentItem
from common.lib.utils.logging import get_logger

logger = get_logger(__name__)


class ContentSource(ABC):
    """Abstract base class for content sources."""
    
    @abstractmethod
    async def fetch_content(self) -> list[ContentItem]:
        """Fetch content items from the source."""
        pass
    
    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the name of this content source."""
        pass


class DatabaseContentSource(ContentSource):
    """Fetch AI-generated content from a database table."""
    
    def __init__(
        self, 
        session: AsyncSession,
        table_name: str,
        content_column: str,
        id_column: str = "id",
        content_type: str = "summary",
        where_clause: Optional[str] = None
    ):
        """
        Initialize database content source.
        
        Args:
            session: Database session
            table_name: Table containing AI-generated content
            content_column: Column name with the AI text
            id_column: Column name for content ID
            content_type: Type of content (summary, description, etc.)
            where_clause: Optional SQL WHERE clause to filter content
        """
        self.session = session
        self.table_name = table_name
        self.content_column = content_column
        self.id_column = id_column
        self.content_type = content_type
        self.where_clause = where_clause
    
    @property
    def source_name(self) -> str:
        return f"db:{self.table_name}"
    
    async def fetch_content(self) -> list[ContentItem]:
        """Fetch content from database table."""
        try:
            # Build query
            query = f"SELECT {self.id_column}, {self.content_column} FROM {self.table_name}"
            if self.where_clause:
                query += f" WHERE {self.where_clause}"
            
            result = await self.session.execute(text(query))
            rows = result.fetchall()
            
            items = []
            for row in rows:
                content_id, content_text = row
                if content_text:  # Skip null/empty content
                    items.append(ContentItem(
                        content_id=str(content_id),
                        content_type=self.content_type,
                        source=self.source_name,
                        text=content_text
                    ))
            
            logger.info(f"Fetched {len(items)} content items from {self.source_name}")
            return items
            
        except Exception as e:
            logger.error(f"Error fetching content from {self.source_name}: {e}")
            return []


class APIContentSource(ContentSource):
    """Fetch AI-generated content from an external API."""
    
    def __init__(
        self,
        api_url: str,
        api_key: Optional[str] = None,
        content_type: str = "summary",
        headers: Optional[dict] = None
    ):
        """
        Initialize API content source.
        
        Args:
            api_url: URL of the API endpoint
            api_key: Optional API key for authentication
            content_type: Type of content being fetched
            headers: Optional additional headers
        """
        self.api_url = api_url
        self.api_key = api_key
        self.content_type = content_type
        self.headers = headers or {}
    
    @property
    def source_name(self) -> str:
        return f"api:{self.api_url}"
    
    async def fetch_content(self) -> list[ContentItem]:
        """Fetch content from external API."""
        import httpx
        
        try:
            headers = self.headers.copy()
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(self.api_url, headers=headers, timeout=30.0)
                response.raise_for_status()
                data = response.json()
            
            items = []
            # Expecting {"items": [{"id": "...", "content": "..."}]}
            for item in data.get("items", []):
                if item.get("content"):
                    items.append(ContentItem(
                        content_id=str(item.get("id", "")),
                        content_type=self.content_type,
                        source=self.source_name,
                        text=item["content"]
                    ))
            
            logger.info(f"Fetched {len(items)} content items from {self.source_name}")
            return items
            
        except Exception as e:
            logger.error(f"Error fetching content from {self.source_name}: {e}")
            return []


class ContentFetcher:
    """
    Main content fetcher that aggregates content from multiple sources.
    
    Usage:
        fetcher = ContentFetcher(session)
        fetcher.add_source(DatabaseContentSource(...))
        fetcher.add_source(APIContentSource(...))
        content_items = await fetcher.fetch_all_content()
    """
    
    def __init__(self, session: AsyncSession):
        """
        Initialize content fetcher.
        
        Args:
            session: Database session for DB-based sources
        """
        self.session = session
        self.sources: list[ContentSource] = []
    
    def add_source(self, source: ContentSource) -> "ContentFetcher":
        """Add a content source."""
        self.sources.append(source)
        return self
    
    def add_database_source(
        self,
        table_name: str,
        content_column: str,
        id_column: str = "id",
        content_type: str = "summary",
        where_clause: Optional[str] = None
    ) -> "ContentFetcher":
        """
        Convenience method to add a database content source.
        
        Args:
            table_name: Table containing AI-generated content
            content_column: Column name with the AI text
            id_column: Column name for content ID
            content_type: Type of content
            where_clause: Optional SQL WHERE filter
            
        Returns:
            Self for chaining
        """
        source = DatabaseContentSource(
            session=self.session,
            table_name=table_name,
            content_column=content_column,
            id_column=id_column,
            content_type=content_type,
            where_clause=where_clause
        )
        self.sources.append(source)
        return self
    
    def add_api_source(
        self,
        api_url: str,
        api_key: Optional[str] = None,
        content_type: str = "summary",
        headers: Optional[dict] = None
    ) -> "ContentFetcher":
        """
        Convenience method to add an API content source.
        
        Args:
            api_url: URL of the API endpoint
            api_key: Optional API key
            content_type: Type of content
            headers: Optional additional headers
            
        Returns:
            Self for chaining
        """
        source = APIContentSource(
            api_url=api_url,
            api_key=api_key,
            content_type=content_type,
            headers=headers
        )
        self.sources.append(source)
        return self
    
    async def fetch_all_content(self) -> list[ContentItem]:
        """
        Fetch content from all registered sources.
        
        Returns:
            Combined list of ContentItems from all sources
        """
        import asyncio
        
        if not self.sources:
            logger.warning("No content sources registered")
            return []
        
        # Fetch from all sources in parallel
        tasks = [source.fetch_content() for source in self.sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_items = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Source {self.sources[i].source_name} failed: {result}")
            else:
                all_items.extend(result)
        
        logger.info(f"Total content items fetched: {len(all_items)} from {len(self.sources)} sources")
        return all_items
