from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from app import crud, database, schemas
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

# We import the celery task and app inside the function to avoid circular imports
# once Celery is initialized in app.tasks

@router.post("", response_model=schemas.ScrapeJobResponse)
async def create_job(
    job: schemas.ScrapeJobCreate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    selected_account = await crud.select_fb_account(db, job.fb_account_id)
    if not selected_account:
        raise HTTPException(
            status_code=400,
            detail="No Facebook accounts configured. Please add an account in settings first."
        )
    if job.fb_account_id and selected_account.id != job.fb_account_id:
        raise HTTPException(status_code=400, detail="Specified FB account not found")

    job.fb_account_id = str(selected_account.id)
    db_job = await crud.create_scrape_job(db=db, job=job, user_id=current_user.id)
    await crud.append_job_log(
        db,
        db_job.id,
        f"Queued manually with Facebook account '{selected_account.email}'."
    )

    from app.tasks import enqueue_scrape_job
    enqueue_scrape_job(db_job.id, selected_account.id)
    
    # Refresh to return
    db_job = await crud.get_job(db, db_job.id)
    return crud.serialize_scrape_job(db_job)

@router.get("", response_model=List[schemas.ScrapeJobResponse])
async def list_jobs(
    skip: int = 0,
    limit: int = 100,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    jobs = await crud.get_jobs_by_user(db, user_id=current_user.id, skip=skip, limit=limit)
    return [crud.serialize_scrape_job(job) for job in jobs]

@router.get("/{job_id}", response_model=schemas.ScrapeJobResponse)
async def get_job_status(
    job_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_job = await crud.get_job(db, job_id)
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    if db_job.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view this job")
    return crud.serialize_scrape_job(db_job)

@router.post("/{job_id}/stop")
async def stop_job(
    job_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_job = await crud.get_job(db, job_id)
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    if db_job.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to modify this job")
    
    if db_job.status not in ["pending", "running"]:
        return {"message": f"Job is already in {db_job.status} state"}

    await crud.append_job_log(db, job_id, "Stop requested by user.")

    # Revoke Celery task
    from app.tasks import celery_app
    celery_app.control.revoke(job_id, terminate=True, signal="SIGKILL")
    
    # Update status in db
    await crud.update_job_status(db, job_id, "stopped")
    
    return {"message": "Job stop request sent"}

@router.get("/{job_id}/posts", response_model=schemas.PaginatedPostsResponse)
async def get_job_posts(
    job_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_job = await crud.get_job(db, job_id)
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    if db_job.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view posts for this job")
        
    skip = (page - 1) * size
    total, posts = await crud.get_posts_by_job(db, job_id, skip=skip, limit=size, search=search)
    return {
        "total": total,
        "page": page,
        "size": size,
        "posts": [crud.serialize_scraped_post(post) for post in posts]
    }
