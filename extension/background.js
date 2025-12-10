/**
 * Danny Extension Background Service Worker
 * 
 * Handles extension icon clicks, side panel management, and page context extraction.
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

/**
 * Extract page context from a tab
 * Returns: { url, title, html, text, meta }
 */
async function extractPageContext(tabId) {
  try {
    // Get tab info
    const tab = await chrome.tabs.get(tabId);
    
    // Skip chrome:// and other protected URLs
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return {
        url: tab.url || '',
        title: tab.title || '',
        html: '',
        text: '',
        meta: {},
        error: 'Cannot access this page type'
      };
    }

    // Execute script to extract page content
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Extract metadata
        const meta = {};
        document.querySelectorAll('meta').forEach(m => {
          const name = m.getAttribute('name') || m.getAttribute('property');
          const content = m.getAttribute('content');
          if (name && content) {
            meta[name] = content;
          }
        });

        // Get the main content (prefer article/main, fall back to body)
        const mainContent = document.querySelector('article') || 
                           document.querySelector('main') || 
                           document.querySelector('[role="main"]') ||
                           document.body;

        // Get clean text content (limit to reasonable size)
        const textContent = mainContent?.innerText?.slice(0, 50000) || '';

        // Get HTML (simplified - remove scripts, styles, and limit size)
        const clonedDoc = document.documentElement.cloneNode(true);
        clonedDoc.querySelectorAll('script, style, noscript, svg, iframe').forEach(el => el.remove());
        const html = clonedDoc.outerHTML.slice(0, 100000);

        return {
          html,
          text: textContent,
          meta,
          selection: window.getSelection()?.toString() || ''
        };
      }
    });

    const pageData = results[0]?.result || {};

    return {
      url: tab.url,
      title: tab.title || '',
      html: pageData.html || '',
      text: pageData.text || '',
      meta: pageData.meta || {},
      selection: pageData.selection || ''
    };
  } catch (error) {
    console.error('Failed to extract page context:', error);
    return {
      url: '',
      title: '',
      html: '',
      text: '',
      meta: {},
      error: error.message
    };
  }
}

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTEXT') {
    // Get the active tab and extract context
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(async (tabs) => {
        if (tabs[0]) {
          const context = await extractPageContext(tabs[0].id);
          sendResponse(context);
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

// Notify side panel when tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Send message to any open side panels
    chrome.runtime.sendMessage({ type: 'TAB_CHANGED', tabId: activeInfo.tabId });
  } catch (e) {
    // Ignore errors if no listeners
  }
});

// Notify side panel when tab URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    try {
      chrome.runtime.sendMessage({ type: 'TAB_UPDATED', tabId, url: tab.url });
    } catch (e) {
      // Ignore errors if no listeners
    }
  }
});

