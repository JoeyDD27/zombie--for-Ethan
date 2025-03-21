chrome.action.onClicked.addListener((tab) => {
  if (!tab.url.includes('chrome://')) {
    chrome.tabs.sendMessage(tab.id, { action: "spawn_zombie" }).catch((err) => {
      console.error('Failed to send message:', err);
    });
  }
}); 