"""AI package — centralized client for backend → ai_service calls.

Usage:
    from ai import client as ai_client
    data = await ai_client.consult(query="...")
"""

from . import client

__all__ = ["client"]
