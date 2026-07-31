import fs from "fs";
import path from "path";
import { setupBrowser } from "./browserSetup.js";
import {
  extractPostUrls,
  extractAuthorAvatar,
  extractTimestamp,
  extractAuthorName,
  extractContent,
  extractReactions,
  extractCommentsCount,
  extractMedia
} from "./extractors.js";

function randomUniform(min, max) {
  return Math.random() * (max - min) + min;
}

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
  sortOrder = "RECENT_ACTIVITY",
  requireMedia = false,
  logCallback = null,
  checkStatusCallback = null,
  userDataDir = null,
  webrtcDefense = true,
  realIpDefense = true,
  proxies = []
}) {
  const logMsg = (msg) => {
    console.log(msg);
    if (logCallback) logCallback(msg);
  };

  logMsg(`🕵️ Bắt đầu cào dữ liệu Facebook Group bằng Node.js Playwright tại: ${groupUrl}`);
  
  let { browser, context } = await setupBrowser({
    userDataDir,
    webrtcDefense,
    realIpDefense,
    proxies,
    logMsg
  });

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
    if (checkStatusCallback && await checkStatusCallback() === "stopped") throw new Error("Job stopped");
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

    if (checkStatusCallback && await checkStatusCallback() === "stopped") throw new Error("Job stopped");
    
    let finalUrl = groupUrl;
    if (sortOrder === "CHRONOLOGICAL") {
      try {
        const parsedUrl = new URL(groupUrl);
        parsedUrl.searchParams.set("sorting_setting", "CHRONOLOGICAL");
        finalUrl = parsedUrl.toString();
      } catch(e) {}
    }
    
    logMsg(`🧭 Điều hướng tới URL nhóm: ${finalUrl}`);
    await page.goto(finalUrl);
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
          const { postId: pId, postUrl: pUrl, authorUrl: aUrl } = await extractPostUrls(article);
          let postId = pId;
          let postUrl = pUrl;
          let authorUrl = aUrl;
          let authorAvatarUrl = await extractAuthorAvatar(article);

          let postTime = await extractTimestamp(article);
          
          if (sinceDate && postTime < new Date(sinceDate)) {
            logMsg(`🛑 Phát hiện bài viết cũ hơn ngày giới hạn (${postTime.toISOString().substring(0, 10)} < ${sinceDate.toISOString().substring(0, 10)}). Dừng cào.`);
            stopScrolling = true;
            break;
          }
          if (untilDate && postTime > new Date(untilDate)) {
            continue;
          }

          let authorName = await extractAuthorName(article);
          let textContent = await extractContent(article);

          if (keywordFilter && !textContent.toLowerCase().includes(keywordFilter.toLowerCase())) {
            continue;
          }

          let reactionsJson = await extractReactions(article);
          let reactionsTotal = reactionsJson.total;
          
          if (minReactions > 0 && reactionsTotal < minReactions) {
            logMsg(`⏭️ Bỏ qua bài viết ${postId} do tương tác thấp (${reactionsTotal} < ${minReactions})`);
            continue;
          }

          let commentsCount = await extractCommentsCount(article);
          let attachments = await extractMedia(article);

          if (!postId) {
            const signature = `${authorName}_${textContent.substring(0, 100)}_${attachments.length}`;
            postId = `ext_meta_${hashCode(signature)}`;
          }

          if (!textContent && attachments.length === 0) {
            continue; // Bỏ qua nếu không có cả nội dung chữ lẫn hình ảnh (thường là bài bị lỗi hoặc post rác)
          }

          if (requireMedia && attachments.length === 0) {
            logMsg(`⏭️ Bỏ qua bài viết ${postId} do không có hình ảnh/video.`);
            continue;
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
