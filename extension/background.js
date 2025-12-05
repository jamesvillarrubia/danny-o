/**
 * Danny Extension Background Service Worker
 * 
 * Handles extension icon clicks and side panel management.
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  // Open the side panel for the current tab
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Set the side panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Danny extension installed!');
  } else if (details.reason === 'update') {
    console.log('Danny extension updated!');
  }
});

