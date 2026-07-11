import asyncio
import logging
import json
import redis
from celery import Celery
from celery.signals import worker_process_init

from app.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND, REDIS_URL
from app.database import init_db
from app import crud
from app.scraper.facebook import scrape_facebook_target

logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery(
    "tasks",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "dispatch-due-crawl-plans-every-minute": {
            "task": "app.tasks.dispatch_due_crawl_plans_task",
            "schedule": 60.0,
        }
    },
)

# Initialize Redis client for pub/sub
redis_client = redis.Redis.from_url(REDIS_URL)

@worker_process_init.connect
def init_worker(**kwargs):
    logger.info("Initializing database for Celery worker...")
    loop = asyncio.get_event_loop()
    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(init_db())
    logger.info("Database initialized for Celery worker.")


def run_async(coro):
    """Helper to run async coroutines in Celery's synchronous worker context"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def enqueue_scrape_job(job_id: str, fb_account_id: str):
    scrape_fb_group_task.apply_async(
        args=[str(job_id), str(fb_account_id)],
        task_id=str(job_id)
    )

async def _raise_if_job_stopped(job_id: str):
    db_job = await crud.get_job(None, job_id)
    if db_job and db_job.status == "stopped":
        raise RuntimeError("Job stopped by user request")

async def _dispatch_due_crawl_plans_task_async():
    queued_job_ids = []
    due_plans = await crud.get_due_crawl_plans(None)
    for plan in due_plans:
        selected_account = await crud.select_fb_account(None, plan.fb_account_id)
        if not selected_account:
            logger.warning("Skipping plan %s because no FB account is available", plan.id)
            continue

        jobs = await crud.build_jobs_for_plan_dispatch(None, plan)
        for job in jobs:
            await crud.append_job_log(
                None,
                str(job.id),
                f"Queued from crawl plan '{plan.name}' using account '{selected_account.email}'."
            )
            enqueue_scrape_job(str(job.id), str(selected_account.id))
            queued_job_ids.append(str(job.id))

    return {"queued_jobs": len(queued_job_ids), "job_ids": queued_job_ids}


@celery_app.task(name="app.tasks.dispatch_due_crawl_plans_task")
def dispatch_due_crawl_plans_task():
    return run_async(_dispatch_due_crawl_plans_task_async())


def publish_job_update(job_id: str, update_type: str, data: dict):
    """Publish a real-time update to Redis."""
    try:
        payload = {"type": update_type, "data": data}
        redis_client.publish(f"job_updates:{job_id}", json.dumps(payload))
    except Exception as e:
        logger.error("Failed to publish to Redis: %s", str(e))


async def _scrape_fb_group_task_async(job_id: str, fb_account_id: str):
    logger.info("Starting Celery task for Job ID: %s, FB Account ID: %s", job_id, fb_account_id)
    
    # 1. Update job status to running
    await crud.update_job_status(None, job_id, "running")
    await crud.update_job_progress(None, job_id, 0)
    publish_job_update(job_id, "status", {"status": "running"})
    publish_job_update(job_id, "progress", {"progress": 0})
    
    job = await crud.get_job(None, job_id)
    fb_account = await crud.get_fb_account_by_id(None, fb_account_id)
    
    if not job or not fb_account:
        error_msg = f"Job {job_id} or FB Account {fb_account_id} not found."
        logger.error(error_msg)
        await crud.update_job_status(None, job_id, "failed", error_message=error_msg)
        publish_job_update(job_id, "status", {"status": "failed", "error_message": error_msg})
        return False
        
    await crud.touch_fb_account(None, fb_account_id)
    await crud.append_job_log(None, job_id, f"Starting crawl with account '{fb_account.email}'.")
    publish_job_update(job_id, "log", {"message": f"Starting crawl with account '{fb_account.email}'."})

    async def progress_callback(progress_value: int):
        await _raise_if_job_stopped(job_id)
        await crud.update_job_progress(None, job_id, progress_value)
        publish_job_update(job_id, "progress", {"progress": progress_value})

    async def log_callback(message: str):
        await _raise_if_job_stopped(job_id)
        await crud.append_job_log(None, job_id, message)
        publish_job_update(job_id, "log", {"message": message})

    try:
        proxy = getattr(fb_account.runtime_state, "proxy", None)
        proxy_url = getattr(proxy, "proxy_url", None) if proxy else None
        session_profile_path = fb_account.runtime_state.session_profile_path
        allow_simulation = fb_account.email == "demo@example.com" or "demo" in job.target_url

        # Note: scrape_facebook_target is async, we can just await it directly now!
        posts, new_cookies = await scrape_facebook_target(
            target_url=job.target_url,
            target_type=job.target_type,
            max_posts=job.max_posts,
            include_comments=job.include_comments,
            cookies=fb_account.cookies_json,
            email=fb_account.email,
            password=fb_account.password,
            progress_callback=progress_callback,
            simulate=False,
            allow_simulation=allow_simulation,
            since_date=job.since_date,
            until_date=job.until_date,
            keyword_filter=job.keyword_filter,
            min_reactions=job.min_reactions,
            log_callback=log_callback,
            proxy_url=proxy_url,
            session_profile_path=session_profile_path,
        )
        
        # Save scraped posts to database
        for post in posts:
            if not await crud.post_exists_in_job(None, job_id, post["post_id"]):
                await crud.create_scraped_post(None, post, job_id)
                
        # Update cookies if refreshed during login
        if new_cookies:
            await crud.update_fb_account_cookies(None, fb_account_id, new_cookies)

        await crud.mark_fb_account_success(None, fb_account_id)
        await crud.mark_proxy_endpoint_success(None, job.proxy_endpoint_id or getattr(fb_account.runtime_state, "proxy_id", None))
            
        # Complete job
        await crud.update_job_progress(None, job_id, 100)
        await crud.update_job_status(None, job_id, "completed")
        await crud.append_job_log(None, job_id, "Crawl completed successfully.")
        
        publish_job_update(job_id, "progress", {"progress": 100})
        publish_job_update(job_id, "status", {"status": "completed"})
        publish_job_update(job_id, "log", {"message": "Crawl completed successfully."})
        
        logger.info("Successfully completed scraping task for Job ID: %s", job_id)
        
    except Exception as e:
        error_msg = str(e)
        logger.error("Scraping task failed for Job ID %s: %s", job_id, error_msg)
        final_status = "stopped" if "stopped by user" in error_msg.lower() else "failed"
        if final_status != "stopped":
            await crud.mark_fb_account_failure(None, fb_account_id, error_msg)
            await crud.mark_proxy_endpoint_failure(None, job.proxy_endpoint_id or getattr(fb_account.runtime_state, "proxy_id", None), error_msg)
            
        await crud.update_job_status(None, job_id, final_status, error_message=error_msg)
        await crud.append_job_log(None, job_id, f"Crawl stopped with status '{final_status}': {error_msg}")
        
        publish_job_update(job_id, "status", {"status": final_status, "error_message": error_msg})
        publish_job_update(job_id, "log", {"message": f"Crawl stopped with status '{final_status}': {error_msg}"})
        
        raise e
        
    return True

@celery_app.task(bind=True, name="app.tasks.scrape_fb_group_task")
def scrape_fb_group_task(self, job_id: str, fb_account_id: str):
    return run_async(_scrape_fb_group_task_async(job_id, fb_account_id))
