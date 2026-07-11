importScripts('config.js');
let activeCampaign = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_CAMPAIGN" || request.type === "START_CAMPAIGN_FROM_POPUP") {
    const payload = request.payload;
    if (activeCampaign) {
      // You could support multiple by maintaining a map by executionId
      // For simplicity in MVP, let's just allow it by keeping track of multiple active campaigns.
    }
    
    startCampaign(payload);
    sendResponse({ status: "started" });
    return true;
  }
  
  if (["LOG", "PROGRESS", "COMPLETE", "ERROR", "SYNC_BATCH"].includes(request.type)) {
    // Determine which campaign this belongs to via the tab id
    if (sender && sender.tab) {
      handleContentScriptMessage(request, sender.tab.id);
    }
  }
});

const campaigns = new Map();

async function startCampaign(payload) {
  const { executionId, scriptDetails, fbAccount } = payload;
  
  campaigns.set(executionId, {
    executionId,
    script: scriptDetails,
    fbAccount,
    token: payload.token,
    currentStep: 0,
    tabId: payload.tabId || null,
    status: "starting"
  });

  // Check login status using cookies
  chrome.cookies.get({ url: "https://www.facebook.com", name: "c_user" }, (cookie) => {
    const campaign = campaigns.get(executionId);
    if (!cookie) {
      console.log("Not logged into FB. Trying to login...");
      reportLogToBackend(executionId, "🔄 Trình duyệt chưa đăng nhập Facebook. Đang tiến hành tự động đăng nhập...");
      if (campaign.tabId) {
        chrome.tabs.update(campaign.tabId, { url: "https://www.facebook.com/login", active: true });
        campaign.status = "logging_in";
      } else {
        chrome.tabs.create({ url: "https://www.facebook.com/login", active: true }, (tab) => {
          campaign.tabId = tab.id;
          campaign.status = "logging_in";
        });
      }
    } else {
      console.log("Already logged into FB. Starting first step.");
      startStep(campaign);
    }
  });
}

function startStep(campaign) {
  campaign.status = "running";
  if (campaign.script.steps && campaign.script.steps.length > 0) {
    const step = campaign.script.steps[campaign.currentStep];
    if (campaign.tabId) {
       chrome.tabs.update(campaign.tabId, { url: step.group_url });
    } else {
       chrome.tabs.create({ url: step.group_url, active: true }, (tab) => {
         campaign.tabId = tab.id;
       });
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.url.includes("facebook.com")) {
    for (const [execId, campaign] of campaigns.entries()) {
      if (campaign.tabId === tabId) {
        if (campaign.status === "logging_in" && tab.url.includes("login")) {
          // Inject login script
          injectLoginScript(campaign);
        } else if (campaign.status === "logging_in" && !tab.url.includes("login")) {
          // Navigated away from login, assume success
          reportLogToBackend(campaign.executionId, "✅ Đăng nhập Facebook thành công.");
          startStep(campaign);
        } else if (campaign.status === "running" && !campaign.injected) {
          campaign.injected = true;
          injectAndStartScraping(campaign);
        }
        break;
      }
    }
  }
});

function injectLoginScript(campaign) {
  if (!campaign.fbAccount || !campaign.fbAccount.email || !campaign.fbAccount.password) {
    reportLogToBackend(campaign.executionId, "❌ Không có thông tin tài khoản để tự động đăng nhập.");
    return;
  }
  
  chrome.scripting.executeScript({
    target: { tabId: campaign.tabId },
    func: (email, password) => {
      const emailEl = document.querySelector('input[name="email"]');
      const passEl = document.querySelector('input[name="pass"]');
      const loginBtn = document.querySelector('button[name="login"]');
      
      if (emailEl && passEl && loginBtn) {
        emailEl.value = email;
        passEl.value = password;
        loginBtn.click();
      }
    },
    args: [campaign.fbAccount.email, campaign.fbAccount.password]
  });
}

function injectAndStartScraping(campaign) {
  const step = campaign.script.steps[campaign.currentStep];
  
  // First, we need to send the config to content.js after injecting it
  chrome.scripting.executeScript({
    target: { tabId: campaign.tabId },
    files: ["content.js"]
  }, () => {
    // Send start message
    chrome.tabs.sendMessage(campaign.tabId, {
      action: "START",
      config: {
        maxPosts: step.max_posts,
        sinceDate: campaign.script.since_date || null,
        untilDate: campaign.script.until_date || null
      }
    });
  });
}

async function handleContentScriptMessage(request, tabId) {
  // Find which campaign this tab belongs to
  let campaign = null;
  for (const c of campaigns.values()) {
    if (c.tabId === tabId) {
      campaign = c;
      break;
    }
  }
  
  if (!campaign) return;

  if (request.type === "LOG") {
    console.log(`[Campaign ${campaign.executionId}]`, request.text);
    reportLogToBackend(campaign.executionId, request.text);
  } else if (request.type === "PROGRESS") {
    // report progress
    reportProgressToBackend(campaign.executionId, request.count, request.target);
  } else if (request.type === "SYNC_BATCH") {
    if (request.posts && request.posts.length > 0) {
       await syncPostsToBackend(campaign, request.posts, request.groupName);
    }
  } else if (request.type === "COMPLETE") {
    const step = campaign.script.steps[campaign.currentStep];
    const posts = request.posts;
    
    // Sync data to backend
    await syncPostsToBackend(campaign, posts, request.groupName);
    
    // Move to next step
    campaign.currentStep++;
    campaign.injected = false; // Reset injected flag for next step
    if (campaign.currentStep < campaign.script.steps.length) {
      const nextStep = campaign.script.steps[campaign.currentStep];
      reportLogToBackend(campaign.executionId, `▶ Bắt đầu chạy Step ${campaign.currentStep + 1}: ${nextStep.group_url}`);
      chrome.tabs.update(campaign.tabId, { url: nextStep.group_url });
    } else {
      // Finished
      reportLogToBackend(campaign.executionId, `🎉 Hoàn thành Script Execution!`);
      completeCampaignInBackend(campaign.executionId);
      campaigns.delete(campaign.executionId);
      // Optional: close the tab
      // chrome.tabs.remove(campaign.tabId);
    }
  } else if (request.type === "ERROR") {
    reportLogToBackend(campaign.executionId, `❌ Lỗi: ${request.error}`);
    // proceed to next step or abort? For MVP, we can just stop or continue.
  }
}

// Network helpers
async function reportLogToBackend(executionId, msg) {
  try {
    const campaign = campaigns.get(executionId);
    const token = campaign ? campaign.token : null;
    await fetch(`${CONFIG.API_BASE_URL}/api/scripts/executions/${executionId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ message: msg })
    });
  } catch (e) {
    console.error("Failed to report log", e);
  }
}

async function reportProgressToBackend(executionId, count, target) {
  try {
    const campaign = campaigns.get(executionId);
    const token = campaign ? campaign.token : null;
    await fetch(`${CONFIG.API_BASE_URL}/api/scripts/executions/${executionId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ progress: Math.floor((count / target) * 100) })
    });
  } catch (e) {
    console.error("Failed to report progress", e);
  }
}

async function syncPostsToBackend(campaign, posts, groupName) {
  const step = campaign.script.steps[campaign.currentStep];
  try {
    const token = campaign.token;
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/scripts/executions/${campaign.executionId}/sync-step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        step_index: campaign.currentStep,
        group_url: step.group_url,
        group_name: groupName,
        posts: posts
      })
    });
  } catch (e) {
    console.error("Failed to sync posts", e);
    reportLogToBackend(campaign.executionId, `❌ Lỗi khi đồng bộ dữ liệu: ${e.message}`);
  }
}

async function completeCampaignInBackend(executionId) {
  try {
    const campaign = campaigns.get(executionId);
    const token = campaign ? campaign.token : null;
    await fetch(`${CONFIG.API_BASE_URL}/api/scripts/executions/${executionId}/complete`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
  } catch (e) {}
}
