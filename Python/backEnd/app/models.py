import datetime
from typing import List, Optional, Any, Dict
from beanie import Document, Link, Indexed
from pydantic import BaseModel, Field

class User(Document):
    email: Indexed(str, unique=True)
    hashed_password: str
    is_active: bool = True

    class Settings:
        name = "users"

class CrawlTarget(Document):
    user: Link[User]
    name: str
    target_type: str = "group"
    target_url: str
    description: Optional[str] = None
    is_active: bool = True
    default_max_posts: int = 50
    default_include_comments: bool = False
    extra_config: Optional[Dict[str, Any]] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    class Settings:
        name = "crawl_targets"

    @property
    def user_id(self) -> Optional[str]:
        if getattr(self, "user", None) is None:
            return None
        ref = getattr(self.user, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.user, "id", None)
        return str(linked_id) if linked_id else None

class ProxyEndpoint(Document):
    name: str
    proxy_url: Indexed(str, unique=True)
    status: str = "active"
    health_score: int = 100
    cooldown_until: Optional[datetime.datetime] = None
    last_used: Optional[datetime.datetime] = None
    success_count: int = 0
    failure_count: int = 0
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    class Settings:
        name = "proxy_endpoints"

class FBAccountRuntimeState(BaseModel):
    proxy: Optional[Link[ProxyEndpoint]] = None
    session_profile_path: Optional[str] = None
    health_score: int = 100
    cooldown_until: Optional[datetime.datetime] = None
    success_count: int = 0
    failure_count: int = 0
    last_success_at: Optional[datetime.datetime] = None
    last_failure_at: Optional[datetime.datetime] = None
    last_error: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    @property
    def proxy_id(self) -> Optional[str]:
        if getattr(self, "proxy", None) is None:
            return None
        ref = getattr(self.proxy, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.proxy, "id", None)
        return str(linked_id) if linked_id else None

class FBAccount(Document):
    email: Indexed(str, unique=True)
    password: Optional[str] = None
    cookies_json: Optional[List[Dict[str, Any]]] = None
    status: str = "valid"
    last_used: Optional[datetime.datetime] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    runtime_state: FBAccountRuntimeState = Field(default_factory=FBAccountRuntimeState)

    class Settings:
        name = "fb_accounts"

class CrawlPlan(Document):
    user: Link[User]
    name: str
    description: Optional[str] = None
    is_active: Indexed(bool) = True
    interval_minutes: int = 60
    max_posts: int = 50
    include_comments: bool = False
    fb_account: Optional[Link[FBAccount]] = None
    last_run_at: Optional[datetime.datetime] = None
    next_run_at: Optional[datetime.datetime] = None
    targets: List[Link[CrawlTarget]] = []
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    class Settings:
        name = "crawl_plans"

    @property
    def user_id(self) -> Optional[str]:
        if getattr(self, "user", None) is None:
            return None
        ref = getattr(self.user, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.user, "id", None)
        return str(linked_id) if linked_id else None

    @property
    def fb_account_id(self) -> Optional[str]:
        if getattr(self, "fb_account", None) is None:
            return None
        ref = getattr(self.fb_account, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.fb_account, "id", None)
        return str(linked_id) if linked_id else None

class ScrapeJob(Document):
    user: Link[User]
    target_type: str = "group"
    target_url: str
    target_name: Optional[str] = None
    status: str = "pending"
    max_posts: int = 50
    include_comments: bool = False
    since_date: Optional[datetime.date] = None
    until_date: Optional[datetime.date] = None
    keyword_filter: Optional[str] = None
    min_reactions: int = 0
    crawl_plan: Optional[Link[CrawlPlan]] = None
    fb_account: Optional[Link[FBAccount]] = None
    proxy_endpoint: Optional[Link[ProxyEndpoint]] = None
    logs: str = ""
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    completed_at: Optional[datetime.datetime] = None
    progress: int = 0
    error_message: Optional[str] = None

    class Settings:
        name = "scrape_jobs"

    @property
    def group_url(self) -> str:
        return self.target_url

    @property
    def user_id(self) -> Optional[str]:
        if getattr(self, "user", None) is None:
            return None
        ref = getattr(self.user, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.user, "id", None)
        return str(linked_id) if linked_id else None

    @property
    def fb_account_id(self) -> Optional[str]:
        if getattr(self, "fb_account", None) is None:
            return None
        ref = getattr(self.fb_account, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.fb_account, "id", None)
        return str(linked_id) if linked_id else None

    @property
    def proxy_endpoint_id(self) -> Optional[str]:
        if getattr(self, "proxy_endpoint", None) is None:
            return None
        ref = getattr(self.proxy_endpoint, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.proxy_endpoint, "id", None)
        return str(linked_id) if linked_id else None

    @property
    def crawl_plan_id(self) -> Optional[str]:
        if getattr(self, "crawl_plan", None) is None:
            return None
        ref = getattr(self.crawl_plan, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.crawl_plan, "id", None)
        return str(linked_id) if linked_id else None

class ScrapedPost(Document):
    job: Link[ScrapeJob]
    post_id: Indexed(str)
    author_name: Optional[str] = None
    author_url: Optional[str] = None
    text: Optional[str] = None
    timestamp: Optional[datetime.datetime] = None
    reactions_json: Optional[Dict[str, int]] = None
    comments_count: int = 0
    comments_json: Optional[List[Dict[str, Any]]] = None
    attachments_json: Optional[List[str]] = None
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

    class Settings:
        name = "scraped_posts"

    @property
    def job_id(self) -> Optional[str]:
        if getattr(self, "job", None) is None:
            return None
        ref = getattr(self.job, "ref", None)
        if ref is not None:
            return str(ref.id)
        linked_id = getattr(self.job, "id", None)
        return str(linked_id) if linked_id else None
