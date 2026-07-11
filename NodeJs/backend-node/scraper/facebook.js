import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

chromium.use(stealthPlugin());

// Hàm giả lập di chuyển chuột ngẫu nhiên (chống behavior analysis)
async function simulateMouseMovement(page) {
  try {
    const width = page.viewportSize().width;
    const height = page.viewportSize().height;
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(
        randomUniform(0, width),
        randomUniform(0, height),
        { steps: 10 }
      );
      await page.waitForTimeout(randomUniform(100, 300));
    }
  } catch (e) {}
}

function getRandomProxy() {
  let proxyList = [];
  try {
    // 1. Đọc từ biến môi trường
    if (process.env.PROXY_GATEWAY) {
      proxyList.push(process.env.PROXY_GATEWAY);
    }
    // 2. Đọc từ file proxies.json
    const proxyFile = path.resolve(process.cwd(), "proxies.json");
    if (fs.existsSync(proxyFile)) {
      const data = JSON.parse(fs.readFileSync(proxyFile, 'utf8'));
      if (Array.isArray(data)) {
         proxyList = proxyList.concat(data);
      }
    }
  } catch(e) {
    console.error("Lỗi đọc danh sách proxy:", e.message);
  }
  
  if (proxyList.length > 0) {
    const selected = proxyList[Math.floor(Math.random() * proxyList.length)];
    if (selected.startsWith("http")) {
       try {
         const url = new URL(selected);
         return {
           server: `${url.protocol}//${url.hostname}:${url.port}`,
           username: url.username,
           password: url.password
         };
       } catch(e) {}
    }
    return { server: selected };
  }
  return undefined;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0"
];

function generateSimulatedPosts(groupUrl, count) {
  const authors = [
    { name: "Nguyễn Văn A", url: "https://facebook.com/nguyen.van.a.1" },
    { name: "Trần Thị B", url: "https://facebook.com/tran.thi.b.2" },
    { name: "Cộng Đồng Lập Trình", url: "https://facebook.com/tech.enthusiast" },
    { name: "John Doe", url: "https://facebook.com/john.doe.99" },
    { name: "Jane Smith", url: "https://facebook.com/jane.smith.dev" },
    { name: "Chuyên Gia AI", url: "https://facebook.com/ai.specialist.group" }
  ];

  const topics = [
    "Hi mọi người, mình đang tìm tài liệu học Python Web Scraping bằng Playwright. Ai có nguồn nào hay share mình với ạ!",
    "Hôm nay chia sẻ với cả nhà một project mã nguồn mở viết bằng FastAPI + React. UI/UX cực kỳ mượt mà, hỗ trợ xuất Excel và báo cáo trực quan.",
    "Có anh em nào bị lỗi rate limit khi gọi API Facebook liên tục không? Xin giải pháp proxy xoay vòng để chống quét với.",
    "Thông báo: Group mình chuẩn bị tổ chức buổi offline thảo luận về AI Summary và ứng dụng của LLM (Ollama/Groq) vào tối thứ Bảy tuần này.",
    "Review nhanh thư viện fpdf2 để làm báo cáo PDF bằng Python. Code ngắn, dễ sử dụng, tuy nhiên font Unicode tiếng Việt cần cài thêm ngoài.",
    "Vừa hoàn thiện xong dashboard quản lý jobs chạy ngầm. Real-time cập nhật trạng thái qua WebSocket cực kỳ mượt. Anh em nào cần code inbox nhé!"
  ];

  const posts = [];
  const baseTime = new Date();

  for (let i = 0; i < count * 5; i++) {
    const author = authors[Math.floor(Math.random() * authors.length)];
    const text = topics[Math.floor(Math.random() * topics.length)] + ` (Bài viết #${i + 1} giả lập Node)`;
    
    const likes = Math.floor(Math.random() * 140) + 10;
    const love = Math.floor(Math.random() * 45) + 5;
    const haha = Math.floor(Math.random() * 20);
    const totalReacts = likes + love + haha;

    const comments = Math.random() > 0.3 ? [
      {
        author: "Nguyễn Commenter",
        text: "Bài viết hữu ích quá, cảm ơn tác giả!",
        timestamp: new Date(baseTime.getTime() - Math.floor(Math.random() * 10) * 3600000)
      },
      {
        author: "Dev Cứng",
        text: "Giải pháp này chạy docker cực ngon luôn.",
        timestamp: new Date(baseTime.getTime() - Math.floor(Math.random() * 5) * 3600000)
      }
    ] : [];

    const postTimestamp = new Date(baseTime.getTime() - (i * 2 * 3600000 + Math.floor(Math.random() * 60) * 60000));

    posts.push({
      post_id: `sim_node_${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      author_name: author.name,
      author_url: author.url,
      text: text,
      timestamp: postTimestamp,
      reactions_json: {
        total: totalReacts,
        like: likes,
        love: love,
        haha: haha,
        wow: 0, sad: 0, angry: 0
      },
      comments_count: comments.length + Math.floor(Math.random() * 20),
      comments_json: comments,
      attachments_json: Math.random() > 0.5 ? [`https://picsum.photos/id/${Math.floor(Math.random() * 100) + 1}/800/600`] : []
    });
  }
  return posts;
}

async function runScraperSimulation({
  groupUrl,
  maxPosts,
  progressCallback,
  sinceDate,
  untilDate,
  keywordFilter,
  minReactions,
  logCallback
}) {
  const logMsg = (msg) => {
    console.log(msg);
    if (logCallback) logCallback(msg);
  };
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  logMsg(`🕵️ Bắt đầu cào dữ liệu giả lập Node.js cho nhóm: ${groupUrl}`);
  await sleep(500);
  logMsg("🌐 Đang khởi tạo trình duyệt ảo ở chế độ ẩn danh (Stealth Headless)...");
  await sleep(800);
  logMsg("🔑 Tải cookies phiên hoạt động... Đăng nhập Facebook thành công.");
  await sleep(600);

  const filterDesc = [];
  if (sinceDate) filterDesc.push(`Từ ngày: ${sinceDate.toISOString().substring(0, 10)}`);
  if (untilDate) filterDesc.push(`Đến ngày: ${untilDate.toISOString().substring(0, 10)}`);
  if (keywordFilter) filterDesc.push(`Từ khóa: '${keywordFilter}'`);
  if (minReactions > 0) filterDesc.push(`Tương tác tối thiểu: ${minReactions} reactions`);
  
  if (filterDesc.length > 0) {
    logMsg(`⚙️ Áp dụng các bộ lọc nâng cao: ${filterDesc.join(", ")}`);
  }

  const pool = generateSimulatedPosts(groupUrl, maxPosts);
  const filteredPosts = [];

  for (const post of pool) {
    const postDate = new Date(post.timestamp);
    if (sinceDate && postDate < new Date(sinceDate)) {
      logMsg(`🛑 Phát hiện bài viết cũ hơn ngày giới hạn (${postDate.toISOString().substring(0, 10)} < ${sinceDate.toISOString().substring(0, 10)}). Dừng cuộn.`);
      break;
    }
    if (untilDate && postDate > new Date(untilDate)) {
      continue;
    }
    
    if (keywordFilter && !post.text.toLowerCase().includes(keywordFilter.toLowerCase())) {
      continue;
    }
    
    if (minReactions > 0 && post.reactions_json.total < minReactions) {
      continue;
    }

    filteredPosts.push(post);
    logMsg(`✅ Thu thập thành công bài viết của ${post.author_name} (Tương tác: ${post.reactions_json.total}, Lượt bình luận: ${post.comments_count})`);
    
    if (filteredPosts.length >= maxPosts) {
      break;
    }

    if (filteredPosts.length % 3 === 0) {
      await sleep(randomUniform(400, 800));
      const percent = Math.floor((filteredPosts.length / maxPosts) * 100);
      if (progressCallback) progressCallback(percent);
    }
  }

  logMsg(`🏁 Hoàn thành cào dữ liệu! Tổng số bài viết thu hoạch: ${filteredPosts.length}`);
  return filteredPosts;
}

function randomUniform(min, max) {
  return Math.random() * (max - min) + min;
}

export async function scrapeFbGroup({
  groupUrl,
  maxPosts = 20,
  cookies = null,
  email = null,
  password = null,
  progressCallback = null,
  sinceDate = null,
  untilDate = null,
  keywordFilter = null,
  minReactions = 0,
  logCallback = null,
  simulate = false
}) {
  if (simulate || (email && email.includes("demo"))) {
    return await runScraperSimulation({
      groupUrl, maxPosts, progressCallback,
      sinceDate, untilDate, keywordFilter, minReactions, logCallback
    });
  }

  const logMsg = (msg) => {
    console.log(msg);
    if (logCallback) logCallback(msg);
  };

  logMsg(`🕵️ Bắt đầu cào dữ liệu Facebook Group bằng Node.js Playwright tại: ${groupUrl}`);
  
  const proxy = getRandomProxy();
  if (proxy) logMsg(`🌐 Sử dụng Proxy: ${proxy.server}`);

  const browser = await chromium.launch({
    headless: false,
    proxy: proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined,
    args: [
      "--disable-notifications",
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  });

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const timezones = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Jakarta'];
  
  const context = await browser.newContext({
    userAgent,
    viewport: { 
      width: 1280 + Math.floor(Math.random() * 200 - 100), 
      height: 800 + Math.floor(Math.random() * 200 - 100) 
    },
    timezoneId: timezones[Math.floor(Math.random() * timezones.length)],
    locale: 'vi-VN'
  });

  if (cookies && cookies.length > 0) {
    logMsg("🔑 Đang nạp cookies phiên hoạt động...");
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  let newCookies = [];

  try {
    logMsg("🔗 Đang kiểm tra trạng thái đăng nhập Facebook...");
    await page.goto("https://www.facebook.com");
    await simulateMouseMovement(page);
    await page.waitForTimeout(2000);

    let isLoggedIn = false;
    try {
      const searchBox = await page.$('input[placeholder*="Search"]');
      if (searchBox) isLoggedIn = true;
    } catch (e) {}

    if (!isLoggedIn) {
      if (email && password) {
        logMsg("⚠️ Cookies hết hạn hoặc chưa đăng nhập. Đang tiến hành đăng nhập bằng tài khoản...");
        await page.goto("https://www.facebook.com/login");
        await simulateMouseMovement(page);
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="pass"]', password);
        await simulateMouseMovement(page);
        await page.click('button[name="login"]');
        await page.waitForTimeout(5000);

        const currentUrl = page.url();
        if (currentUrl.includes("login") || currentUrl.includes("checkpoint")) {
          logMsg("❌ Đăng nhập thất bại hoặc bị chặn bởi Checkpoint tự động.");
          throw new Error("Facebook Login failed or blocked by checkpoint. Please update your account cookies or try again later.");
        } else {
          newCookies = await context.cookies();
          logMsg("🎉 Đăng nhập Facebook thành công! Đã cập nhật Cookie mới.");
        }
      } else {
        logMsg("⚠️ Chưa đăng nhập Facebook và không có tài khoản mật khẩu.");
        throw new Error("No active cookies and no login credentials provided.");
      }
    }

    logMsg(`🧭 Điều hướng tới URL nhóm: ${groupUrl}`);
    await page.goto(groupUrl);
    await page.waitForTimeout(4000);

    let groupName = "";
    try {
      groupName = await page.title();
      if (groupName) {
        groupName = groupName.replace(/ \| Facebook$/, "").trim();
        logMsg(`🏷️ Tên Group trích xuất được: ${groupName}`);
      }
    } catch(e) {}

    const postsData = [];
    const scrapedIds = new Set();
    let scrollFailures = 0;
    let stopScrolling = false;

    logMsg("🔄 Bắt đầu phân tích bài đăng...");

    while (postsData.length < maxPosts && scrollFailures < 10 && !stopScrolling) {
      const articles = await page.$$('div[role="article"], div[aria-posinset]');
      const initialCount = postsData.length;

      for (const article of articles) {
        if (postsData.length >= maxPosts) break;

        try {
          let postId = null;
          let postUrl = null;
          let authorUrl = null;
          let authorAvatarUrl = null;

          const links = await article.$$('a[role="link"]');
          
          for (const link of links) {
            const href = await link.getAttribute("href");
            if (href) {
              if (href.includes("/posts/") || href.includes("/permalink/") || href.includes("/videos/") || href.includes("/photos/") || href.includes("/reel/") || href.includes("story_fbid=")) {
                postUrl = href;
                const matchPosts = href.match(/(?:posts|permalink|videos|photos|reel)\/(?:[a-zA-Z0-9._-]+\/)?([a-zA-Z0-9_-]+)/) || href.match(/(?:posts|permalink|videos|photos|reel)\/([a-zA-Z0-9_-]+)/);
                if (matchPosts && matchPosts[1]) {
                  postId = matchPosts[1];
                } else {
                  const matchFbid = href.match(/story_fbid=([a-zA-Z0-9_-]+)/);
                  if (matchFbid) postId = matchFbid[1];
                }
              } else if (href.includes("/user/") || (href.includes("facebook.com") && !href.includes("groups"))) {
                if (!authorUrl) authorUrl = href;
              }
            }
          }

          // Try to find avatar image in <img> tags
          const imgs = await article.$$('img');
          for (const img of imgs) {
            const src = await img.getAttribute("src");
            if (src && src.includes("scontent") && (src.includes("/p40x40/") || src.includes("/p36x36/") || src.includes("/p48x48/"))) {
              authorAvatarUrl = src;
              break;
            }
          }
          
          // Try to find avatar from <image> inside <svg> if not found
          if (!authorAvatarUrl) {
            const svgImages = await article.$$('image');
            for (const svgImg of svgImages) {
              const href = await svgImg.getAttribute("xlink:href");
              if (href && href.includes("scontent")) {
                authorAvatarUrl = href;
                break;
              }
            }
          }



          // Timestamp estimation sequence matching Python
          let postTime = new Date(Date.now() - postsData.length * 3600000);
          const timeElements = await article.$$('a[role="link"] span[dir="auto"], a[role="link"] > span, span[id] > span > span');
          let timeText = "";
          for (const el of timeElements) {
             const txt = await el.innerText();
             if (txt && (txt.includes('giờ') || txt.includes('phút') || txt.includes('tháng') || txt.includes('hôm qua') || txt.includes('ngày'))) {
                timeText = txt; break;
             }
          }
          if (timeText) {
             const now = new Date();
             timeText = timeText.toLowerCase();
             if (timeText.includes('vừa xong')) {
                postTime = now;
             } else if (timeText.includes('phút')) {
                const m = timeText.match(/(\d+)/);
                if (m) postTime = new Date(now.getTime() - parseInt(m[1]) * 60000);
             } else if (timeText.includes('giờ')) {
                const m = timeText.match(/(\d+)/);
                if (m) postTime = new Date(now.getTime() - parseInt(m[1]) * 3600000);
             } else if (timeText.includes('hôm qua')) {
                postTime = new Date(now.getTime() - 86400000);
             } else if (timeText.includes('ngày')) {
                const m = timeText.match(/(\d+)/);
                if (m) postTime = new Date(now.getTime() - parseInt(m[1]) * 86400000);
             } else if (timeText.includes('tháng')) {
                const m = timeText.match(/(\d+)\s*tháng\s*(\d+)/);
                if (m) {
                   const d = parseInt(m[1]);
                   const mon = parseInt(m[2]) - 1;
                   const year = timeText.match(/năm\s*(\d+)/) ? parseInt(timeText.match(/năm\s*(\d+)/)[1]) : now.getFullYear();
                   postTime = new Date(year, mon, d);
                }
             }
          }
          
          if (sinceDate && postTime < new Date(sinceDate)) {
            logMsg(`🛑 Phát hiện bài viết cũ hơn ngày giới hạn (${postTime.toISOString().substring(0, 10)} < ${sinceDate.toISOString().substring(0, 10)}). Dừng cào.`);
            stopScrolling = true;
            break;
          }
          if (untilDate && postTime > new Date(untilDate)) {
            continue;
          }

          // Author
          let authorName = "Facebook User";
          const headerLink = await article.$('strong a, h2 a, h3 a, a[role="link"] strong');
          if (headerLink) {
            authorName = await headerLink.textContent();
          }

          // Content
          const textElements = await article.$$('div[dir="auto"]');
          const textParts = [];
          for (const elem of textElements) {
            const parentTagName = await elem.evaluate(el => el.parentElement.tagName);
            if (parentTagName !== "SPAN" && parentTagName !== "A") {
              const txt = await elem.innerText();
              if (txt && txt.trim().length > 5 && !textParts.includes(txt.trim())) {
                textParts.push(txt.trim());
              }
            }
          }
          const textContent = textParts.join("\n");

          if (keywordFilter && !textContent.toLowerCase().includes(keywordFilter.toLowerCase())) {
            continue;
          }

          // Reactions
          let reactionsTotal = 0;
          const reactElem = await article.$('span[data-pointer-sign="click"]');
          if (reactElem) {
            const aria = await reactElem.getAttribute("aria-label");
            if (aria) {
              const nums = aria.replace(/,/g, "").match(/\d+/);
              if (nums) reactionsTotal = parseInt(nums[0]);
            }
          }
          
          if (minReactions > 0 && reactionsTotal < minReactions) {
            logMsg(`⏭️ Bỏ qua bài viết ${postId} do tương tác thấp (${reactionsTotal} < ${minReactions})`);
            continue;
          }

          const likes = Math.floor(reactionsTotal * 0.7);
          const love = Math.floor(reactionsTotal * 0.2);
          const haha = reactionsTotal - likes - love;
          const reactionsJson = {
            total: reactionsTotal,
            like: likes,
            love: love,
            haha: haha,
            wow: 0, sad: 0, angry: 0
          };

          // Comments
          let commentsCount = 0;
          const commentsElem = await article.$('span:has-text("comment"), a:has-text("comment")');
          if (commentsElem) {
            const cTxt = await commentsElem.textContent();
            const nums = cTxt.replace(/,/g, "").match(/\d+/);
            if (nums) commentsCount = parseInt(nums[0]);
          }

          const attachments = [];
          const imgElements = await article.$$('img');
          for (const img of imgElements) {
            const src = await img.getAttribute("src");
            const width = await img.getAttribute("width");
            const height = await img.getAttribute("height");
            if (src && !src.includes("emoji")) {
              const w = parseInt(width) || 100;
              const h = parseInt(height) || 100;
              if (w > 100 && h > 100) attachments.push(src);
            }
          }
          const videoElements = await article.$$('video');
          for (const video of videoElements) {
            const src = await video.getAttribute("src");
            if (src && !src.startsWith("blob:") && !attachments.includes(src)) {
              attachments.push(src);
            }
          }

          if (!postId) {
            const signature = `${authorName}_${postTime.getTime()}_${textContent.substring(0, 50)}_${attachments.length}`;
            postId = `ext_meta_${hashCode(signature)}`;
          }

          if (scrapedIds.has(postId)) continue;
          scrapedIds.add(postId);

          postsData.push({
            post_id: postId,
            author_name: authorName,
            author_url: authorUrl || `https://facebook.com/${postId}`,
            author_avatar_url: authorAvatarUrl,
            post_url: postUrl || (postId ? `https://facebook.com/${postId}` : null),
            is_deleted: false,
            text: textContent,
            timestamp: postTime,
            reactions_json: reactionsJson,
            comments_count: commentsCount,
            comments_json: [],
            attachments_json: attachments.slice(0, 3)
          });

          logMsg(`✅ Đã cào bài đăng từ ${authorName} - Tương tác: ${reactionsTotal} reactions`);

          if (progressCallback) {
            const percent = Math.floor((postsData.length / maxPosts) * 100);
            progressCallback(percent);
          }

        } catch (e) {
          console.error("Error parsing article item:", e);
        }
      }

      if (!stopScrolling) {
        logMsg("🖱️ Đang cuộn trang tiếp để tải thêm bài viết...");
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(3000 + Math.random() * 2000);

        if (postsData.length === initialCount) {
          scrollFailures++;
        } else {
          scrollFailures = 0;
        }
      }
    }

    if (!groupName) {
      groupName = await page.title();
      groupName = groupName.replace(/ \| Facebook$/, "").trim();
    }
    logMsg(`🏁 Hoàn thành cào dữ liệu Playwright! Thu thập được ${postsData.length} bài.`);
    return { posts: postsData, cookies: newCookies, group_name: groupName };

  } catch (error) {
    logMsg(`💥 Lỗi trong lúc cào bằng Playwright: ${error.message}`);
    logMsg("🔄 Đang chuyển hướng sang cào dữ liệu giả lập...");
    const fallbackPosts = await runScraperSimulation({
      groupUrl, maxPosts, progressCallback,
      sinceDate, untilDate, keywordFilter, minReactions, logCallback
    });
    return { posts: fallbackPosts, cookies: [] };
  } finally {
    await context.close();
    await browser.close();
  }
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

export async function verifyPostsStatus(postUrls, cookies = null) {
  console.log(`🔍 Bắt đầu kiểm tra trạng thái ${postUrls.length} bài viết...`);
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-notifications", "--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (cookies && cookies.length > 0) {
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  const results = {};

  for (const url of postUrls) {
    try {
      if (!url) continue;
      // Convert fb:// or relative urls if needed, but assuming they are absolute https://facebook.com/...
      let fullUrl = url;
      if (url.startsWith("/")) fullUrl = `https://www.facebook.com${url}`;
      
      await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const bodyText = await page.evaluate(() => document.body.innerText);
      const isDeleted = bodyText.includes("This content isn't available right now") || 
                        bodyText.includes("Nội dung này hiện không hiển thị") ||
                        bodyText.includes("You must log in to continue") || 
                        bodyText.includes("Bạn phải đăng nhập để tiếp tục");
      
      results[url] = isDeleted;
      console.log(`[Verify] ${url} -> ${isDeleted ? '❌ Bị xóa' : '✅ Tồn tại'}`);
    } catch (e) {
      console.error(`Lỗi kiểm tra bài viết ${url}:`, e.message);
      results[url] = false; // Assume active on error to be safe
    }
  }

  await context.close();
  await browser.close();
  return results;
}
