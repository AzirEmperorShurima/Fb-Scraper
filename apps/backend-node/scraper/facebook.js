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
      const rawData = fs.readFileSync(proxyFile, 'utf8');
      const sanitizedData = rawData.replace(/^\s*\/\/.*$/gm, '');
      const data = JSON.parse(sanitizedData);
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
  checkStatusCallback = null,
  userDataDir = null
}) {
  const logMsg = (msg) => {
    console.log(msg);
    if (logCallback) logCallback(msg);
  };

  logMsg(`🕵️ Bắt đầu cào dữ liệu Facebook Group bằng Node.js Playwright tại: ${groupUrl}`);
  
  const proxy = getRandomProxy();
  if (proxy) logMsg(`🌐 Sử dụng Proxy: ${proxy.server}`);

  const proxyConfig = proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined;

  let browser;
  let context;

  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const timezones = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Jakarta'];
  const timezoneId = timezones[Math.floor(Math.random() * timezones.length)];

  if (userDataDir) {
    logMsg(`🚀 Khởi chạy Real Chrome Profile từ: ${userDataDir}`);
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      proxy: proxyConfig,
      args: [
        "--disable-notifications",
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ],
      userAgent,
      viewport: { 
        width: 1280 + Math.floor(Math.random() * 200 - 100), 
        height: 800 + Math.floor(Math.random() * 200 - 100) 
      },
      timezoneId,
      locale: 'vi-VN'
    });
  } else {
    browser = await chromium.launch({
      headless: false,
      proxy: proxyConfig,
      args: [
        "--disable-notifications",
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ]
    });

    context = await browser.newContext({
      userAgent,
      viewport: { 
        width: 1280 + Math.floor(Math.random() * 200 - 100), 
        height: 800 + Math.floor(Math.random() * 200 - 100) 
      },
      timezoneId,
      locale: 'vi-VN'
    });
  }

  if (!userDataDir && cookies && cookies.length > 0) {
    logMsg("🔑 Đang nạp cookies phiên hoạt động...");
    const sanitizedCookies = cookies.map(c => {
      let sameSite = c.sameSite;
      if (typeof sameSite === 'string') {
        const lower = sameSite.toLowerCase();
        if (lower === 'no_restriction' || lower === 'none') sameSite = 'None';
        else if (lower === 'lax') sameSite = 'Lax';
        else if (lower === 'strict') sameSite = 'Strict';
        else sameSite = 'None';
      } else {
        sameSite = 'None';
      }
      
      // Keep only essential fields to prevent Playwright rejection or mismatch
      return { 
        name: String(c.name), 
        value: String(c.value), 
        domain: '.facebook.com', 
        path: '/',
        sameSite: sameSite,
        secure: true
      };
    });
    try {
      await context.addCookies(sanitizedCookies);
    } catch (e) {
      logMsg(`⚠️ Cảnh báo nạp cookies: ${e.message}`);
    }
  }

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  let newCookies = [];

  try {
    logMsg("🔗 Đang kiểm tra trạng thái đăng nhập Facebook...");
    await page.goto("https://www.facebook.com");
    await simulateMouseMovement(page);
    await page.waitForTimeout(2000);

    let isLoggedIn = false;
    try {
      // Bất kể ngôn ngữ (Locale) nào, trang Login của Facebook luôn có ô nhập password.
      // Nếu không tìm thấy ô password, tức là ta đã ở trong News Feed hoặc Group (đã đăng nhập thành công).
      const passwordInput = await page.$('input[type="password"]');
      if (!passwordInput) {
        isLoggedIn = true;
      }
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
      if (checkStatusCallback) {
        let currentStatus = await checkStatusCallback();
        if (currentStatus === "stopped" || currentStatus === "completed" || currentStatus === "failed") {
          logMsg("🛑 Job đã bị dừng từ hệ thống.");
          stopScrolling = true;
          break;
        }
        while (currentStatus === "paused") {
          logMsg("⏸️ Job đang tạm dừng...");
          await new Promise(resolve => setTimeout(resolve, 5000));
          currentStatus = await checkStatusCallback();
          if (currentStatus !== "paused") {
            logMsg("▶️ Job tiếp tục chạy...");
            if (currentStatus === "stopped" || currentStatus === "completed" || currentStatus === "failed") {
               stopScrolling = true;
               break;
            }
          }
        }
        if (stopScrolling) break;
      }

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
          let postTime = new Date();
          const linksForTime = await article.$$('a[role="link"]');
          let timeText = "";
          for (const el of linksForTime) {
             const txt = await el.innerText();
             if (txt && /^(vừa xong|\d+\s*(phút|giờ|ngày|tháng|năm)|hôm qua)/i.test(txt)) {
                timeText = txt; 
                break;
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
          let textContent = "";
          const messageElem = await article.$('div[data-ad-preview="message"]');
          if (messageElem) {
            textContent = await messageElem.innerText();
          } else {
            const textElements = await article.$$('div[dir="auto"]');
            const textParts = [];
            for (const elem of textElements) {
              const txt = await elem.innerText();
              // Prevent duplicates and small button texts
              if (txt && txt.trim().length > 10 && !textParts.some(p => p.includes(txt.trim()) || txt.trim().includes(p))) {
                textParts.push(txt.trim());
              }
            }
            textContent = textParts.join("\n");
          }

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
            const signature = `${authorName}_${textContent.substring(0, 100)}_${attachments.length}`;
            postId = `ext_meta_${hashCode(signature)}`;
          }

          if (!textContent && attachments.length === 0) {
            continue; // Bỏ qua nếu không có cả nội dung chữ lẫn hình ảnh (thường là bài bị lỗi hoặc post rác)
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
    throw error;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
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

export async function verifyPostsStatus(postUrls, cookies = null, userDataDir = null) {
  console.log(`🔍 Bắt đầu kiểm tra trạng thái ${postUrls.length} bài viết...`);
  
  let browser;
  let context;

  if (userDataDir) {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: ["--disable-notifications", "--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"]
    });
  } else {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-notifications", "--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"]
    });
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    if (cookies && cookies.length > 0) {
      await context.addCookies(cookies);
    }
  }

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
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

  if (context) await context.close();
  if (browser) await browser.close();
  return results;
}
