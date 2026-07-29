import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.config import MONGODB_URL

_client = None
_db_initialized = False

async def init_db():
    global _client, _db_initialized
    if _db_initialized:
        return

    _client = AsyncIOMotorClient(MONGODB_URL)
    db = _client.get_default_database()

    # Import inside function to avoid circular imports during initial loading
    from app import models

    await init_beanie(database=db, document_models=[
        models.User,
        models.CrawlTarget,
        models.FBAccount,
        models.ProxyEndpoint,
        models.CrawlPlan,
        models.ScrapeJob,
        models.ScrapedPost,
    ])
    _db_initialized = True


def get_db():
    # Dependency injected in routers, no longer needed to initialize db
    yield None
