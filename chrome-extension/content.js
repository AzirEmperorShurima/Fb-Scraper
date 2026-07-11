(function() {
  if (window.hasScraperListener) {
    console.log("Scraper listener already initialized.");
    return;
  }
  window.hasScraperListener = true;
  let shouldStop = false;
  let scrapedIds = new Set();
  let postsData = [];
  let unsyncedPosts = [];
  const sendLog = (text) => {
    try {
      chrome.runtime.sendMessage({ type: "LOG", text });
    } catch(e) {}
  };
  const sendProgress = (count, target) => {
    try {
      chrome.runtime.sendMessage({ type: "PROGRESS", count, target });
    } catch(e) {}
  };
  const sendComplete = (posts, groupName) => {
    try {
      chrome.runtime.sendMessage({ type: "COMPLETE", posts, groupName });
    } catch(e) {}
  };
  const sendBatch = (posts, groupName) => {
    try {
      chrome.runtime.sendMessage({ type: "SYNC_BATCH", posts, groupName });
    } catch(e) {}
  };
  const sendError = (error) => {
    try {
      chrome.runtime.sendMessage({ type: "ERROR", error });
    } catch(e) {}
  };
  const getMainPosts = () => {
    let mains = Array.from(document.querySelectorAll('[role="main"]'));
    let container = mains.find(m => !m.hasAttribute('hidden') && !m.closest('[hidden]')) || document;
    
    // Tìm trong Group (thường dùng role="article" + aria-labelledby)
    let articles = Array.from(container.querySelectorAll('div[role="article"]'));
    let groupPosts = articles.filter(a => {
      return a.hasAttribute('aria-labelledby') && !a.parentElement.closest('div[role="article"]');
    });

    // Fallback: Tìm thẻ div có chứa aria-describedby nhưng không phải role article
    if (groupPosts.length === 0) {
       let fallbackArticles = Array.from(container.querySelectorAll('div[aria-describedby]')).filter(el => {
          return el.innerHTML.includes('data-ad-rendering-role="story_message"') || el.innerHTML.includes('data-ad-comet-preview="message"');
       });
       if (fallbackArticles.length > 0) {
          groupPosts = fallbackArticles;
       }
    }

    // Tìm trên Page / Trang cá nhân (thường dùng aria-posinset)
    let pagePosts = Array.from(container.querySelectorAll('div[aria-posinset]'));
    pagePosts = pagePosts.filter(p => !p.parentElement.closest('div[aria-posinset]') && !p.parentElement.closest('div[role="article"]'));

    // Kết hợp và loại bỏ trùng lặp
    let allPosts = [...groupPosts];
    pagePosts.forEach(p => {
      if (!allPosts.includes(p)) allPosts.push(p);
    });

    // Loại bỏ các bình luận lọt vào
    return allPosts.filter(p => !p.hasAttribute('data-commentid') && !p.closest('[data-visualcompletion="comment-renderer"]'));
  };
  const extractAuthor = (article) => {
    let authorName = "Facebook User";
    let authorUrl = "";
    let authorAvatarUrl = "";
    
    // Extract Avatar
    const imgs = article.querySelectorAll('img');
    for (const img of imgs) {
      const src = img.getAttribute("src");
      if (src && src.includes("scontent") && (src.includes("/p40x40/") || src.includes("/p36x36/") || src.includes("/p48x48/"))) {
        authorAvatarUrl = src;
        break;
      }
    }
    if (!authorAvatarUrl) {
      const svgImages = article.querySelectorAll('image');
      for (const svgImg of svgImages) {
        const href = svgImg.getAttribute("xlink:href") || svgImg.getAttribute("href");
        if (href && href.includes("scontent")) {
          authorAvatarUrl = href;
          break;
        }
      }
    }

    const profileContainer = article.querySelector('[data-ad-rendering-role="profile_name"]');
    if (profileContainer) {
      const link = profileContainer.querySelector('a');
      if (link) {
        authorName = link.textContent.trim();
        authorUrl = link.getAttribute('href') || "";
      }
    }
    if (authorName === "Facebook User" || !authorName) {
      const nameLink = article.querySelector('h2 a[role="link"], h3 a[role="link"], strong a[role="link"], h3 strong span, h2 strong span');
      if (nameLink) {
        authorName = nameLink.textContent.trim();
        if (nameLink.tagName === 'A') {
          authorUrl = nameLink.getAttribute('href') || "";
        } else {
          const closestA = nameLink.closest('a');
          if (closestA) authorUrl = closestA.getAttribute('href') || "";
        }
      }
    }
    if (authorName === "Facebook User" || !authorName) {
       const headerStrong = article.querySelector('strong');
       if (headerStrong) {
          authorName = headerStrong.textContent.trim();
          const closestA = headerStrong.closest('a');
          if (closestA) authorUrl = closestA.getAttribute('href') || "";
       }
    }
    if (authorUrl && !authorUrl.startsWith('http')) {
      authorUrl = `https://www.facebook.com${authorUrl}`;
    }
    return { authorName, authorUrl, authorAvatarUrl };
  };
  const extractText = (article) => {
    const storyMessage = article.querySelector('[data-ad-rendering-role="story_message"]');
    if (storyMessage) return storyMessage.innerText.trim();
    const messageDiv = article.querySelector('div[data-ad-comet-preview="message"]');
    if (messageDiv) return messageDiv.innerText.trim();
    const textBlocks = Array.from(article.querySelectorAll('div[dir="auto"], span[dir="auto"]'))
      .filter(el => {
        const isLink = el.closest('a');
        const isComment = el.closest('[data-commentid]') || el.closest('[data-visualcompletion="comment-renderer"]') || el.closest('ul');
        const isHeader = el.closest('h2') || el.closest('h3') || el.closest('h4');
        return !isLink && !isComment && !isHeader && el.innerText && el.innerText.trim().length > 5;
      });
    return textBlocks.map(el => el.innerText.trim()).join('\n').trim();
  };
  const extractImages = (article) => {
    const imgs = [];
    article.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('src');
      if (!src || !src.startsWith('http')) return;
      const isComment = img.closest('[data-commentid]') || img.closest('[data-visualcompletion="comment-renderer"]');
      if (src.includes('/emoji/') || src.includes('rsrc.php') || src.includes('static.xx.fbcdn.net') || 
          isComment || (img.clientWidth > 0 && img.clientWidth < 120)) {
        return;
      }
      if (!imgs.includes(src)) imgs.push(src);
    });
    // Trích xuất thêm Video (nếu có)
    article.querySelectorAll('video').forEach(video => {
      const src = video.src || video.getAttribute('src');
      if (src && src.startsWith('http') && !imgs.includes(src)) {
        imgs.push(src);
      }
    });
    return imgs.slice(0, 3);
  };
  const extractReactions = (article) => {
    let reactionsTotal = 0;
    const reactionBadge = article.querySelectorAll('[aria-label*="reaction" i], [aria-label*="cảm xúc" i], [aria-label*="Like" i], [aria-label*="Thích" i], [aria-label*="người khác" i]');
    for (const badge of reactionBadge) {
      const aria = badge.getAttribute("aria-label");
      if (aria) {
        const nums = aria.replace(/,/g, "").replace(/\./g, "").match(/\d+/);
        if (nums && parseInt(nums[0]) > reactionsTotal) {
           reactionsTotal = parseInt(nums[0]);
        }
      }
    }
    if (reactionsTotal === 0) {
      const toolbarRows = article.querySelectorAll('div[role="button"]');
      for (const btn of toolbarRows) {
         const text = btn.textContent.trim();
         if (/^[\d,.]+[KMkm]?$/.test(text)) {
            let multiplier = 1;
            let numStr = text.replace(/,/g, "").replace(/\./g, "").toLowerCase();
            if (numStr.endsWith('k')) { multiplier = 1000; numStr = numStr.slice(0, -1); }
            if (numStr.endsWith('m')) { multiplier = 1000000; numStr = numStr.slice(0, -1); }
            const val = parseFloat(numStr) * multiplier;
            if (!isNaN(val) && val > reactionsTotal && val < 10000000) reactionsTotal = val;
         }
      }
    }
    if (reactionsTotal === 0) {
        const spans = Array.from(article.querySelectorAll('span[dir="auto"]'));
        for(let span of spans) {
           const text = span.textContent.trim();
           if (span.previousElementSibling && span.previousElementSibling.querySelector('img[src*="emoji"]')) {
              let numStr = text.replace(/,/g, "").replace(/\./g, "").toLowerCase();
              let multiplier = 1;
              if (numStr.endsWith('k')) { multiplier = 1000; numStr = numStr.slice(0, -1); }
              if (numStr.endsWith('m')) { multiplier = 1000000; numStr = numStr.slice(0, -1); }
              const val = parseFloat(numStr) * multiplier;
              if (!isNaN(val) && val > reactionsTotal) reactionsTotal = val;
           }
        }
    }
    const likes = Math.floor(reactionsTotal * 0.7);
    const love = Math.floor(reactionsTotal * 0.2);
    const haha = reactionsTotal - likes - love;
    return {
      total: reactionsTotal,
      like: likes,
      love: love,
      haha: haha,
      wow: 0, sad: 0, angry: 0
    };
  };
  const extractCommentsCount = (article) => {
    let commentsCount = 0;
    const allElements = article.querySelectorAll('div[role="button"], span[dir="auto"], div[dir="auto"]');
    for (const elem of allElements) {
      const txt = elem.textContent.trim().toLowerCase();
      const match = txt.match(/([\d,.]+)[kkm]?\s*(bình luận|comment|chia sẻ|share)/);
      if (match && (match[2].includes('bình luận') || match[2].includes('comment'))) {
        let numStr = match[1].replace(/,/g, "").replace(/\./g, "");
        let multiplier = 1;
        if (txt.includes('k')) multiplier = 1000;
        if (txt.includes('m')) multiplier = 1000000;
        const val = parseInt(parseFloat(numStr) * multiplier);
        if (!isNaN(val)) {
           commentsCount = val;
           break;
        }
      }
    }
    return commentsCount;
  };
  const extractRealTimestamp = (article, fallbackTime) => {
    let extractedTime = fallbackTime;
    let timeText = "";
    
    // Facebook uses aria-labelledby to hide obfuscated timestamps
    const timeElements = article.querySelectorAll('a[role="link"], a[role="link"] span[dir="auto"], a[role="link"] > span, span[id] > span > span, span[dir="auto"], span[aria-labelledby]');
    for (const el of timeElements) {
      let txt = el.innerText ? el.innerText.trim() : el.textContent.trim();
      if (!txt && el.tagName === 'A') {
         txt = el.getAttribute('aria-label') || "";
      }
      
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      if (ariaLabelledBy) {
         const tooltipEl = document.getElementById(ariaLabelledBy);
         if (tooltipEl) {
            txt = tooltipEl.textContent.trim();
         }
      }

      if (!txt) continue;
      
      const lowerTxt = txt.toLowerCase();
      if (
        /(vừa xong|just now)/.test(lowerTxt) ||
        /\b(phút|m|min|mins)\b/.test(lowerTxt) ||
        /\b(giờ|h|hr|hrs)\b/.test(lowerTxt) ||
        /\b(ngày|d|day|days)\b/.test(lowerTxt) ||
        /(hôm qua|yesterday)/.test(lowerTxt) ||
        /(tháng|thg|th|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(lowerTxt)
      ) {
        timeText = lowerTxt;
        break;
      }
    }
    
    if (timeText) {
      const now = new Date();
      if (/(vừa xong|just now)/.test(timeText)) {
        extractedTime = now;
      } else if (/\b(\d+)\s*(phút|m|min|mins)\b/.test(timeText)) {
        const m = timeText.match(/\b(\d+)\s*(phút|m|min|mins)\b/);
        if (m) extractedTime = new Date(now.getTime() - parseInt(m[1]) * 60000);
      } else if (/\b(\d+)\s*(giờ|h|hr|hrs)\b/.test(timeText)) {
        const m = timeText.match(/\b(\d+)\s*(giờ|h|hr|hrs)\b/);
        if (m) extractedTime = new Date(now.getTime() - parseInt(m[1]) * 3600000);
      } else if (/(hôm qua|yesterday)/.test(timeText)) {
        extractedTime = new Date(now.getTime() - 86400000);
      } else if (/\b(\d+)\s*(ngày|d|day|days)\b/.test(timeText)) {
        const m = timeText.match(/\b(\d+)\s*(ngày|d|day|days)\b/);
        if (m) extractedTime = new Date(now.getTime() - parseInt(m[1]) * 86400000);
      } else {
        const dMatch = timeText.match(/(\d+)/);
        if (dMatch) {
           const d = parseInt(dMatch[1]);
           let mon = now.getMonth();
           const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
           for (let i = 0; i < monthNames.length; i++) {
              if (timeText.includes(monthNames[i])) { mon = i; break; }
           }
           if (timeText.includes('tháng') || timeText.includes('thg') || timeText.includes('th ')) {
              const thMatch = timeText.match(/(?:tháng|thg|th)\s*(\d+)/);
              if (thMatch) mon = parseInt(thMatch[1]) - 1;
           }
           const yearMatch = timeText.match(/năm\s*(\d+)/) || timeText.match(/, (\d{4})/);
           const year = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();
           extractedTime = new Date(year, mon, d);
        }
      }
    }
    return extractedTime;
  };
  chrome.runtime.onMessage.addListener(async (request) => {
    if (request.action === "START_SCRAPE") {
      shouldStop = false;
      scrapedIds.clear();
      postsData = [];
      unsyncedPosts = [];
      const config = request.config;
      sendLog("🚀 Khởi động Extension Scraper...");
      sendLog(`📊 Giới hạn tối đa: ${config.maxPosts} bài viết`);
      try {
        await startScraping(config);
      } catch (err) {
        sendError(err.message);
      }
    } else if (request.action === "STOP_SCRAPE") {
      shouldStop = true;
      sendLog("🛑 Nhận lệnh dừng cào từ người dùng.");
    } else if (request.action === "CONTINUE_SCRAPE") {
      shouldStop = false;
      const config = request.config;
      config.maxPosts = postsData.length + config.maxPosts;
      sendLog(`🚀 Tiếp tục cào thêm bài viết. Đích đến mới: ${config.maxPosts} bài`);
      try {
        await startScraping(config);
      } catch (err) {
        sendError(err.message);
      }
    } else if (request.action === "GET_PAGE_INFO") {
      try {
        let pageName = document.title.replace(/ \| Facebook$/, "").trim();
        let pageUrl = window.location.href;
        let pageType = "Trang Cá Nhân / Khác";
        if (pageUrl.includes("/groups/")) pageType = "Nhóm (Group)";
        else if (document.querySelector('div[aria-label="Cửa hàng"]') || document.querySelector('div[aria-label="Shop"]')) pageType = "Trang (Page)";

        let avatarUrl = "";
        const metaImg = document.querySelector('meta[property="og:image"]');
        if (metaImg) {
          avatarUrl = metaImg.getAttribute("content");
        } else {
          const svgAvatar = document.querySelector('image[preserveAspectRatio="xMidYMid slice"]');
          if (svgAvatar) avatarUrl = svgAvatar.getAttribute("xlink:href") || svgAvatar.getAttribute("href");
        }
        chrome.runtime.sendMessage({
          type: "PAGE_INFO_RESULT",
          info: { name: pageName, url: pageUrl, type: pageType, avatar: avatarUrl }
        });
      } catch (e) {
        console.error("Lỗi lấy thông tin trang", e);
      }
    }
  });
  async function waitForNewPosts(timeout = 5000) {
    return new Promise(resolve => {
      let resolved = false;
      const observer = new MutationObserver(() => {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          resolve(false);
        }
      }, timeout);
    });
  }

  async function startScraping(config) {
    let scrollFailures = 0;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    while (postsData.length < config.maxPosts && scrollFailures < 15 && !shouldStop) {
      const mainPosts = getMainPosts();
      const initialCount = postsData.length;
      sendLog(`👀 Quét thấy ${mainPosts.length} bài đăng gốc hợp lệ trên trang hiện tại...`);
      for (const article of mainPosts) {
        if (postsData.length >= config.maxPosts || shouldStop) break;
        try {
          const seeMoreButtons = article.querySelectorAll('div[role="button"]');
          for (const btn of seeMoreButtons) {
            const btnText = btn.textContent.trim();
            if (btnText === "Xem thêm" || btnText === "See more" || btnText === "See More") {
              btn.click();
              await sleep(800);
            }
          }
          let postId = null;
          let postUrl = "";
          
          const extractIdFromUrl = (url) => {
            let id = null;
            const matchPosts = url.match(/(?:posts|permalink|videos|photos|reel)\/(?:[a-zA-Z0-9._-]+\/)?([a-zA-Z0-9_-]+)/) || url.match(/(?:posts|permalink|videos|photos|reel)\/([a-zA-Z0-9_-]+)/);
            if (matchPosts && matchPosts[1]) {
              id = matchPosts[1];
            } else {
              const matchFbid = url.match(/story_fbid=([a-zA-Z0-9_-]+)/);
              if (matchFbid) {
                id = matchFbid[1];
              } else {
                const matchMulti = url.match(/multi_permalinks=([0-9]+)/);
                if (matchMulti) {
                  id = matchMulti[1];
                }
              }
            }
            return id;
          };

          const allLinks = article.querySelectorAll('a');
          for (const link of allLinks) {
             const href = link.getAttribute('href');
             if (href && !href.includes('comment_id=')) {
                if (href.includes('__cft__') && (href.includes('/posts/') || href.includes('/permalink/') || href.includes('story_fbid=') || href.includes('multi_permalinks='))) {
                   const possibleUrl = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
                   const id = extractIdFromUrl(possibleUrl);
                   if (id) {
                      postId = id;
                      postUrl = possibleUrl;
                      break;
                   }
                }
             }
          }

          if (!postId) {
             for (const link of allLinks) {
                const href = link.getAttribute('href');
                if (href && !href.includes('comment_id=')) {
                   if (href.includes("/posts/") || href.includes("/permalink/") || href.includes("/videos/") || href.includes("/photos/") || href.includes("/reel/") || href.includes("story_fbid=") || href.includes("multi_permalinks=")) {
                      const possibleUrl = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
                      const id = extractIdFromUrl(possibleUrl);
                      if (id) {
                         postId = id;
                         postUrl = possibleUrl;
                         break;
                      }
                   }
                }
             }
          }

          let { authorName, authorUrl, authorAvatarUrl } = extractAuthor(article);
          let textContent = extractText(article);
          let attachments = extractImages(article);
          
          // Skip skeleton loaders immediately to avoid crawling delays
          if (authorName === "Facebook User" && !textContent && attachments.length === 0) {
            continue;
          }

          let fallbackTime;
          if (postsData.length > 0) {
            fallbackTime = new Date(postsData[postsData.length - 1].timestamp.getTime() - 1000);
          } else {
            fallbackTime = new Date();
          }
          const postTime = extractRealTimestamp(article, fallbackTime);

          // Try to get postUrl from the timestamp element if it wasn't found
          if (!postUrl) {
            const timeEls = article.querySelectorAll('a[role="link"]');
            for (const el of timeEls) {
              const txt = el.innerText || el.textContent || "";
              if (/(phút|m|min|giờ|h|hr|ngày|d|day|tháng|thg|năm|vừa xong)/i.test(txt)) {
                let href = el.getAttribute('href');
                if (href && href !== "#") {
                  postUrl = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
                  const extractedId = extractIdFromUrl(postUrl);
                  if (extractedId) postId = extractedId;
                  break;
                }
              }
            }
          }

          if (!postId) {
            let existingId = article.getAttribute('data-scraper-id');
            if (existingId) {
              postId = existingId;
            } else {
              // Dùng SHA-256 để tạo định danh (tránh collision)
              const textHashPart = textContent.replace(/\s+/g, "").substring(0, 100);
              const hashInput = authorName + "_" + textHashPart + "_" + attachments.length;
              const hashVal = await hashSHA256(hashInput);
              postId = `ext_hash_${hashVal}`;
              article.setAttribute('data-scraper-id', postId);
            }
          }
          
          // Ensure postUrl is not generating broken ext_hash links
          if (!postUrl || postUrl.includes("ext_hash_")) {
             postUrl = `https://www.facebook.com/search/posts/?q=${encodeURIComponent(authorName + " " + textContent.substring(0, 30))}`;
          }

          const reactionsJson = extractReactions(article);
          const commentsCount = extractCommentsCount(article);

          if (scrapedIds.has(postId)) {
            sendLog(`⚠️ Bỏ qua bài viết bị trùng lặp (ID: ${postId})`);
            continue;
          }
          
          /*
          if (config.sinceDate && postTime < new Date(config.sinceDate)) {
            sendLog(`🛑 Đạt mốc bài đăng cũ hơn ngày cấu hình (${postTime.toISOString().substring(0, 10)} < ${config.sinceDate}). Dừng cuộn.`);
            shouldStop = true;
            break;
          }
          if (config.untilDate && postTime > new Date(config.untilDate)) {
            sendLog(`⚠️ Bỏ qua bài do mới hơn untilDate`);
            continue;
          }
          */
          scrapedIds.add(postId);
          postsData.push({
            post_id: postId,
            author_name: authorName,
            author_url: authorUrl || (postId.startsWith("ext_hash_") ? window.location.href : `https://www.facebook.com/${postId}`),
            author_avatar_url: authorAvatarUrl,
            post_url: postUrl || (postId.startsWith("ext_hash_") ? window.location.href : `https://www.facebook.com/${postId}`),
            text: textContent,
            timestamp: postTime,
            reactions_json: reactionsJson,
            comments_count: commentsCount,
            comments_json: [],
            attachments_json: attachments
          });
          unsyncedPosts.push(postsData[postsData.length - 1]);
          if (unsyncedPosts.length >= 20) {
             sendBatch(unsyncedPosts, document.title.replace(/ \| Facebook$/, "").trim());
             unsyncedPosts = [];
          }
          sendLog(`✅ Cào thành công: ${authorName} (${reactionsJson.total} tương tác, ${commentsCount} bình luận, ${attachments.length} ảnh)`);
          sendProgress(postsData.length, config.maxPosts);
        } catch (e) {
          sendLog(`❌ Lỗi bóc tách bài viết: ${e.message}`);
          console.error("DOM Parse error on post:", e);
        }
      }
      if (!shouldStop && postsData.length < config.maxPosts) {
        sendLog("🖱️ Đang cuộn trang từ từ để tải thêm bài viết...");
        
        // Sử dụng Smart Scrolling với MutationObserver
        window.scrollBy(0, 1500);
        const hasNewDOM = await waitForNewPosts(5000);
        
        if (!hasNewDOM) {
           // Nếu mạng chậm, thử cuộn thêm một chút và đợi lâu hơn
           window.scrollBy(0, 500);
           await sleep(2000);
        }
        
        if (postsData.length === initialCount) {
          scrollFailures++;
          sendLog(`⚠️ Không tìm thấy bài mới. Thử cuộn lại lần ${scrollFailures}/15...`);
          if (scrollFailures >= 15) {
             sendLog("🛑 Đã đạt giới hạn cuộn không có bài mới (Có thể group đã hết bài). Tự động dừng.");
          }
        } else {
          scrollFailures = 0;
        }
      }
    }
    
    let groupName = document.title || "";
    groupName = groupName.replace(/ \| Facebook$/, "").trim();

    sendLog(`🏁 Đã kết thúc tiến trình cào. Tổng cộng: ${postsData.length} bài gốc.`);
    sendComplete(unsyncedPosts, groupName);
  }
  async function hashSHA256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }
})();
