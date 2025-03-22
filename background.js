chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url.includes('chrome://')) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "spawn_zombie" });
    } catch (error) {
      // If the content script isn't ready yet, inject it
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      // Try sending the message again
      await chrome.tabs.sendMessage(tab.id, { action: "spawn_zombie" });
    }
  }
}); 