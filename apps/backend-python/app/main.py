import asyncio
import json
import redis.asyncio as redis_async
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.config import REDIS_URL
from app.models import ScrapeJob
from app.routers import auth, config, jobs, exports, analytics, crawler

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="FBGroupScraper Pro API",
    description="Backend API for scraping and analyzing Facebook Groups",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(config.router)
app.include_router(jobs.router)
app.include_router(exports.router)
app.include_router(analytics.router)
app.include_router(crawler.router)

@app.get("/")
def read_root():
    return {"message": "FBGroupScraper Pro API is running with MongoDB"}

@app.websocket("/api/ws/jobs/{job_id}")
async def websocket_job_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()
    
    redis_client = redis_async.from_url(REDIS_URL)
    pubsub = redis_client.pubsub()
    
    try:
        # First send the current state directly from DB
        job = await ScrapeJob.get(job_id)
        if not job:
            await websocket.send_json({"error": "Job not found"})
            return
            
        await websocket.send_json({
            "job_id": str(job.id),
            "status": job.status,
            "progress": job.progress,
            "error_message": job.error_message,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "logs": job.logs or ""
        })
        
        if job.status in ["completed", "failed", "stopped"]:
            return
            
        # Subscribe to Redis for real-time updates pushed by Celery workers
        channel_name = f"job_updates:{job_id}"
        await pubsub.subscribe(channel_name)
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                # Push the update directly to the frontend immediately
                await websocket.send_json(data)
                
                # Close connection if job finished
                if data.get("type") == "status":
                    status = data.get("data", {}).get("status")
                    if status in ["completed", "failed", "stopped"]:
                        break
                        
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass
    finally:
        try:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()
            await redis_client.aclose()
        except:
            pass
