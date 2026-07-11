let scrapedPosts = [];
let groupUrl = "";
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const setupForm = document.getElementById("setupForm");
  const progressSection = document.getElementById("progressSection");
  const consoleDiv = document.getElementById("console");
  const statusText = document.getElementById("statusText");
  const resultActions = document.getElementById("resultActions");
  const downloadJsonBtn = document.getElementById("downloadJsonBtn");
  const downloadCsvBtn = document.getElementById("downloadCsvBtn");
  const syncBtn = document.getElementById("syncBtn");
  const continueBtn = document.getElementById("continueBtn");

  const authSection = document.getElementById("authSection");
  const logoutBtn = document.getElementById("logoutBtn");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authError = document.getElementById("authError");
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");

  let authToken = null;

  async function checkAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["access_token"], async (result) => {
        if (result.access_token) {
          const serverUrl = document.getElementById("serverUrl").value || "http://localhost:8080";
          try {
            const response = await fetch(`${serverUrl}/api/auth/me`, {
              headers: { "Authorization": `Bearer ${result.access_token}` }
            });
            if (response.ok) {
              const userData = await response.json();
              authToken = result.access_token;
              authSection.classList.add("hidden");
              const tabsNav = document.getElementById("tabsNav");
              if (tabsNav) tabsNav.classList.remove("hidden");
              setupForm.classList.remove("hidden");
              
              const campaignsContainer = document.getElementById("campaignsContainer");
              if (campaignsContainer) campaignsContainer.style.display = "block";
              
              loadCampaigns(authToken, serverUrl);
              
              const userInfoBlock = document.getElementById("userInfoBlock");
              const userEmailDisplay = document.getElementById("userEmailDisplay");
              if (userInfoBlock && userEmailDisplay) {
                userInfoBlock.classList.remove("hidden");
                userEmailDisplay.innerText = userData.email || userData.name || "User";
                userEmailDisplay.title = userData.email || userData.name || "User";
              }

              if (userData.gsheet_webhook) {
                const gsheetInput = document.getElementById("gsheetWebhook");
                if (gsheetInput) {
                  gsheetInput.value = userData.gsheet_webhook;
                }
              }
              
              resolve(true);
              return;
            }
          } catch (e) {}
        }
        chrome.storage.local.remove(["access_token"]);
        authSection.classList.remove("hidden");
        setupForm.classList.add("hidden");
        const tabsNav = document.getElementById("tabsNav");
        if (tabsNav) tabsNav.classList.add("hidden");
        const campaignsContainer = document.getElementById("campaignsContainer");
        if (campaignsContainer) campaignsContainer.style.display = "none";
        const userInfoBlock = document.getElementById("userInfoBlock");
        if (userInfoBlock) userInfoBlock.classList.add("hidden");
        resolve(false);
      });
    });
  }
  
  checkAuth();

  // Tabs Logic
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.getAttribute("data-target")).classList.add("active");
    });
  });

  document.getElementById("refreshCampaignsBtn")?.addEventListener("click", () => {
    const serverUrl = document.getElementById("serverUrl").value || "http://localhost:8080";
    if (authToken) loadCampaigns(authToken, serverUrl);
  });

  async function loadCampaigns(token, serverUrl) {
    const list = document.getElementById("campaignList");
    if (!list) return;
    list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 12px;">Đang tải...</div>`;
    try {
      const res = await fetch(`${serverUrl}/api/scripts`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const scripts = await res.json();
        list.innerHTML = "";
        if (scripts.length === 0) {
          list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 12px;">Bạn chưa có kịch bản nào. Hãy tạo trên Web App.</div>`;
          return;
        }
        scripts.forEach(script => {
          const item = document.createElement("div");
          item.className = "campaign-item";
          item.innerHTML = `
            <div class="campaign-info">
              <h4>${script.name}</h4>
              <p>${script.steps.length} bước cào</p>
            </div>
            <button class="btn-run-campaign" data-id="${script._id}">Run</button>
          `;
          list.appendChild(item);
        });

        const runBtns = list.querySelectorAll(".btn-run-campaign");
        runBtns.forEach(btn => {
          btn.addEventListener("click", () => {
            const scriptId = btn.getAttribute("data-id");
            startCampaignFromPopup(scriptId, token, serverUrl);
          });
        });
      }
    } catch (e) {
      list.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 10px;">Lỗi tải kịch bản</div>`;
    }
  }

  async function startCampaignFromPopup(scriptId, token, serverUrl) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.url.includes("facebook.com")) {
        alert("Vui lòng mở một trang Facebook để bắt đầu chạy kịch bản.");
        return;
      }
      
      try {
        const list = document.getElementById("campaignList");
        if (list) list.innerHTML = `<div style="text-align: center; color: var(--primary); padding: 20px;">Đang khởi động... Trình duyệt sẽ chuyển hướng ngay.</div>`;
        
        const res = await fetch(`${serverUrl}/api/scripts/${scriptId}/execute`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          chrome.runtime.sendMessage({
            type: "START_CAMPAIGN_FROM_POPUP",
            payload: {
              executionId: data.execution._id,
              scriptDetails: data.script,
              fbAccount: data.fbAccount,
              token: token,
              tabId: activeTab.id
            }
          });
          
          document.getElementById("tabsNav")?.classList.add("hidden");
          tabContents.forEach(c => c.classList.remove("active"));
          document.getElementById("campaignsContainer").style.display = "none";
          setupForm.classList.add("hidden");
          
          progressSection.classList.remove("hidden");
          statusText.innerText = "Đang chạy Campaign ngầm...";
          consoleDiv.innerHTML = `🚀 Chạy kịch bản: ${data.script.name}\n🔗 Tab hiện tại sẽ tự động chuyển hướng để cào. Vui lòng không đóng tab!\nLưu ý: Popup sẽ tự đóng khi tab chuyển hướng. Quá trình cào vẫn sẽ tiếp tục chạy ngầm.`;
        } else {
          const err = await res.json();
          alert("Lỗi khi tạo phiên chạy: " + err.detail);
          loadCampaigns(token, serverUrl);
        }
      } catch (e) {
        alert("Lỗi hệ thống: " + e.message);
        loadCampaigns(token, serverUrl);
      }
    });
  }

  // Fetch Page Info
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes("facebook.com")) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"]
        });
        chrome.tabs.sendMessage(tabs[0].id, { action: "GET_PAGE_INFO" }).catch(e => {
          console.warn("Could not send message to content script. It might not be injected yet.");
        });
      } catch (err) {
        console.warn("Lỗi inject content script", err);
      }
    }
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "PAGE_INFO_RESULT") {
      const info = request.info;
      const section = document.getElementById("pageInfoSection");
      if (section) {
        section.classList.remove("hidden");
        document.getElementById("pageType").innerText = info.type || "UNKNOWN";
        document.getElementById("pageName").innerText = info.name || "Unknown Target";
        const pageLink = document.getElementById("pageLink");
        pageLink.href = info.url;
        pageLink.innerText = info.url.length > 40 ? info.url.substring(0, 40) + "..." : info.url;
        if (info.avatar) {
          document.getElementById("pageAvatar").style.backgroundImage = `url('${info.avatar}')`;
        }
      }
    }
  });

  loginBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    const serverUrl = document.getElementById("serverUrl").value || "http://localhost:8080";
    if (!email || !password) { authError.innerText = "Vui lòng nhập đủ thông tin"; authError.classList.remove("hidden"); return; }
    
    loginBtn.innerText = "Đang xử lý...";
    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        chrome.storage.local.set({ access_token: data.access_token }, () => {
          authError.classList.add("hidden");
          checkAuth();
        });
      } else {
        authError.innerText = data.detail || "Sai email hoặc mật khẩu";
        authError.classList.remove("hidden");
      }
    } catch (e) {
      authError.innerText = "Không thể kết nối đến server";
      authError.classList.remove("hidden");
    }
    loginBtn.innerText = "Đăng nhập";
  });

  registerBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    const serverUrl = document.getElementById("serverUrl").value || "http://localhost:8080";
    if (!email || !password) { authError.innerText = "Vui lòng nhập đủ thông tin"; authError.classList.remove("hidden"); return; }
    
    registerBtn.innerText = "Đang xử lý...";
    try {
      const res = await fetch(`${serverUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        authError.style.color = "var(--success)";
        authError.innerText = "Đăng ký thành công! Vui lòng Đăng nhập.";
        authError.classList.remove("hidden");
      } else {
        authError.style.color = "var(--danger)";
        authError.innerText = data.detail || "Lỗi đăng ký";
        authError.classList.remove("hidden");
      }
    } catch (e) {
      authError.style.color = "var(--danger)";
      authError.innerText = "Không thể kết nối đến server";
      authError.classList.remove("hidden");
    }
    registerBtn.innerText = "Đăng ký";
  });

  const googleLoginBtn = document.getElementById("googleLoginBtn");
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => {
      googleLoginBtn.innerText = "Đang xử lý...";
      chrome.identity.getAuthToken({ interactive: true }, async function(token) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          alert("Lỗi khi đăng nhập bằng Google: " + chrome.runtime.lastError.message);
          googleLoginBtn.innerText = "Đăng nhập bằng Google";
          return;
        }
        try {
          const serverUrl = document.getElementById("serverUrl").value || "http://localhost:8080";
          const response = await fetch(`${serverUrl}/api/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token })
          });
          const data = await response.json();
          if (response.ok) {
            chrome.storage.local.set({ "access_token": data.access_token }, () => {
              authToken = data.access_token;
              checkAuth();
            });
          } else {
            alert("Lỗi từ server: " + data.detail);
          }
        } catch(e) {
          alert("Không thể kết nối Backend để verify Google Token.");
        }
        googleLoginBtn.innerText = "Đăng nhập bằng Google";
      });
    });
  }

  logoutBtn.addEventListener("click", () => {
    chrome.storage.local.remove(["access_token"], () => {
      authToken = null;
      checkAuth();
    });
  });
  startBtn.addEventListener("click", async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.url || !activeTab.url.includes("facebook.com/")) {
      alert("❌ Vui lòng mở một trang Facebook (Group, Fanpage, Profile) trước khi chạy cào!");
      return;
    }
    let pageType = "Unknown";
    if (activeTab.url.includes("/groups/")) pageType = "Group";
    else if (activeTab.url.includes("profile.php") || activeTab.url.includes("/user/")) pageType = "Profile";
    else pageType = "Fanpage/Profile";
    document.getElementById("pageTypeLabel") && (document.getElementById("pageTypeLabel").innerText = `Đang quét: ${pageType}`);
    groupUrl = activeTab.url;
    scrapedPosts = [];
    const maxPosts = parseInt(document.getElementById("maxPosts").value) || 20;
    const minReactions = parseInt(document.getElementById("minReactions").value) || 0;
    const sinceDate = document.getElementById("sinceDate").value || null;
    const untilDate = document.getElementById("untilDate").value || null;
    const keywordFilter = document.getElementById("keywordFilter").value || null;
    setupForm.classList.add("hidden");
    progressSection.classList.remove("hidden");
    resultActions.classList.add("hidden");
    consoleDiv.innerHTML = "⏳ Đang kết nối tới trang Facebook...";
    statusText.innerText = "Đang chạy...";
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["content.js"]
      });
      chrome.tabs.sendMessage(activeTab.id, {
        action: "START_SCRAPE",
        config: {
          maxPosts,
          minReactions,
          sinceDate,
          untilDate,
          keywordFilter
        }
      });
    } catch (err) {
      console.error(err);
      consoleDiv.innerHTML += `\n❌ Lỗi khởi tạo: ${err.message}. Vui lòng reload lại trang Facebook và thử lại!`;
      statusText.innerText = "Lỗi!";
    }
  });
  stopBtn.addEventListener("click", async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_SCRAPE" });
    }
    statusText.innerText = "Đã gửi lệnh dừng, đang đóng gói...";
    stopBtn.classList.add("hidden");
  });

  continueBtn.addEventListener("click", async () => {
    const maxPosts = parseInt(document.getElementById("maxPosts").value) || 20;
    const minReactions = parseInt(document.getElementById("minReactions").value) || 0;
    const sinceDate = document.getElementById("sinceDate").value;
    const untilDate = document.getElementById("untilDate").value;
    const keywordFilter = document.getElementById("keywordFilter").value.trim().toLowerCase();

    resultActions.classList.add("hidden");
    stopBtn.classList.remove("hidden");
    statusText.innerText = "Đang cào tiếp...";
    statusText.style.color = "#60a5fa";

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "CONTINUE_SCRAPE",
        config: {
          maxPosts,
          minReactions,
          sinceDate,
          untilDate,
          keywordFilter
        }
      });
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "LOG") {
      const timestamp = new Date().toLocaleTimeString();
      consoleDiv.innerHTML += `\n[${timestamp}] ${message.text}`;
      consoleDiv.scrollTop = consoleDiv.scrollHeight;
    } else if (message.type === "PROGRESS") {
      statusText.innerText = `Đang cào (${message.count}/${message.target})`;
    } else if (message.type === "COMPLETE") {
      scrapedPosts = message.posts;
      if (message.groupName) {
        window.groupNameStr = message.groupName;
      }
      statusText.innerText = "Hoàn thành!";
      statusText.style.color = "#10b981";
      consoleDiv.innerHTML += `\n\n🎉 Đã cào xong! Tổng số bài viết thu thập: ${scrapedPosts.length}`;
      consoleDiv.scrollTop = consoleDiv.scrollHeight;
      stopBtn.classList.add("hidden");
      resultActions.classList.remove("hidden");
    } else if (message.type === "ERROR") {
      statusText.innerText = "Lỗi!";
      statusText.style.color = "#ef4444";
      consoleDiv.innerHTML += `\n❌ Lỗi: ${message.error}`;
      consoleDiv.scrollTop = consoleDiv.scrollHeight;
      stopBtn.classList.add("hidden");
    }
  });
  downloadJsonBtn.addEventListener("click", () => {
    if (scrapedPosts.length === 0) return;
    const blob = new Blob([JSON.stringify(scrapedPosts, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fb_group_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  downloadCsvBtn.addEventListener("click", () => {
    if (scrapedPosts.length === 0) return;
    const headers = ["post_id", "author_name", "author_url", "text", "reactions_total", "comments_count", "attachments"];
    let csvContent = headers.join(",") + "\n";
    scrapedPosts.forEach(p => {
      const reactions = p.reactions_json?.total || 0;
      const attachments = (p.attachments_json || []).join("; ");
      const row = [
        `="${p.post_id}"`,
        p.author_name || "Facebook User",
        p.author_url || "",
        (p.text || "").replace(/"/g, '""').replace(/\n/g, " "),
        reactions,
        p.comments_count || 0,
        attachments
      ];
      csvContent += row.map(val => `"${val}"`).join(",") + "\n";
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fb_group_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
  syncBtn.addEventListener("click", async () => {
    if (scrapedPosts.length === 0) return;
    const serverUrl = document.getElementById("serverUrl").value || "http://localhost:8080";
    syncBtn.disabled = true;
    syncBtn.innerText = "Đang đồng bộ...";
    try {
      const response = await fetch(`${serverUrl}/api/jobs/sync-extension`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          group_url: groupUrl,
          group_name: window.groupNameStr || groupUrl,
          posts: scrapedPosts
        })
      });
      const resData = await response.json();
      if (response.ok) {
        const jobUrl = `http://localhost:5173/jobs/${resData.job_id}`;
        if (confirm("🎉 Đồng bộ thành công! Bạn có muốn mở trang chi tiết Job trên Dashboard ngay lập tức để phân tích biểu đồ?")) {
          chrome.tabs.create({ url: jobUrl });
        }
        syncBtn.innerText = "Đồng bộ thành công!";
      } else {
        alert(`❌ Đồng bộ thất bại: ${resData.detail || "Server error"}`);
        syncBtn.innerText = "Đồng bộ lại";
        syncBtn.disabled = false;
      }
    } catch (err) {
      alert(`❌ Không kết nối được tới server backend Node.js (${serverUrl}). Hãy đảm bảo server đang chạy.`);
      syncBtn.innerText = "Đồng bộ lại";
      syncBtn.disabled = false;
    }
  });

  const syncGsheetBtn = document.getElementById("syncGsheetBtn");
  syncGsheetBtn.addEventListener("click", async () => {
    const webhookUrl = document.getElementById("gsheetWebhook").value.trim();
    if (!webhookUrl) {
      alert("❌ Vui lòng nhập URL Google Sheets Webhook trước khi đồng bộ!");
      return;
    }
    if (scrapedPosts.length === 0) {
      alert("❌ Chưa có dữ liệu để đồng bộ.");
      return;
    }
    syncGsheetBtn.disabled = true;
    syncGsheetBtn.innerText = "Đang đẩy lên Google Sheets...";
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: scrapedPosts, group_url: groupUrl })
      });
      if (response.ok) {
        alert("🎉 Đã đồng bộ thành công lên Google Sheets!");
        syncGsheetBtn.innerText = "Đồng bộ GSheet thành công!";
      } else {
        alert("❌ Lỗi khi đồng bộ lên Google Sheets.");
        syncGsheetBtn.innerText = "Đồng bộ GSheet lại";
        syncGsheetBtn.disabled = false;
      }
    } catch (err) {
      alert("❌ Không thể kết nối tới Google Sheets Webhook. Hãy kiểm tra lại URL.");
      syncGsheetBtn.innerText = "Đồng bộ GSheet lại";
      syncGsheetBtn.disabled = false;
    }
  });

  const syncBackendSheetBtn = document.getElementById("syncBackendSheetBtn");
  if (syncBackendSheetBtn) {
    syncBackendSheetBtn.addEventListener("click", async () => {
      if (scrapedPosts.length === 0) {
        alert("❌ Chưa có dữ liệu để đồng bộ.");
        return;
      }
      if (!authToken) {
        alert("❌ Bạn phải đăng nhập (ưu tiên Đăng nhập bằng Google) để sử dụng tính năng này.");
        return;
      }
      syncBackendSheetBtn.disabled = true;
      syncBackendSheetBtn.innerText = "Đang xử lý qua Backend...";
      try {
        const serverUrl = document.getElementById("serverUrl").value || "http://localhost:8080";
        const response = await fetch(`${serverUrl}/api/sheets/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({ posts: scrapedPosts, group_url: groupUrl })
        });
        const resData = await response.json();
        if (response.ok) {
          if (confirm(`🎉 Đã đồng bộ lên Google Sheets thành công!\nBạn có muốn mở file Sheet vừa tạo ra không?`)) {
            chrome.tabs.create({ url: resData.spreadsheetUrl });
          }
          syncBackendSheetBtn.innerText = "Đồng bộ GSheet tự động thành công!";
        } else {
          alert(`❌ Lỗi đồng bộ: ${resData.detail}`);
          syncBackendSheetBtn.innerText = "Đồng bộ GSheet tự động (Backend)";
          syncBackendSheetBtn.disabled = false;
        }
      } catch (err) {
        alert(`❌ Không kết nối được tới server backend Node.js (${serverUrl}).`);
        syncBackendSheetBtn.innerText = "Đồng bộ GSheet tự động (Backend)";
        syncBackendSheetBtn.disabled = false;
      }
    });
  }
});
