from .memories import router as memories_router
from .apps import router as apps_router
from .stats import router as stats_router
from .config import router as config_router
from .test_categorization import router as test_categorization
from .auth import router as auth_router
from .api_keys import router as api_keys_router
from .graph import router as graph_router

__all__ = [
    "memories_router",
    "apps_router",
    "stats_router",
    "config_router",
    "test_categorization",
    "auth_router",
    "api_keys_router",
    "graph_router",
]