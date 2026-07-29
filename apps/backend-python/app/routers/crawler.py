from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional

from app import crud, database, schemas
from app.routers.auth import get_current_user
from app.tasks import enqueue_scrape_job

router = APIRouter(prefix="/api/crawler", tags=["crawler"])


def _validate_plan_account(db, fb_account_id: Optional[str]):
    if fb_account_id is None:
        return None

    account = await crud.get_fb_account_by_id(db, fb_account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Facebook account not found")
    return account


@router.post("/targets", response_model=schemas.CrawlTargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(
    payload: schemas.CrawlTargetCreate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    target = await crud.create_crawl_target(db, payload, current_user.id)
    return crud.serialize_crawl_target(target)


@router.get("/targets", response_model=List[schemas.CrawlTargetResponse])
async def list_targets(
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    targets = await crud.get_crawl_targets_by_user(db, current_user.id)
    return [crud.serialize_crawl_target(target) for target in targets]


@router.get("/targets/{target_id}", response_model=schemas.CrawlTargetResponse)
async def get_target(
    target_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_target = await crud.get_crawl_target(db, target_id, current_user.id)
    if not db_target:
        raise HTTPException(status_code=404, detail="Crawl target not found")
    return crud.serialize_crawl_target(db_target)


@router.patch("/targets/{target_id}", response_model=schemas.CrawlTargetResponse)
async def update_target(
    target_id: str,
    payload: schemas.CrawlTargetUpdate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_target = await crud.get_crawl_target(db, target_id, current_user.id)
    if not db_target:
        raise HTTPException(status_code=404, detail="Crawl target not found")
    updated = await crud.update_crawl_target(db, db_target, payload)
    return crud.serialize_crawl_target(updated)


@router.delete("/targets/{target_id}")
async def delete_target(
    target_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_target = await crud.get_crawl_target(db, target_id, current_user.id)
    if not db_target:
        raise HTTPException(status_code=404, detail="Crawl target not found")
    await crud.delete_crawl_target(db, db_target)
    return {"message": "Crawl target deleted successfully"}


@router.post("/plans", response_model=schemas.CrawlPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: schemas.CrawlPlanCreate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    _validate_plan_account(db, payload.fb_account_id)
    try:
        plan = await crud.create_crawl_plan(db, payload, current_user.id)
        return crud.serialize_crawl_plan(plan)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/plans", response_model=List[schemas.CrawlPlanResponse])
async def list_plans(
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    plans = await crud.get_crawl_plans_by_user(db, current_user.id)
    hydrated = [await crud.hydrate_plan_targets(plan) for plan in plans]
    return [crud.serialize_crawl_plan(plan) for plan in hydrated]


@router.get("/plans/{plan_id}", response_model=schemas.CrawlPlanResponse)
async def get_plan(
    plan_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_plan = await crud.get_crawl_plan(db, plan_id, current_user.id)
    if not db_plan:
        raise HTTPException(status_code=404, detail="Crawl plan not found")
    await crud.hydrate_plan_targets(db_plan)
    return crud.serialize_crawl_plan(db_plan)


@router.patch("/plans/{plan_id}", response_model=schemas.CrawlPlanResponse)
async def update_plan(
    plan_id: str,
    payload: schemas.CrawlPlanUpdate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_plan = await crud.get_crawl_plan(db, plan_id, current_user.id)
    if not db_plan:
        raise HTTPException(status_code=404, detail="Crawl plan not found")

    _validate_plan_account(db, payload.fb_account_id)
    try:
        updated = await crud.update_crawl_plan(db, db_plan, payload, current_user.id)
        return crud.serialize_crawl_plan(updated)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_plan = await crud.get_crawl_plan(db, plan_id, current_user.id)
    if not db_plan:
        raise HTTPException(status_code=404, detail="Crawl plan not found")
    await crud.delete_crawl_plan(db, db_plan)
    return {"message": "Crawl plan deleted successfully"}


@router.post("/plans/{plan_id}/dispatch", response_model=schemas.CrawlPlanDispatchResponse)
async def dispatch_plan(
    plan_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_plan = await crud.get_crawl_plan(db, plan_id, current_user.id)
    if not db_plan:
        raise HTTPException(status_code=404, detail="Crawl plan not found")

    selected_account = await crud.select_fb_account(db, db_plan.fb_account_id)
    if not selected_account:
        raise HTTPException(status_code=400, detail="No Facebook account available to dispatch this plan")

    jobs = await crud.build_jobs_for_plan_dispatch(db, db_plan)
    if not jobs:
        raise HTTPException(status_code=400, detail="This plan has no active crawl targets")

    job_ids = []
    for job in jobs:
        await crud.append_job_log(
            db,
            job.id,
            f"Queued from crawl plan '{db_plan.name}' with Facebook account '{selected_account.email}'."
        )
        enqueue_scrape_job(job.id, selected_account.id)
        job_ids.append(job.id)

    return schemas.CrawlPlanDispatchResponse(
        plan_id=str(db_plan.id),
        queued_jobs=len(job_ids),
        job_ids=[str(job_id) for job_id in job_ids]
    )
