console.log("FBGroupScraper Pro Helper: frontend-connector.js injected");

window.addEventListener("message", (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  if (event.data && event.data.type === "FB_SCRAPER_START_CAMPAIGN") {
    console.log("Received FB_SCRAPER_START_CAMPAIGN from frontend", event.data.payload);
    
    // Forward to background script
    chrome.runtime.sendMessage(
      {
        action: "START_CAMPAIGN",
        payload: event.data.payload
      },
      (response) => {
        console.log("Background script response:", response);
      }
    );
  }
});
