/**
 * Danny Side Panel Script
 * 
 * Loads the Danny web app in an iframe.
 */

// Default URL - update this to your Vercel deployment URL
const DEFAULT_DANNY_URL = 'http://localhost:3001';

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const frameEl = document.getElementById('danny-frame');

// Get the Danny URL from storage or use default
async function getDannyUrl() {
  const result = await chrome.storage.local.get(['dannyUrl']);
  return result.dannyUrl || DEFAULT_DANNY_URL;
}

// Save the Danny URL to storage
async function setDannyUrl(url) {
  await chrome.storage.local.set({ dannyUrl: url });
}

// Load the Danny app in the iframe
async function loadDanny() {
  showLoading();
  
  const url = await getDannyUrl();
  
  // Set up load handlers
  frameEl.onload = () => {
    showFrame();
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

// Make functions available globally
window.retryLoad = retryLoad;
window.openSettings = openSettings;

// Load on startup
loadDanny();

