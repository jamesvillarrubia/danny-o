/**
 * Danny Side Panel Script
 * 
 * Loads the Danny web app in an iframe and provides page context.
 */

// Default URL - update this to your Vercel deployment URL
const DEFAULT_DANNY_URL = 'http://localhost:3001';

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const frameEl = document.getElementById('danny-frame');

// Current page context
let currentPageContext = null;
let iframeReady = false;

// Get the Danny URL from storage or use default
async function getDannyUrl() {
  const result = await chrome.storage.local.get(['dannyUrl']);
  return result.dannyUrl || DEFAULT_DANNY_URL;
}

// Save the Danny URL to storage
async function setDannyUrl(url) {
  await chrome.storage.local.set({ dannyUrl: url });
}

// Request page context from background script
async function getPageContext() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting page context:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

// Send page context to the iframe
function sendContextToIframe(context) {
  if (!frameEl.contentWindow || !context) return;
  
  try {
    frameEl.contentWindow.postMessage({
      type: 'PAGE_CONTEXT',
      context: {
        url: context.url,
        title: context.title,
        text: context.text,
        html: context.html,
        meta: context.meta,
        selection: context.selection,
        timestamp: Date.now()
      }
    }, '*');
    
    console.log('Sent page context to iframe:', context.url);
  } catch (error) {
    console.error('Failed to send context to iframe:', error);
  }
}

// Update page context and send to iframe
async function updatePageContext() {
  const context = await getPageContext();
  currentPageContext = context;
  
  if (iframeReady && context) {
    sendContextToIframe(context);
  }
}

// Load the Danny app in the iframe
async function loadDanny() {
  showLoading();
  
  const url = await getDannyUrl();
  
  // Set up load handlers
  frameEl.onload = async () => {
    showFrame();
    iframeReady = true;
    
    // Send initial page context after iframe loads
    await updatePageContext();
  };
  
  frameEl.onerror = () => {
    showError();
  };
  
  // Load with a timeout for connection errors
  const loadTimeout = setTimeout(() => {
    if (loadingEl.style.display !== 'none') {
      showError();
    }
  }, 10000);
  
  frameEl.src = url;
  
  // Listen for successful load
  frameEl.addEventListener('load', () => {
    clearTimeout(loadTimeout);
  }, { once: true });
}

// Show loading state
function showLoading() {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  frameEl.classList.add('hidden');
}

// Show the iframe
function showFrame() {
  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  frameEl.classList.remove('hidden');
}

// Show error state
function showError() {
  loadingEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
  frameEl.classList.add('hidden');
}

// Retry loading
function retryLoad() {
  loadDanny();
}

// Open settings to configure URL
async function openSettings() {
  const currentUrl = await getDannyUrl();
  const newUrl = prompt('Enter the Danny dashboard URL:', currentUrl);
  
  if (newUrl && newUrl.trim()) {
    await setDannyUrl(newUrl.trim());
    loadDanny();
  }
}

// Listen for messages from background script (tab changes)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TAB_CHANGED' || message.type === 'TAB_UPDATED') {
    // Update page context when tab changes
    updatePageContext();
  }
});

// Listen for messages from the iframe requesting context
window.addEventListener('message', async (event) => {
  // Only accept messages from our iframe
  if (event.source !== frameEl.contentWindow) return;
  
  if (event.data?.type === 'REQUEST_PAGE_CONTEXT') {
    await updatePageContext();
  }
});

// Make functions available globally
window.retryLoad = retryLoad;
window.openSettings = openSettings;

// Load on startup
loadDanny();

