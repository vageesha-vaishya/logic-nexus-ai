
// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("Nexus Connect Extension Installed");
});

// Listen for side panel opening
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
