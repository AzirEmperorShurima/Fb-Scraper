# Phân Tích Kiến Trúc: Privacy Player & Adblock

Dưới đây là tổng hợp phân tích chi tiết về kiến trúc, luồng hoạt động, công nghệ và thuật toán của 2 module quan trọng nhất trong extension: **Privacy Player** và **Adblock**.

---

## 1. Privacy Player

### 1.1. Kiến Trúc (Architecture) & Công Nghệ
Privacy Player là một trình phát và duyệt web an toàn được nhúng trực tiếp bên trong Popup của Extension hoặc SidePanel.
- **Thành phần UI (`popup.html` & `popup.js`)**: Sử dụng thẻ `<iframe>` (ID: `privacyPlayerFrame`) để tải trang web mục tiêu. Giao diện được thiết kế linh hoạt với khả năng thay đổi kích thước, hình nền và tích hợp các nút điều khiển (Theater mode, PiP, Back/Forward).
- **Trình điều khiển nội dung (`iframe_content_script.js`)**: Một content script đặc biệt được tiêm vào bên trong iframe (hoặc tương tác thông qua `postMessage` / `chrome.runtime.sendMessage`) để kiểm soát hành vi của trang web (click link, popup quảng cáo, video player).
- **Bảo mật & Ẩn danh (`background.js`)**: Sử dụng API `chrome.webRequest` hoặc `chrome.declarativeNetRequest` để can thiệp vào HTTP Headers. Đặc biệt tính năng **Isolated Identity (Stateless)** sẽ chặn hoặc xóa header `Cookie` và `Set-Cookie`, ngăn trang web theo dõi tài khoản của người dùng.

### 1.2. Luồng Hoạt Động (Workflow)
1. **Khởi tạo**: Người dùng nhập URL hoặc mở từ Vault. Popup gán URL vào thuộc tính `src` của iframe.
2. **Tiêm Script**: `iframe_content_script.js` bắt đầu hoạt động, ghi đè (override) các hành vi mặc định như `window.open` và bắt sự kiện `click` trên các thẻ `<a>`.
3. **Cách ly dữ liệu**: Mọi request đi ra từ iframe đều được `background.js` giám sát. Nếu bật Isolated Identity, cookie bị gỡ bỏ trước khi request đến server.

### 1.3. Trích xuất Code Cốt Lõi: Link Click Behavior & Applied Link Type
Cốt lõi thuật toán chặn và điều hướng link (Link Click Behavior) nằm ở việc sử dụng Event Delegation để bắt mọi cú click vào thẻ `<a>` bên trong iframe, sau đó kiểm tra thuộc tính `target` và cấu hình người dùng để quyết định hành động.

```javascript
// Trích xuất từ: iframe_content_script.js (Sự kiện bắt Click)
document.addEventListener('click', function(event) {
    let target = event.target;
    while (target && target.tagName !== 'A') {
        target = target.parentNode;
    }
    
    if (target && target.href) {
        const finalUrl = target.href;
        if (!finalUrl.startsWith('http')) return;

        // Kiểm tra xem link có bắt buộc mở tab mới hay không
        const requiresNewTab = target.target === '_blank' ||
            event.ctrlKey || event.metaKey ||
            event.shiftKey || event.button === 1;

        // Lấy cấu hình từ Settings
        let behavior = settings.playerLinkBehavior; // 'inside' | 'newTab' | 'incognito' | 'block'
        let filter = settings.playerLinkFilter;     // 'all' | 'newTabOnly'

        // Ngoại lệ: Thuật toán tự động (Ví dụ với Cốc Cốc Search)
        const hostname = window.location.hostname;
        if (hostname.includes('coccoc.com')) {
            behavior = 'inside';
            filter = 'all';
        }

        // Applied Link Type logic
        const shouldApply = (filter === 'all') || requiresNewTab;
        if (!shouldApply) return;

        // Link Click Behavior logic
        event.preventDefault();
        event.stopPropagation();

        if (behavior === 'block') {
            chrome.runtime.sendMessage({ type: 'privacyPlayerLinkClicked', action: 'block', url: finalUrl });
            return;
        } else if (behavior === 'newTab') {
            chrome.runtime.sendMessage({ type: 'privacyPlayerLinkClicked', action: 'newTab', url: finalUrl });
            return;
        } else if (behavior === 'incognito') {
            chrome.runtime.sendMessage({ type: 'privacyPlayerLinkClicked', action: 'incognito', url: finalUrl });
            return;
        }

        // Mặc định behavior === 'inside': Chuyển hướng ngay trong iframe hiện tại
        window.location.href = finalUrl;
    }
}, true); // Sử dụng capture phase để đảm bảo bắt sự kiện sớm nhất
```

Đồng thời, ở `background.js`, các tab mới sinh ra từ Popup (sourceTabId = -1) cũng bị giám sát:

```javascript
// Trích xuất từ: background.js (Xử lý các tab mới lọt ra ngoài)
chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    // sourceTabId -1 indicates creation from extension popup/iframe
    if (details.sourceTabId === -1) {
        chrome.storage.local.get(['appSettings'], (result) => {
            const settings = result.appSettings || {};
            // Nếu cấu hình là mở ẩn danh, hệ thống sẽ tự động đóng tab thường và mở tab ẩn danh mới
            if (settings.playerLinkBehavior === 'incognito') {
                chrome.extension.isAllowedIncognitoAccess((isAllowed) => {
                    if (isAllowed) {
                        chrome.tabs.remove(details.tabId); // Đóng tab vừa lọt ra
                        chrome.windows.create({ url: details.url, incognito: true });
                    }
                });
            }
        });
    }
});
```

---

## 2. Adblock (Trình Chặn Quảng Cáo)

### 2.1. Kiến Trúc & Công Nghệ
Hệ thống Adblock không sử dụng content scripts để chặn bằng JS (dễ gây chậm trang) mà sử dụng công nghệ tiên tiến nhất của Chrome: **Declarative Net Request (DNR) API**.
- **`modules/adblock.js`**: Module điều khiển giao diện, nơi người dùng quản lý bộ lọc (EasyList, custom rules, CSS rules).
- **`background.js`**: Đóng vai trò làm "trạm gác". Nó nhận lệnh từ `adblock.js` và gọi hàm `chrome.declarativeNetRequest.updateDynamicRules` để áp dụng luật chặn ngay ở mức network.
- **Tối ưu hiệu năng**: Bằng cách sử dụng DNR, Extension giao phó việc so khớp chuỗi Regex URL cho chính lõi C++ của trình duyệt Chrome, giúp chặn quảng cáo nhanh, không tốn CPU và bảo mật cao (Extensions không cần quyền đọc mọi gói tin).

### 2.2. Luồng Hoạt Động & Thuật Toán
1. **Nạp & Phân Tích (Parsing)**: Khi người dùng bật EasyList hoặc nhập luật chặn riêng, thuật toán sẽ parse (phân tích) cú pháp chặn truyền thống (giống Adblock Plus / uBlock) sang định dạng JSON khắt khe của DNR.
2. **Áp dụng luật (Applying Rules)**:
   - Các tên miền tracker bị gán Rule có cấu trúc: `{ "action": { "type": "block" }, "condition": { "urlFilter": "||ads.example.com", "resourceTypes": ["script", "image"] } }`.
   - Các rule này được đẩy vào nhóm `DynamicRules`. Trình duyệt sẽ tự động ngắt kết nối (`net::ERR_BLOCKED_BY_CLIENT`) khi phát hiện truy vấn khớp với `urlFilter`.
3. **Visual Element Zapper**: Đối với quảng cáo rác không chặn được bằng Network, extension sử dụng **CSS Injection** (`chrome.scripting.insertCSS`). Module `zapper-content.js` hỗ trợ click chọn phần tử DOM, tạo chuỗi CSS Selector độc nhất và ép kiểu `display: none !important;`. Mọi luật CSS này được lưu vào `chrome.storage.local` và tái áp dụng cho lần truy cập sau.
