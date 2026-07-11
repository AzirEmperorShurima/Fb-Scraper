# Tài liệu Thuật toán Cào Dữ liệu (Scraping), Chống Phát hiện (Anti-Detect) & Tạo Định danh (Fingerprint)

Dưới đây là chiết xuất chi tiết về các logic và thuật toán chính đang được sử dụng trong hệ thống FBGroupScraper Pro (cả phiên bản Extension và Backend Node.js).

## 1. Thuật toán Chống Phát hiện (Anti-Detect & Stealth)

Để tránh bị Facebook khóa tài khoản (Checkpoint) hoặc chặn (Block) do phát hiện bot, hệ thống sử dụng kết hợp nhiều lớp bảo vệ ở tầng trình duyệt.

### 1.1. Cấu hình Playwright Stealth (Backend)
Backend sử dụng `playwright-extra` kết hợp với `puppeteer-extra-plugin-stealth` nhằm ngụy trang các API tự động hóa của trình duyệt (ví dụ như ẩn cờ `navigator.webdriver = true`).

```javascript
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";

// Kích hoạt Stealth Plugin
chromium.use(stealthPlugin());

const browser = await chromium.launch({
  headless: false, // Thường để false để mô phỏng giống người dùng thật hơn
  args: [
    "--disable-notifications", // Chặn popup thông báo
    "--disable-blink-features=AutomationControlled", // Vô hiệu hóa cờ Automation
    "--no-sandbox",
    "--disable-setuid-sandbox"
  ]
});
```

### 1.2. Kỹ thuật "Human-like Behavior" (Hành vi người dùng)
Trong quá trình cào (ở cả Extension và Backend), hệ thống không cuộn (scroll) trang web xuống tận đáy ngay lập tức mà chia thành các bước nhỏ, kèm theo thời gian chờ (delay) ngẫu nhiên.

```javascript
// Cuộn trang từ từ để Facebook có thời gian load và không bị đánh dấu là bot
for (let i = 0; i < 6; i++) {
    window.scrollBy(0, 500); // Mỗi lần cuộn 500px
    await sleep(500); // Dừng nửa giây
}
// Chờ một khoảng ngẫu nhiên từ 2 đến 3 giây trước chu kỳ tiếp theo
await sleep(2000 + Math.random() * 1000); 
```

## 2. Thuật toán Tạo Định danh (Post Fingerprinting)

Một vấn đề lớn khi cào Facebook là các bài viết thường không lộ URL hoặc ID rõ ràng (do Facebook mã hóa hoặc giấu đi trong bóng tối). Để tránh cào trùng lặp một bài viết, hệ thống sử dụng thuật toán **Hash (Băm) Nhận diện**.

```javascript
// Hàm băm chuỗi thành số nguyên (Java-like hash)
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Logic tạo ID (Fingerprint) cho bài viết
let postId = extractIdFromUrl(postUrl); // Thử lấy ID gốc từ thẻ <a>

if (!postId) {
  // Nếu không tìm thấy URL, tạo ID bằng nội dung đặc trưng
  // Dùng 30 ký tự đầu tiên (loại bỏ khoảng trắng) để hash
  const textHashPart = textContent.replace(/\s+/g, "").substring(0, 30);
  
  // Công thức: Tên tác giả + Nội dung + Số lượng ảnh
  // Đảm bảo tính duy nhất cao nhưng không bị thay đổi nếu bài viết bị chỉnh sửa phần đuôi
  postId = `ext_hash_${hashCode(authorName + "_" + textHashPart + "_" + attachments.length)}`;
}
```

## 3. Thuật toán Bóc tách Dữ liệu (DOM Parsing)

Bóc tách dữ liệu sử dụng các Query Selectors linh hoạt, bởi vì Facebook dùng các class CSS sinh tự động, việc dựa vào class (như `.x1y12z...`) sẽ hỏng ngay khi FB cập nhật. Thay vào đó, hệ thống tìm qua `role`, `aria-label`, `dir="auto"`.

### 3.1. Tìm bài viết chính (Main Posts)
```javascript
const getMainPosts = () => {
  // Tìm khung role="main" không bị ẩn
  let container = document.querySelectorAll('[role="main"]');
  
  // Lấy các bài viết trong Group
  let groupPosts = Array.from(container.querySelectorAll('div[role="article"]')).filter(a => {
    return a.hasAttribute('aria-labelledby') && !a.parentElement.closest('div[role="article"]');
  });

  // Lấy bài trên Page / Cá nhân
  let pagePosts = Array.from(container.querySelectorAll('div[aria-posinset]')).filter(p => {
    return !p.parentElement.closest('div[aria-posinset]') && !p.parentElement.closest('div[role="article"]');
  });

  // Kết hợp, sau đó loại bỏ các "bình luận" bị dính lẫn vào (comment-renderer)
  return [...groupPosts, ...pagePosts].filter(p => !p.hasAttribute('data-commentid') && !p.closest('[data-visualcompletion="comment-renderer"]'));
};
```

### 3.2. Bóc tách Tương tác (Reactions)
Facebook ẩn số liệu thực và chuyển thành dạng viết tắt (VD: "1,2K"). Thuật toán phải quét qua toàn bộ text và aria-label.

```javascript
const extractReactions = (article) => {
  let reactionsTotal = 0;
  // Cách 1: Tìm qua aria-label (icon cảm xúc)
  const reactionBadge = article.querySelectorAll('[aria-label*="reaction" i], [aria-label*="cảm xúc" i], [aria-label*="Like" i]');
  for (const badge of reactionBadge) {
    const nums = badge.getAttribute("aria-label").replace(/,/g, "").replace(/\./g, "").match(/\d+/);
    if (nums && parseInt(nums[0]) > reactionsTotal) reactionsTotal = parseInt(nums[0]);
  }

  // Cách 2: Tìm qua Text Content và xử lý số K/M
  if (reactionsTotal === 0) {
    const toolbarRows = article.querySelectorAll('div[role="button"]');
    for (const btn of toolbarRows) {
      let text = btn.textContent.trim().toLowerCase();
      if (/^[\d,.]+[km]?$/.test(text)) {
        let multiplier = 1;
        if (text.endsWith('k')) { multiplier = 1000; text = text.slice(0, -1); }
        if (text.endsWith('m')) { multiplier = 1000000; text = text.slice(0, -1); }
        let val = parseFloat(text) * multiplier;
        if (!isNaN(val) && val > reactionsTotal) reactionsTotal = val;
      }
    }
  }
  // Giả lập tỷ lệ Reaction (nếu không lấy được chi tiết từng loại)
  return { total: reactionsTotal, like: Math.floor(reactionsTotal * 0.7), love: Math.floor(reactionsTotal * 0.2) };
};
```

### 3.3. Dịch thời gian Thời gian thực (Timestamp Extraction)
Các bài viết hiển thị "Vừa xong", "5 phút", "Hôm qua". Thuật toán phải dịch chúng về `Date` object chuẩn.

```javascript
const extractRealTimestamp = (article, fallbackTime) => {
  let extractedTime = fallbackTime;
  const timeElements = article.querySelectorAll('a[role="link"], span[dir="auto"], span[aria-labelledby]');
  
  for (const el of timeElements) {
    // Tìm aria-labelledby Tooltip (nơi FB hay giấu thời gian cụ thể)
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    let txt = ariaLabelledBy ? document.getElementById(ariaLabelledBy)?.textContent : el.textContent;
    if (!txt) continue;
    
    txt = txt.toLowerCase();
    const now = new Date();
    
    if (/(vừa xong|just now)/.test(txt)) {
      extractedTime = now;
    } else if (/\b(\d+)\s*(phút|m|min|mins)\b/.test(txt)) {
      const m = txt.match(/\b(\d+)\s*(phút|m|min|mins)\b/);
      if (m) extractedTime = new Date(now.getTime() - parseInt(m[1]) * 60000);
    } else if (/\b(\d+)\s*(giờ|h|hr|hrs)\b/.test(txt)) {
      const m = txt.match(/\b(\d+)\s*(giờ|h|hr|hrs)\b/);
      if (m) extractedTime = new Date(now.getTime() - parseInt(m[1]) * 3600000);
    } else if (/(hôm qua|yesterday)/.test(txt)) {
      extractedTime = new Date(now.getTime() - 86400000);
    }
  }
  return extractedTime;
};
```
