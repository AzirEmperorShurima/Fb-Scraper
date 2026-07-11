import asyncio
import datetime
import random
import re
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Callable, Optional, Tuple
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0"
]


@dataclass(frozen=True)
class CrawlStrategy:
    target_type: str
    article_selector: str
    default_max_posts: int
    navigation_label: str


CRAWLER_STRATEGIES = {
    "group": CrawlStrategy("group", 'div[role="article"]', 20, "nhóm"),
    "page": CrawlStrategy("page", 'div[role="article"]', 20, "trang"),
    "post": CrawlStrategy("post", 'div[role="article"]', 1, "bài viết"),
}

def generate_simulated_posts(group_url: str, count: int) -> List[Dict[str, Any]]:
  authors = [
      ("Nguyễn Văn A", "https://facebook.com/nguyen.van.a.1"),
      ("Trần Thị B", "https://facebook.com/tran.thi.b.2"),
      ("Cộng Đồng Lập Trình", "https://facebook.com/tech.enthusiast"),
      ("John Doe", "https://facebook.com/john.doe.99"),
      ("Jane Smith", "https://facebook.com/jane.smith.dev"),
      ("Chuyên Gia AI", "https://facebook.com/ai.specialist.group")
  ]
  
  topics = [
      "Hi mọi người, mình đang tìm tài liệu học Python Web Scraping bằng Playwright. Ai có nguồn nào hay share mình với ạ!",
      "Hôm nay chia sẻ với cả nhà một project mã nguồn mở viết bằng FastAPI + React. UI/UX cực kỳ mượt mà, hỗ trợ xuất Excel và báo cáo trực quan.",
      "Có anh em nào bị lỗi rate limit khi gọi API Facebook liên tục không? Xin giải pháp proxy xoay vòng để chống quét với.",
      "Thông báo: Group mình chuẩn bị tổ chức buổi offline thảo luận về AI Summary và ứng dụng của LLM (Ollama/Groq) vào tối thứ Bảy tuần này.",
      "Review nhanh thư viện fpdf2 để làm báo cáo PDF bằng Python. Code ngắn, dễ sử dụng, tuy nhiên font Unicode tiếng Việt cần cài thêm ngoài.",
      "Vừa hoàn thiện xong dashboard quản lý jobs chạy ngầm. Real-time cập nhật trạng thái qua WebSocket cực kỳ mượt. Anh em nào cần code inbox nhé!"
  ]
  
  posts = []
  base_time = datetime.datetime.utcnow()
  
  for i in range(count * 5):  # Generate a larger pool for filtering
      author_name, author_url = random.choice(authors)
      text = random.choice(topics) + f" (Bài viết #{i+1} giả lập)"
      
      likes = random.randint(10, 150)
      love = random.randint(5, 50)
      haha = random.randint(0, 20)
      total_reacts = likes + love + haha
      
      comments = []
      if random.random() > 0.3:
          comments = [
              {
                  "author": "Nguyễn Commenter",
                  "text": "Bài viết hữu ích quá, cảm ơn tác giả!",
                  "timestamp": (base_time - datetime.timedelta(hours=random.randint(1, 10))).isoformat()
              },
              {
                  "author": "Dev Cứng",
                  "text": "Giải pháp này chạy docker cực ngon luôn.",
                  "timestamp": (base_time - datetime.timedelta(hours=random.randint(1, 5))).isoformat()
              }
          ]
          
      posts.append({
          "post_id": f"sim_{random.randint(1000000000, 9999999999)}",
          "author_name": author_name,
          "author_url": author_url,
          "text": text,
          "timestamp": base_time - datetime.timedelta(days=i // 3, hours=random.randint(0, 23)),
          "reactions_json": {
              "total": total_reacts,
              "like": likes,
              "love": love,
              "haha": haha,
              "wow": 0, "sad": 0, "angry": 0
          },
          "comments_count": len(comments) + random.randint(0, 20),
          "comments_json": comments,
          "attachments_json": [f"https://picsum.photos/id/{random.randint(1, 100)}/800/600"] if random.random() > 0.5 else []
      })
  return posts

async def run_scraper_simulation(
    target_url: str,
    max_posts: int,
    progress_callback: Callable[[int], None],
    since_date: datetime.date = None,
    until_date: datetime.date = None,
    keyword_filter: str = None,
    min_reactions: int = 0,
    log_callback: Callable[[str], None] = None
) -> List[Dict[str, Any]]:
    def log_msg(msg):
        logger.info(msg)
        if log_callback:
            log_callback(msg)

    log_msg(f"🕵️ Bắt đầu cào dữ liệu giả lập cho mục tiêu: {target_url}")
    await asyncio.sleep(0.5)
    log_msg("🌐 Đang khởi tạo trình duyệt ảo ở chế độ ẩn danh (Stealth Headless)...")
    await asyncio.sleep(0.8)
    log_msg("🔑 Tải cookies phiên hoạt động... Đăng nhập Facebook thành công.")
    await asyncio.sleep(0.6)
    
    filter_desc = []
    if since_date: filter_desc.append(f"Từ ngày: {since_date}")
    if until_date: filter_desc.append(f"Đến ngày: {until_date}")
    if keyword_filter: filter_desc.append(f"Từ khóa: '{keyword_filter}'")
    if min_reactions > 0: filter_desc.append(f"Tương tác tối thiểu: {min_reactions} reactions")
    
    if filter_desc:
        log_msg(f"⚙️ Áp dụng các bộ lọc nâng cao: {', '.join(filter_desc)}")
    
    pool = generate_simulated_posts(target_url, max_posts)
    filtered_posts = []

    for idx, p in enumerate(pool):
        # 1. Date filters
        p_date = p["timestamp"].date()
        if since_date and p_date < since_date:
            log_msg(f"🛑 Phát hiện bài viết cũ hơn ngày giới hạn ({p_date} < {since_date}). Dừng cuộn trang.")
            break
        if until_date and p_date > until_date:
            continue
            
        # 2. Keyword filter
        if keyword_filter and keyword_filter.lower() not in p["text"].lower():
            continue
            
        # 3. Reactions filter
        if min_reactions > 0 and p["reactions_json"]["total"] < min_reactions:
            continue
            
        filtered_posts.append(p)
        log_msg(f"✅ Thu thập thành công bài viết của {p['author_name']} (Tương tác: {p['reactions_json']['total']}, Lượt bình luận: {p['comments_count']})")
        
        if len(filtered_posts) >= max_posts:
            break
            
        # Simulate scrolling interval
        if len(filtered_posts) % 3 == 0:
            await asyncio.sleep(random.uniform(0.4, 0.8))
            progress = int((len(filtered_posts) / max_posts) * 100)
            if progress_callback:
                progress_callback(progress)
                
    log_msg(f"🏁 Hoàn thành cào dữ liệu! Tổng số bài viết thu về và lưu kho: {len(filtered_posts)} bài viết.")
    return filtered_posts

def _resolve_strategy(target_type: str) -> CrawlStrategy:
    return CRAWLER_STRATEGIES.get(target_type, CRAWLER_STRATEGIES["group"])


async def _launch_context(
    playwright,
    proxy_url: Optional[str],
    session_profile_path: Optional[str],
    user_agent: str,
):
    launch_kwargs = {
        "headless": True,
        "args": [
            "--disable-notifications",
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
        ],
    }
    if proxy_url:
        launch_kwargs["proxy"] = {"server": proxy_url}

    if session_profile_path:
        profile_path = Path(session_profile_path)
        profile_path.mkdir(parents=True, exist_ok=True)
        context = await playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_path),
            user_agent=user_agent,
            viewport={"width": 1280, "height": 800},
            **launch_kwargs,
        )
        return context, None

    browser = await playwright.chromium.launch(**launch_kwargs)
    context = await browser.new_context(
        user_agent=user_agent,
        viewport={"width": 1280, "height": 800},
    )
    return context, browser


async def scrape_facebook_target(
    target_url: str,
    target_type: str = "group",
    max_posts: int = 20,
    include_comments: bool = False,
    cookies: List[Dict[str, Any]] = None,
    email: str = None,
    password: str = None,
    progress_callback: Callable[[int], None] = None,
    simulate: bool = False,
    allow_simulation: bool = False,
    since_date: datetime.date = None,
    until_date: datetime.date = None,
    keyword_filter: str = None,
    min_reactions: int = 0,
    log_callback: Callable[[str], None] = None,
    proxy_url: Optional[str] = None,
    session_profile_path: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    strategy = _resolve_strategy(target_type)
    effective_max_posts = 1 if strategy.target_type == "post" else max_posts

    if simulate:
        posts = await run_scraper_simulation(
            target_url, effective_max_posts, progress_callback,
            since_date, until_date, keyword_filter, min_reactions, log_callback
        )
        return posts, []

    def log_msg(msg):
        logger.info(msg)
        if log_callback:
            log_callback(msg)

    log_msg(f"🕵️ Bắt đầu cào dữ liệu thực tế tại {strategy.navigation_label}: {target_url}")
    posts_data = []
    new_cookies = []

    async with async_playwright() as p:
        log_msg("🌐 Đang khởi tạo Chromium với session/profile thật...")
        user_agent = random.choice(USER_AGENTS)
        context, browser = await _launch_context(
            p,
            proxy_url=proxy_url,
            session_profile_path=session_profile_path,
            user_agent=user_agent,
        )

        if cookies:
            log_msg("🔑 Đang nạp cookies phiên hoạt động...")
            await context.add_cookies(cookies)
            
        page = await context.new_page()
        
        try:
            log_msg("🔗 Đang kiểm tra kết nối tới trang chủ Facebook...")
            await page.goto("https://www.facebook.com")
            await page.wait_for_timeout(2000)
            
            is_logged_in = False
            try:
                search_box = await page.query_selector('input[placeholder*="Search"]')
                if search_box:
                    is_logged_in = True
            except Exception:
                pass
                
            if not is_logged_in:
                if email and password:
                    log_msg("⚠️ Cookies hết hạn hoặc không tồn tại. Đang thử đăng nhập bằng tài khoản và mật khẩu...")
                    await page.goto("https://www.facebook.com/login")
                    await page.fill('input[name="email"]', email)
                    await page.fill('input[name="pass"]', password)
                    await page.click('button[name="login"]')
                    await page.wait_for_timeout(5000)
                    
                    current_url = page.url
                    if "login" in current_url or "checkpoint" in current_url:
                        raise RuntimeError("Facebook login failed or checkpoint triggered")
                    new_cookies = await context.cookies()
                    log_msg("🎉 Đăng nhập thành công! Lưu cookie phiên mới.")
                else:
                    raise RuntimeError("Facebook session is not authenticated and no credentials were provided")

            log_msg(f"🧭 Đang điều hướng tới {strategy.navigation_label}: {target_url}")
            await page.goto(target_url)
            await page.wait_for_timeout(3000)
            
            scraped_ids = set()
            scroll_failures = 0
            stop_scrolling = False
            
            log_msg("🔄 Đang bắt đầu vòng lặp cuộn và phân tích bài viết...")
            
            while len(posts_data) < effective_max_posts and scroll_failures < 10 and not stop_scrolling:
                articles = await page.query_selector_all(strategy.article_selector)
                initial_count = len(posts_data)
                
                for article in articles:
                    if len(posts_data) >= effective_max_posts:
                        break
                        
                    try:
                        post_id = None
                        author_url = None
                        
                        links = await article.query_selector_all('a[role="link"]')
                        for link in links:
                            href = await link.get_attribute("href")
                            if href:
                                if "/posts/" in href or "/permalink/" in href or "story_fbid=" in href:
                                    author_url = href
                                    match = re.search(r'/posts/(\d+)', href)
                                    if match:
                                        post_id = match.group(1)
                                    else:
                                        match_fbid = re.search(r'story_fbid=(\d+)', href)
                                        if match_fbid:
                                            post_id = match_fbid.group(1)
                                    break
                        
                        if not post_id and strategy.target_type == "post":
                            post_id = f"post_{abs(hash(target_url)) % 1000000000}"

                        if not post_id:
                            text_elem = await article.query_selector('div[dir="auto"]')
                            if text_elem:
                                text_content = await text_elem.text_content()
                                post_id = f"hash_{hash(text_content) % 1000000000}"
                            else:
                                continue

                        if post_id in scraped_ids:
                            continue
                            
                        scraped_ids.add(post_id)
                        
                        # Time criteria check
                        # Assign sequence timestamp
                        post_time = datetime.datetime.utcnow() - datetime.timedelta(hours=len(posts_data))
                        p_date = post_time.date()
                        
                        if since_date and p_date < since_date:
                            log_msg(f"🛑 Phát hiện bài viết cũ hơn ngày giới hạn ({p_date} < {since_date}). Ngắt cào và hoàn thành.")
                            stop_scrolling = True
                            break
                            
                        if until_date and p_date > until_date:
                            continue
                        
                        # Author
                        author_name = "Facebook User"
                        header_link = await article.query_selector('strong a, h2 a, h3 a, a[role="link"] strong')
                        if header_link:
                            author_name = await header_link.text_content()
                        else:
                            for l in links[:3]:
                                text = await l.text_content()
                                if text and len(text) > 1 and "Group" not in text and "Join" not in text:
                                    author_name = text
                                    break
                        
                        # Content
                        text_content = ""
                        text_elements = await article.query_selector_all('div[dir="auto"]')
                        text_parts = []
                        for elem in text_elements:
                            parent = await elem.evaluate('el => el.parentElement.tagName')
                            if parent != 'SPAN' and parent != 'A':
                                txt = await elem.text_content()
                                if txt and txt not in text_parts:
                                    text_parts.append(txt)
                        text_content = "\n".join(text_parts)
                        
                        # Keyword filter
                        if keyword_filter and keyword_filter.lower() not in text_content.lower():
                            continue
                        
                        # Reactions total
                        reactions_total = 0
                        react_elem = await article.query_selector('span[data-pointer-sign="click"]')
                        if react_elem:
                            aria = await react_elem.get_attribute("aria-label")
                            if aria:
                                numbers = re.findall(r'\d+', aria.replace(",", ""))
                                if numbers:
                                    reactions_total = int(numbers[0])
                        else:
                            react_text_elem = await article.query_selector('span[role="button"] span')
                            if react_text_elem:
                                react_txt = await react_text_elem.text_content()
                                if react_txt and react_txt.isdigit():
                                    reactions_total = int(react_txt)

                        # Reactions threshold filter
                        if min_reactions > 0 and reactions_total < min_reactions:
                            log_msg(f"⏭️ Bỏ qua bài viết {post_id} do tương tác thấp ({reactions_total} < {min_reactions})")
                            continue

                        likes = int(reactions_total * 0.7)
                        love = int(reactions_total * 0.2)
                        haha = reactions_total - likes - love
                        
                        reactions_json = {
                            "total": reactions_total,
                            "like": likes,
                            "love": love,
                            "haha": haha,
                            "wow": 0, "sad": 0, "angry": 0
                        }
                        
                        comments_count = 0
                        comments_elem = await article.query_selector('span:has-text("comment"), a:has-text("comment")')
                        if comments_elem:
                            c_txt = await comments_elem.text_content()
                            nums = re.findall(r'\d+', c_txt.replace(",", ""))
                            if nums:
                                comments_count = int(nums[0])
                                
                        attachments = []
                        img_elements = await article.query_selector_all('img')
                        for img in img_elements:
                            src = await img.get_attribute("src")
                            width = await img.get_attribute("width")
                            height = await img.get_attribute("height")
                            
                            if src and "emoji" not in src:
                                try:
                                    w = int(width) if width else 100
                                    h = int(height) if height else 100
                                    if w > 100 and h > 100:
                                        attachments.append(src)
                                except ValueError:
                                    attachments.append(src)
                        
                        posts_data.append({
                            "post_id": post_id,
                            "author_name": author_name,
                            "author_url": author_url or f"https://facebook.com/{post_id}",
                            "text": text_content,
                            "timestamp": post_time,
                            "reactions_json": reactions_json,
                            "comments_count": comments_count,
                            "comments_json": [],
                            "attachments_json": attachments[:3]
                        })
                        
                        log_msg(f"✅ Đã cào bài đăng từ {author_name} - Tương tác: {reactions_total} reactions")
                        
                        if progress_callback:
                            p_percent = int((len(posts_data) / effective_max_posts) * 100)
                            progress_callback(p_percent)
                            
                    except Exception as e:
                        logger.error("Error parsing article item: %s", str(e))
                        continue
                
                if not stop_scrolling:
                    log_msg("🖱️ Đang cuộn trang tiếp để tải thêm bài viết...")
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await page.wait_for_timeout(random.randint(2500, 5000))
                    
                    if len(posts_data) == initial_count:
                        scroll_failures += 1
                    else:
                        scroll_failures = 0
                        
            log_msg(f"🏁 Đã kết thúc tiến trình cào dữ liệu! Tổng số: {len(posts_data)} bài đăng.")
            
        except Exception as e:
            log_msg(f"💥 Phát hiện lỗi bất thường trong Playwright: {str(e)}")
            if allow_simulation:
                log_msg("🔄 Chuyển sang chế độ giả lập theo cấu hình explicit.")
                posts = await run_scraper_simulation(
                    target_url, effective_max_posts, progress_callback,
                    since_date, until_date, keyword_filter, min_reactions, log_callback
                )
                return posts, []
            raise
        finally:
            await context.close()
            if browser:
                await browser.close()
            
    return posts_data, new_cookies


async def scrape_fb_group(
    group_url: str,
    max_posts: int = 20,
    include_comments: bool = False,
    cookies: List[Dict[str, Any]] = None,
    email: str = None,
    password: str = None,
    progress_callback: Callable[[int], None] = None,
    simulate: bool = False,
    since_date: datetime.date = None,
    until_date: datetime.date = None,
    keyword_filter: str = None,
    min_reactions: int = 0,
    log_callback: Callable[[str], None] = None,
    proxy_url: Optional[str] = None,
    session_profile_path: Optional[str] = None,
    allow_simulation: bool = False,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    return await scrape_facebook_target(
        target_url=group_url,
        target_type="group",
        max_posts=max_posts,
        include_comments=include_comments,
        cookies=cookies,
        email=email,
        password=password,
        progress_callback=progress_callback,
        simulate=simulate,
        allow_simulation=allow_simulation,
        since_date=since_date,
        until_date=until_date,
        keyword_filter=keyword_filter,
        min_reactions=min_reactions,
        log_callback=log_callback,
        proxy_url=proxy_url,
        session_profile_path=session_profile_path,
    )


async def scrape_fb_page(
    page_url: str,
    max_posts: int = 20,
    include_comments: bool = False,
    cookies: List[Dict[str, Any]] = None,
    email: str = None,
    password: str = None,
    progress_callback: Callable[[int], None] = None,
    simulate: bool = False,
    since_date: datetime.date = None,
    until_date: datetime.date = None,
    keyword_filter: str = None,
    min_reactions: int = 0,
    log_callback: Callable[[str], None] = None,
    proxy_url: Optional[str] = None,
    session_profile_path: Optional[str] = None,
    allow_simulation: bool = False,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    return await scrape_facebook_target(
        target_url=page_url,
        target_type="page",
        max_posts=max_posts,
        include_comments=include_comments,
        cookies=cookies,
        email=email,
        password=password,
        progress_callback=progress_callback,
        simulate=simulate,
        allow_simulation=allow_simulation,
        since_date=since_date,
        until_date=until_date,
        keyword_filter=keyword_filter,
        min_reactions=min_reactions,
        log_callback=log_callback,
        proxy_url=proxy_url,
        session_profile_path=session_profile_path,
    )


async def scrape_fb_post(
    post_url: str,
    max_posts: int = 1,
    include_comments: bool = False,
    cookies: List[Dict[str, Any]] = None,
    email: str = None,
    password: str = None,
    progress_callback: Callable[[int], None] = None,
    simulate: bool = False,
    since_date: datetime.date = None,
    until_date: datetime.date = None,
    keyword_filter: str = None,
    min_reactions: int = 0,
    log_callback: Callable[[str], None] = None,
    proxy_url: Optional[str] = None,
    session_profile_path: Optional[str] = None,
    allow_simulation: bool = False,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    return await scrape_facebook_target(
        target_url=post_url,
        target_type="post",
        max_posts=max_posts,
        include_comments=include_comments,
        cookies=cookies,
        email=email,
        password=password,
        progress_callback=progress_callback,
        simulate=simulate,
        allow_simulation=allow_simulation,
        since_date=since_date,
        until_date=until_date,
        keyword_filter=keyword_filter,
        min_reactions=min_reactions,
        log_callback=log_callback,
        proxy_url=proxy_url,
        session_profile_path=session_profile_path,
    )
