import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-development-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/fb_scraper")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
if "localhost" not in REDIS_URL and os.getenv("RUNNING_LOCAL_DEV", "false").lower() == "true":
    REDIS_URL = "redis://localhost:6379/0"

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

EXPORTS_DIR = os.getenv("EXPORTS_DIR", str(BASE_DIR / "exports"))
os.makedirs(EXPORTS_DIR, exist_ok=True)
