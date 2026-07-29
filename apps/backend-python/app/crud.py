import asyncio
import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi.encoders import jsonable_encoder
from passlib.context import CryptContext

from app import models, schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _utcnow() -> datetime.datetime:
    return datetime.datetime.utcnow()


def _is_cooled_down(cooldown_until: Optional[datetime.datetime]) -> bool:
    return bool(cooldown_until and cooldown_until > _utcnow())


def _extract_link_id(link_obj: Any) -> Optional[str]:
    if link_obj is None:
        return None
    ref = getattr(link_obj, "ref", None)
    if ref is not None:
        return str(ref.id)
    linked_id = getattr(link_obj, "id", None)
    return str(linked_id) if linked_id else None


async def select_proxy_endpoint(db) -> Optional[models.ProxyEndpoint]:
    proxies = await models.ProxyEndpoint.find(models.ProxyEndpoint.status == "active").to_list()
    available = [proxy for proxy in proxies if not _is_cooled_down(proxy.cooldown_until)]
    if not available:
        return None
    available.sort(
        key=lambda proxy: (
            -proxy.health_score,
            proxy.last_used or datetime.datetime.min,
        )
    )
    selected = available[0]
    selected.last_used = _utcnow()
    selected.updated_at = _utcnow()
    await selected.save()
    return selected


async def load_targets_by_ids(target_ids: List[str]) -> List[models.CrawlTarget]:
    targets: List[models.CrawlTarget] = []
    for target_id in target_ids:
        target = await models.CrawlTarget.get(target_id)
        if target:
            targets.append(target)
    return targets


def _runtime_state_dict(state: models.FBAccountRuntimeState) -> Dict[str, Any]:
    data = jsonable_encoder(state)
    data["proxy_id"] = _extract_link_id(getattr(state, "proxy", None))
    proxy_obj = getattr(state, "proxy", None)
    data["proxy"] = serialize_proxy_endpoint(proxy_obj) if proxy_obj and hasattr(proxy_obj, "proxy_url") else None
    return data


def serialize_user(user: models.User) -> Dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "is_active": user.is_active,
    }


def serialize_proxy_endpoint(proxy: Optional[models.ProxyEndpoint]) -> Optional[Dict[str, Any]]:
    if proxy is None:
        return None
    return {
        "id": str(proxy.id),
        "name": proxy.name,
        "proxy_url": proxy.proxy_url,
        "status": proxy.status,
        "health_score": proxy.health_score,
        "cooldown_until": proxy.cooldown_until,
        "last_used": proxy.last_used,
        "success_count": proxy.success_count,
        "failure_count": proxy.failure_count,
        "created_at": proxy.created_at,
        "updated_at": proxy.updated_at,
    }


def serialize_fb_account(account: models.FBAccount) -> Dict[str, Any]:
    return {
        "id": str(account.id),
        "email": account.email,
        "status": account.status,
        "cookies_json": account.cookies_json,
        "last_used": account.last_used,
        "created_at": account.created_at,
        "runtime_state": _runtime_state_dict(account.runtime_state),
    }


def serialize_crawl_target(target: models.CrawlTarget) -> Dict[str, Any]:
    return {
        "id": str(target.id),
        "user_id": target.user_id,
        "name": target.name,
        "target_type": target.target_type,
        "target_url": target.target_url,
        "description": target.description,
        "is_active": target.is_active,
        "default_max_posts": target.default_max_posts,
        "default_include_comments": target.default_include_comments,
        "extra_config": target.extra_config,
        "created_at": target.created_at,
        "updated_at": target.updated_at,
    }


def serialize_crawl_plan(plan: models.CrawlPlan) -> Dict[str, Any]:
    targets = getattr(plan, "targets", []) or []
    serialized_targets = [serialize_crawl_target(target) for target in targets if hasattr(target, "target_url")]
    return {
        "id": str(plan.id),
        "user_id": plan.user_id,
        "name": plan.name,
        "description": plan.description,
        "is_active": plan.is_active,
        "interval_minutes": plan.interval_minutes,
        "max_posts": plan.max_posts,
        "include_comments": plan.include_comments,
        "fb_account_id": plan.fb_account_id,
        "last_run_at": plan.last_run_at,
        "next_run_at": plan.next_run_at,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
        "targets": serialized_targets,
    }


def serialize_scrape_job(job: models.ScrapeJob) -> Dict[str, Any]:
    return {
        "id": str(job.id),
        "user_id": job.user_id,
        "target_type": job.target_type,
        "target_url": job.target_url,
        "group_url": job.target_url,
        "target_name": job.target_name,
        "fb_account_id": job.fb_account_id,
        "proxy_endpoint_id": job.proxy_endpoint_id,
        "crawl_plan_id": job.crawl_plan_id,
        "status": job.status,
        "max_posts": job.max_posts,
        "include_comments": job.include_comments,
        "since_date": job.since_date,
        "until_date": job.until_date,
        "keyword_filter": job.keyword_filter,
        "min_reactions": job.min_reactions,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "progress": job.progress,
        "error_message": job.error_message,
        "logs": job.logs,
    }


def serialize_scraped_post(post: models.ScrapedPost) -> Dict[str, Any]:
    return {
        "id": str(post.id),
        "job_id": post.job_id,
        "post_id": post.post_id,
        "author_name": post.author_name,
        "author_url": post.author_url,
        "text": post.text,
        "timestamp": post.timestamp,
        "reactions_json": post.reactions_json,
        "comments_count": post.comments_count,
        "comments_json": post.comments_json,
        "attachments_json": post.attachments_json,
        "created_at": post.created_at,
    }


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def fetch_user_by_id(user_id: str) -> Optional[models.User]:
    return await models.User.get(user_id)


async def get_user_by_email(db, email: str):
    return await models.User.find_one(models.User.email == email)


async def create_user(db, user: schemas.UserCreate):
    db_user = models.User(
        email=user.email,
        hashed_password=_get_password_hash(user.password),
        is_active=True,
    )
    await db_user.insert()
    return db_user


async def get_fb_account_by_email(db, email: str):
    return await models.FBAccount.find_one(models.FBAccount.email == email)


async def get_fb_accounts(db):
    return await models.FBAccount.find_all().to_list()


async def get_fb_account_by_id(db, account_id: str):
    return await models.FBAccount.get(account_id)


async def create_fb_account(db, account: schemas.FBAccountCreate):
    db_account = models.FBAccount(
        email=account.email,
        password=account.password,
        cookies_json=account.cookies_json,
        status=account.status or "valid",
    )
    await db_account.insert()
    return db_account


async def update_fb_account(db, db_account: models.FBAccount, payload: schemas.FBAccountUpdate):
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_account, key, value)
    db_account.runtime_state.updated_at = _utcnow()
    await db_account.save()
    return db_account


async def delete_fb_account(db, account_id: str) -> bool:
    db_account = await models.FBAccount.get(account_id)
    if not db_account:
        return False
    await db_account.delete()
    return True


async def get_proxy_endpoint_by_url(db, proxy_url: str):
    return await models.ProxyEndpoint.find_one(models.ProxyEndpoint.proxy_url == proxy_url)


async def get_proxy_endpoint_by_id(db, proxy_id: str):
    return await models.ProxyEndpoint.get(proxy_id)


async def get_proxy_endpoints(db):
    return await models.ProxyEndpoint.find_all().to_list()


async def create_proxy_endpoint(db, payload: schemas.ProxyEndpointCreate):
    proxy = models.ProxyEndpoint(
        name=payload.name,
        proxy_url=payload.proxy_url,
        status=payload.status or "active",
    )
    await proxy.insert()
    return proxy


async def update_proxy_endpoint(db, proxy: models.ProxyEndpoint, payload: schemas.ProxyEndpointUpdate):
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(proxy, key, value)
    proxy.updated_at = _utcnow()
    await proxy.save()
    return proxy


async def delete_proxy_endpoint(db, proxy_id: str) -> bool:
    proxy = await models.ProxyEndpoint.get(proxy_id)
    if not proxy:
        return False
    await proxy.delete()
    return True


async def mark_proxy_endpoint_success(db, proxy_id: Optional[str]):
    if not proxy_id:
        return None
    proxy = await models.ProxyEndpoint.get(proxy_id)
    if not proxy:
        return None
    proxy.success_count += 1
    proxy.health_score = min(100, proxy.health_score + 2)
    proxy.cooldown_until = None
    proxy.last_used = _utcnow()
    proxy.updated_at = _utcnow()
    await proxy.save()
    return proxy


async def mark_proxy_endpoint_failure(db, proxy_id: Optional[str], error_message: str):
    if not proxy_id:
        return None
    proxy = await models.ProxyEndpoint.get(proxy_id)
    if not proxy:
        return None
    proxy.failure_count += 1
    proxy.health_score = max(0, proxy.health_score - 15)
    cooldown_minutes = min(60, max(5, proxy.failure_count * 5))
    proxy.cooldown_until = _utcnow() + datetime.timedelta(minutes=cooldown_minutes)
    proxy.updated_at = _utcnow()
    if proxy.health_score == 0:
        proxy.status = "cooldown"
    await proxy.save()
    return proxy


async def touch_fb_account(db, fb_account_id: str):
    account = await models.FBAccount.get(fb_account_id, fetch_links=True)
    if not account:
        return None
    account.last_used = _utcnow()
    account.runtime_state.updated_at = _utcnow()
    await account.save()
    return account


async def update_fb_account_cookies(db, fb_account_id: str, new_cookies: List[Dict[str, Any]]):
    account = await models.FBAccount.get(fb_account_id)
    if not account:
        return None
    account.cookies_json = new_cookies
    account.runtime_state.updated_at = _utcnow()
    await account.save()
    return account


async def mark_fb_account_success(db, fb_account_id: str):
    account = await models.FBAccount.get(fb_account_id, fetch_links=True)
    if not account:
        return None
    account.status = "valid"
    account.last_used = _utcnow()
    account.runtime_state.success_count += 1
    account.runtime_state.health_score = min(100, account.runtime_state.health_score + 3)
    account.runtime_state.cooldown_until = None
    account.runtime_state.last_success_at = _utcnow()
    account.runtime_state.last_error = None
    account.runtime_state.updated_at = _utcnow()
    await account.save()
    return account


async def mark_fb_account_failure(db, fb_account_id: str, error_message: str):
    account = await models.FBAccount.get(fb_account_id, fetch_links=True)
    if not account:
        return None
    lowered_error = error_message.lower()
    account.runtime_state.failure_count += 1
    account.runtime_state.health_score = max(0, account.runtime_state.health_score - 20)
    account.runtime_state.last_failure_at = _utcnow()
    account.runtime_state.last_error = error_message
    cooldown_minutes = min(180, max(10, account.runtime_state.failure_count * 10))
    if "checkpoint" in lowered_error or "login" in lowered_error:
        cooldown_minutes = max(cooldown_minutes, 60)
        account.status = "checkpoint"
    elif "proxy" in lowered_error:
        account.status = "degraded"
    else:
        account.status = "cooldown"
    account.runtime_state.cooldown_until = _utcnow() + datetime.timedelta(minutes=cooldown_minutes)
    account.runtime_state.updated_at = _utcnow()
    await account.save()
    return account


async def select_fb_account(db, preferred_account_id: Optional[str] = None) -> Optional[models.FBAccount]:
    if preferred_account_id:
        account = await models.FBAccount.get(preferred_account_id, fetch_links=True)
        candidates = [account] if account else []
    else:
        candidates = await models.FBAccount.find_all(fetch_links=True).to_list()

    available_accounts = []
    for account in candidates:
        if not account:
            continue
        if account.status not in {"valid", "degraded", "cooldown"}:
            continue
        if _is_cooled_down(account.runtime_state.cooldown_until):
            continue
        available_accounts.append(account)

    if not available_accounts:
        return None

    available_accounts.sort(
        key=lambda account: (
            -account.runtime_state.health_score,
            account.last_used or datetime.datetime.min,
        )
    )
    selected = available_accounts[0]
    if getattr(selected.runtime_state, "proxy", None) is None or _is_cooled_down(getattr(selected.runtime_state.proxy, "cooldown_until", None)):
        proxy = await select_proxy_endpoint(db)
        if proxy:
            selected.runtime_state.proxy = proxy
    selected.last_used = _utcnow()
    selected.runtime_state.updated_at = _utcnow()
    await selected.save()
    return selected


async def get_crawl_targets_by_user(db, user_id: str):
    targets = await models.CrawlTarget.find_all(fetch_links=True).to_list()
    return [target for target in targets if target.user_id == str(user_id)]


async def get_crawl_target(db, target_id: str, user_id: str):
    target = await models.CrawlTarget.get(target_id, fetch_links=True)
    if not target or target.user_id != str(user_id):
        return None
    return target


async def create_crawl_target(db, payload: schemas.CrawlTargetCreate, user_id: str):
    user = await fetch_user_by_id(user_id)
    target = models.CrawlTarget(
        user=user,
        **payload.model_dump(),
    )
    await target.insert()
    return target


async def update_crawl_target(db, db_target: models.CrawlTarget, payload: schemas.CrawlTargetUpdate):
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_target, key, value)
    db_target.updated_at = _utcnow()
    await db_target.save()
    return db_target


async def delete_crawl_target(db, db_target: models.CrawlTarget):
    return await db_target.delete()


async def create_crawl_plan(db, payload: schemas.CrawlPlanCreate, user_id: str):
    user = await fetch_user_by_id(user_id)
    account = await models.FBAccount.get(payload.fb_account_id) if payload.fb_account_id else None
    targets = await load_targets_by_ids(payload.target_ids) if payload.target_ids else []
    if payload.target_ids and len(targets) != len(payload.target_ids):
        raise ValueError("One or more crawl targets do not exist")
    plan = models.CrawlPlan(
        user=user,
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active,
        interval_minutes=payload.interval_minutes,
        max_posts=payload.max_posts,
        include_comments=payload.include_comments,
        fb_account=account,
        targets=targets,
        last_run_at=None,
        next_run_at=_utcnow(),
    )
    await plan.insert()
    await plan.fetch_all_links()
    return plan


async def get_crawl_plans_by_user(db, user_id: str):
    plans = await models.CrawlPlan.find_all(fetch_links=True).to_list()
    return [plan for plan in plans if plan.user_id == str(user_id)]


async def get_crawl_plan(db, plan_id: str, user_id: str):
    plan = await models.CrawlPlan.get(plan_id, fetch_links=True)
    if not plan or plan.user_id != str(user_id):
        return None
    return plan


async def update_crawl_plan(db, db_plan: models.CrawlPlan, payload: schemas.CrawlPlanUpdate, user_id: str):
    update_data = payload.model_dump(exclude_unset=True)
    target_ids = update_data.pop("target_ids", None)
    if "fb_account_id" in update_data:
        update_data.pop("fb_account_id", None)

    for key, value in update_data.items():
        setattr(db_plan, key, value)

    if payload.fb_account_id is not None:
        db_plan.fb_account = await models.FBAccount.get(payload.fb_account_id)

    if target_ids is not None:
        targets = await load_targets_by_ids(target_ids) if target_ids else []
        if target_ids and len(targets) != len(target_ids):
            raise ValueError("One or more crawl targets do not exist")
        db_plan.targets = targets

    db_plan.updated_at = _utcnow()
    await db_plan.save()
    await db_plan.fetch_all_links()
    return db_plan


async def delete_crawl_plan(db, db_plan: models.CrawlPlan):
    return await db_plan.delete()


async def hydrate_plan_targets(plan: models.CrawlPlan):
    return await plan.fetch_all_links() or plan


async def get_due_crawl_plans(db):
    now = _utcnow()
    plans = await models.CrawlPlan.find(models.CrawlPlan.is_active == True, fetch_links=True).to_list()
    return [plan for plan in plans if plan.next_run_at is None or plan.next_run_at <= now]


async def create_scrape_job(db, job: schemas.ScrapeJobCreate, user_id: str):
    user = await fetch_user_by_id(user_id)
    account = await models.FBAccount.get(job.fb_account_id, fetch_links=True) if job.fb_account_id else None
    proxy = None
    if account and getattr(account.runtime_state, "proxy", None):
        proxy_id = _extract_link_id(account.runtime_state.proxy)
        if proxy_id:
            proxy = await models.ProxyEndpoint.get(proxy_id)
    db_job = models.ScrapeJob(
        user=user,
        target_type=job.target_type,
        target_url=job.target_url,
        target_name=job.target_name,
        max_posts=job.max_posts or 50,
        include_comments=job.include_comments or False,
        since_date=job.since_date,
        until_date=job.until_date,
        keyword_filter=job.keyword_filter,
        min_reactions=job.min_reactions or 0,
        fb_account=account,
        proxy_endpoint=proxy,
    )
    await db_job.insert()
    await db_job.fetch_all_links()
    return db_job


async def build_jobs_for_plan_dispatch(db, plan: models.CrawlPlan) -> List[models.ScrapeJob]:
    await plan.fetch_all_links()
    dispatch_account = None
    if plan.fb_account_id:
        dispatch_account = await models.FBAccount.get(plan.fb_account_id, fetch_links=True)
    jobs: List[models.ScrapeJob] = []
    for target in plan.targets:
        if not getattr(target, "is_active", False):
            continue
        proxy = None
        if dispatch_account and getattr(dispatch_account.runtime_state, "proxy", None):
            proxy_id = _extract_link_id(dispatch_account.runtime_state.proxy)
            if proxy_id:
                proxy = await models.ProxyEndpoint.get(proxy_id)
        job = models.ScrapeJob(
            user=plan.user,
            target_type=target.target_type,
            target_url=target.target_url,
            target_name=target.name,
            status="pending",
            max_posts=target.default_max_posts or plan.max_posts,
            include_comments=target.default_include_comments or plan.include_comments,
            crawl_plan=plan,
            fb_account=dispatch_account,
            proxy_endpoint=proxy,
        )
        await job.insert()
        jobs.append(job)

    plan.last_run_at = _utcnow()
    plan.next_run_at = _utcnow() + datetime.timedelta(minutes=plan.interval_minutes)
    plan.updated_at = _utcnow()
    await plan.save()
    return jobs


async def get_job(db, job_id: str):
    return await models.ScrapeJob.get(job_id, fetch_links=True)


async def get_jobs_by_user(db, user_id: str, skip: int = 0, limit: int = 100):
    jobs = await models.ScrapeJob.find_all(fetch_links=True).sort(-models.ScrapeJob.created_at).to_list()
    owned_jobs = [job for job in jobs if job.user_id == str(user_id)]
    return owned_jobs[skip: skip + limit]


async def update_job_status(db, job_id: str, status: str, error_message: Optional[str] = None):
    job = await models.ScrapeJob.get(job_id)
    if not job:
        return None
    job.status = status
    job.error_message = error_message
    if status in {"completed", "failed", "stopped"}:
        job.completed_at = _utcnow()
    await job.save()
    return job


async def update_job_progress(db, job_id: str, progress_value: int):
    job = await models.ScrapeJob.get(job_id)
    if not job:
        return None
    job.progress = max(0, min(100, progress_value))
    await job.save()
    return job


async def append_job_log(db, job_id: str, message: str):
    job = await models.ScrapeJob.get(job_id)
    if not job:
        return None
    timestamp = _utcnow().isoformat()
    job.logs = (job.logs or "") + f"[{timestamp}] {message}\n"
    await job.save()
    return job


async def post_exists_in_job(db, job_id: str, post_id: str) -> bool:
    posts = await models.ScrapedPost.find(models.ScrapedPost.post_id == post_id, fetch_links=True).to_list()
    return any(post.job_id == str(job_id) for post in posts)


async def create_scraped_post(db, post: Dict[str, Any], job_id: str):
    job = await models.ScrapeJob.get(job_id)
    db_post = models.ScrapedPost(
        job=job,
        post_id=post["post_id"],
        author_name=post.get("author_name"),
        author_url=post.get("author_url"),
        text=post.get("text"),
        timestamp=post.get("timestamp"),
        reactions_json=post.get("reactions_json"),
        comments_count=post.get("comments_count", 0),
        comments_json=post.get("comments_json") or [],
        attachments_json=post.get("attachments_json") or [],
    )
    await db_post.insert()
    return db_post


async def get_posts_by_job(db, job_id: str, skip: int = 0, limit: int = 10, search: Optional[str] = None) -> Tuple[int, List[models.ScrapedPost]]:
    posts = await models.ScrapedPost.find_all(fetch_links=True).sort(-models.ScrapedPost.created_at).to_list()
    job_posts = [post for post in posts if post.job_id == str(job_id)]
    if search:
        lowered = search.lower()
        job_posts = [post for post in job_posts if lowered in (post.text or "").lower()]
    total = len(job_posts)
    return total, job_posts[skip: skip + limit]


async def get_all_posts_by_job(db, job_id: str) -> List[models.ScrapedPost]:
    return (await get_posts_by_job(db, job_id, skip=0, limit=100000))[1]
