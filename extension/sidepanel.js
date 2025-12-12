/**
 * Danny Side Panel Script
 * 
 * Loads the Danny web app in an iframe and provides page context.
 */

// Environment URLs
// Note: Update production URL after deploying to Vercel
const ENVIRONMENTS = {
  local: 'http://localhost:3001',
  develop: 'https://danny-web-dev.vercel.app',  // Or your custom Vercel preview domain
  production: 'https://danny-web.vercel.app'    // Or your custom production domain
};

// Default environment
const DEFAULT_ENVIRONMENT = 'local';

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const frameEl = document.getElementById('danny-frame');
const envSelector = document.getElementById('environment');
const envBadge = document.getElementById('env-badge');

// Current page context
let currentPageContext = null;
let iframeReady = false;

// Get the current environment from storage or use default
async function getEnvironment() {
  const result = await chrome.storage.local.get(['environment']);
  return result.environment || DEFAULT_ENVIRONMENT;
}

// Save the current environment to storage
async function setEnvironment(environment) {
  await chrome.storage.local.set({ environment });
}

// Get the Danny URL for the current environment
async function getDannyUrl() {
  const env = await getEnvironment();
  return ENVIRONMENTS[env] || ENVIRONMENTS[DEFAULT_ENVIRONMENT];
}

// Update the environment badge
function updateEnvironmentBadge(environment) {
  envBadge.textContent = environment;
  envBadge.className = `env-badge ${environment}`;
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

// Open settings to configure URL (kept for backward compatibility with error screen)
async function openSettings() {
  const currentEnv = await getEnvironment();
  alert(`Current environment: ${currentEnv}\n\nEnvironment URLs:\n- Local: ${ENVIRONMENTS.local}\n- Develop: ${ENVIRONMENTS.develop}\n- Production: ${ENVIRONMENTS.production}\n\nUse the dropdown at the top to switch environments.`);
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

// Handle environment change
envSelector.addEventListener('change', async (e) => {
  const newEnv = e.target.value;
  await setEnvironment(newEnv);
  updateEnvironmentBadge(newEnv);
  
  // Reload the iframe with the new environment
  iframeReady = false;
  loadDanny();
});

// Initialize environment selector
async function initEnvironmentSelector() {
  const currentEnv = await getEnvironment();
  envSelector.value = currentEnv;
  updateEnvironmentBadge(currentEnv);
}

// Make functions available globally
window.retryLoad = retryLoad;
window.openSettings = openSettings;

// Initialize and load on startup
initEnvironmentSelector().then(() => {
loadDanny();
});

