chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url.includes('chrome://')) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "spawn_zombie" });
    } catch (error) {
      // Content script not loaded yet — inject CSS + JS
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      // Now send the message
      await chrome.tabs.sendMessage(tab.id, { action: "spawn_zombie" });
    }
  }
});
