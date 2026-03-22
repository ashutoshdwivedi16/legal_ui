"""Fullstory API tools for session replay and user behavior analysis."""
import os
from typing import Any
import httpx

from common.lib.utils.logging import get_logger

logger = get_logger(__name__)

# Fullstory API Configuration
FULLSTORY_API_KEY = os.getenv("FULLSTORY_API_KEY", "")
FULLSTORY_ORG_ID = os.getenv("FULLSTORY_ORG_ID", "")
FULLSTORY_BASE_URL = "https://api.fullstory.com"

# API Headers
def _get_headers() -> dict:
    """Get Fullstory API headers."""
    return {
        "Authorization": f"Basic {FULLSTORY_API_KEY}",
        "Content-Type": "application/json",
    }


async def get_session_data(session_id: str) -> dict[str, Any]:
    """
    Get detailed session data from Fullstory.
    
    Args:
        session_id: Fullstory session ID
        
    Returns:
        Dictionary with session details including events, errors, and replay URL
    """
    logger.info(f"Fetching Fullstory session data for: {session_id}")
    
    if not FULLSTORY_API_KEY:
        return {
            "success": False,
            "error": "FULLSTORY_API_KEY not configured",
            "data": None
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{FULLSTORY_BASE_URL}/v2/sessions/{session_id}",
                headers=_get_headers(),
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "session_id": session_id,
                    "data": data,
                    "replay_url": f"https://app.fullstory.com/ui/{FULLSTORY_ORG_ID}/session/{session_id}"
                }
            else:
                return {
                    "success": False,
                    "error": f"API error: {response.status_code} - {response.text}",
                    "data": None
                }
                
    except Exception as e:
        logger.error(f"Fullstory API error: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": None
        }


async def search_sessions(
    user_id: str | None = None,
    email: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    event_type: str | None = None,
    limit: int = 10
) -> dict[str, Any]:
    """
    Search for Fullstory sessions.
    
    Args:
        user_id: Filter by user ID
        email: Filter by user email
        start_time: Start of time range (ISO format)
        end_time: End of time range (ISO format)
        event_type: Filter by event type (e.g., 'rage_click', 'error', 'dead_click')
        limit: Maximum number of sessions to return
        
    Returns:
        Dictionary with matching sessions
    """
    logger.info(f"Searching Fullstory sessions - user: {user_id or email}, event: {event_type}")
    
    if not FULLSTORY_API_KEY:
        return {
            "success": False,
            "error": "FULLSTORY_API_KEY not configured",
            "sessions": []
        }
    
    try:
        # Build search query
        search_query = {
            "limit": limit
        }
        
        if user_id:
            search_query["filter"] = {"userId": user_id}
        elif email:
            search_query["filter"] = {"email": email}
            
        if start_time and end_time:
            search_query["timeRange"] = {
                "start": start_time,
                "end": end_time
            }
            
        if event_type:
            search_query["eventType"] = event_type
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{FULLSTORY_BASE_URL}/v2/sessions/search",
                headers=_get_headers(),
                json=search_query,
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                sessions = data.get("sessions", [])
                
                # Add replay URLs
                for session in sessions:
                    session_id = session.get("id")
                    if session_id:
                        session["replay_url"] = f"https://app.fullstory.com/ui/{FULLSTORY_ORG_ID}/session/{session_id}"
                
                return {
                    "success": True,
                    "session_count": len(sessions),
                    "sessions": sessions
                }
            else:
                return {
                    "success": False,
                    "error": f"API error: {response.status_code} - {response.text}",
                    "sessions": []
                }
                
    except Exception as e:
        logger.error(f"Fullstory search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "sessions": []
        }
