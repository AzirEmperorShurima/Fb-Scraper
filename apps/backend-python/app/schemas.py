from pydantic import BaseModel, EmailStr, HttpUrl, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date

# Auth schemas
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# FB Account schemas
class FBAccountBase(BaseModel):
    email: str
    status: Optional[str] = "valid"

class FBAccountCreate(FBAccountBase):
    password: Optional[str] = None
    cookies_json: Optional[List[Dict[str, Any]]] = None

class FBAccountUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    cookies_json: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None

class ProxyEndpointBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    proxy_url: str = Field(min_length=1)
    status: Optional[str] = "active"

class ProxyEndpointCreate(ProxyEndpointBase):
    pass

class ProxyEndpointUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    proxy_url: Optional[str] = Field(default=None, min_length=1)
    status: Optional[str] = None
    health_score: Optional[int] = Field(default=None, ge=0, le=100)
    cooldown_until: Optional[datetime] = None

class ProxyEndpointResponse(ProxyEndpointBase):
    id: str
    health_score: int
    cooldown_until: Optional[datetime] = None
    last_used: Optional[datetime] = None
    success_count: int
    failure_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FBAccountRuntimeStateBase(BaseModel):
    proxy_id: Optional[str] = None
    session_profile_path: Optional[str] = None

class FBAccountRuntimeStateUpdate(FBAccountRuntimeStateBase):
    health_score: Optional[int] = Field(default=None, ge=0, le=100)
    cooldown_until: Optional[datetime] = None
    last_error: Optional[str] = None

class FBAccountRuntimeStateResponse(FBAccountRuntimeStateBase):
    health_score: int
    cooldown_until: Optional[datetime] = None
    success_count: int
    failure_count: int
    last_success_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    proxy: Optional[ProxyEndpointResponse] = None

    class Config:
        from_attributes = True

class FBAccountResponse(FBAccountBase):
    id: str
    cookies_json: Optional[List[Dict[str, Any]]] = None
    last_used: Optional[datetime] = None
    created_at: datetime
    runtime_state: Optional[FBAccountRuntimeStateResponse] = None

    class Config:
        from_attributes = True

class CrawlTargetBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    target_type: str = Field(default="group", min_length=1, max_length=50)
    target_url: str = Field(min_length=1)
    description: Optional[str] = None
    is_active: bool = True
    default_max_posts: int = Field(default=50, ge=1, le=1000)
    default_include_comments: bool = False
    extra_config: Optional[Dict[str, Any]] = None

class CrawlTargetCreate(CrawlTargetBase):
    pass

class CrawlTargetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    target_type: Optional[str] = Field(default=None, min_length=1, max_length=50)
    target_url: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    default_max_posts: Optional[int] = Field(default=None, ge=1, le=1000)
    default_include_comments: Optional[bool] = None
    extra_config: Optional[Dict[str, Any]] = None

class CrawlTargetResponse(CrawlTargetBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CrawlPlanBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: bool = True
    interval_minutes: int = Field(default=60, ge=5, le=10080)
    max_posts: int = Field(default=50, ge=1, le=1000)
    include_comments: bool = False
    fb_account_id: Optional[str] = None

class CrawlPlanCreate(CrawlPlanBase):
    target_ids: List[str] = Field(default_factory=list)

class CrawlPlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    interval_minutes: Optional[int] = Field(default=None, ge=5, le=10080)
    max_posts: Optional[int] = Field(default=None, ge=1, le=1000)
    include_comments: Optional[bool] = None
    fb_account_id: Optional[str] = None
    target_ids: Optional[List[str]] = None

class CrawlPlanResponse(CrawlPlanBase):
    id: str
    user_id: str
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    targets: List[CrawlTargetResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

class CrawlPlanDispatchResponse(BaseModel):
    plan_id: str
    queued_jobs: int
    job_ids: List[str]

class ScrapeJobBase(BaseModel):
    target_url: str
    target_type: str = Field(default="group", min_length=1, max_length=50)
    target_name: Optional[str] = None
    max_posts: Optional[int] = 50
    include_comments: Optional[bool] = False
    since_date: Optional[date] = None
    until_date: Optional[date] = None
    keyword_filter: Optional[str] = None
    min_reactions: Optional[int] = 0

class ScrapeJobCreate(ScrapeJobBase):
    fb_account_id: Optional[str] = None

class ScrapeJobResponse(ScrapeJobBase):
    id: str
    user_id: str
    group_url: Optional[str] = None
    fb_account_id: Optional[str] = None
    proxy_endpoint_id: Optional[str] = None
    crawl_plan_id: Optional[str] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    progress: int
    error_message: Optional[str] = None
    logs: Optional[str] = ""

    class Config:
        from_attributes = True

# Scraped Post schemas
class ScrapedPostResponse(BaseModel):
    id: str
    job_id: str
    post_id: str
    author_name: Optional[str] = None
    author_url: Optional[str] = None
    text: Optional[str] = None
    timestamp: Optional[datetime] = None
    reactions_json: Optional[Dict[str, Any]] = None
    comments_count: int
    comments_json: Optional[List[Dict[str, Any]]] = None
    attachments_json: Optional[List[str]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Paginated response helper
class PaginatedPostsResponse(BaseModel):
    total: int
    page: int
    size: int
    posts: List[ScrapedPostResponse]

# Analytics schemas
class EngagementOverTime(BaseModel):
    date: str
    posts_count: int
    reactions_count: int
    comments_count: int

class TopAuthor(BaseModel):
    author_name: str
    posts_count: int

class WordFreq(BaseModel):
    text: str
    value: int

class JobAnalyticsResponse(BaseModel):
    total_posts: int
    total_comments: int
    total_reactions: int
    reactions_breakdown: Dict[str, int]
    engagement_over_time: List[EngagementOverTime]
    top_authors: List[TopAuthor]
    word_cloud: List[WordFreq]
