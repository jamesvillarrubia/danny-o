/**
 * Danny Side Panel Script
 * 
 * Loads the Danny web app in an iframe with environment selection.
 */

// Environment presets
const ENVIRONMENTS = {
  local: {
    name: 'Local Development',
    webUrl: 'http://localhost:5173',
    apiUrl: 'http://localhost:3000'
  },
  staging: {
    name: 'Staging',
    webUrl: 'https://danny-o-git-develop.vercel.app',
    apiUrl: 'https://danny-tasks-api-dev.fly.dev'
  },
  production: {
    name: 'Production',
    webUrl: 'https://danny-o.vercel.app',
    apiUrl: 'https://danny-tasks-api-prod.fly.dev'
  }
};

// DOM elements
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const frameEl = document.getElementById('danny-frame');
const envSelectorEl = document.getElementById('env-selector');
const envSelectEl = document.getElementById('env-select');
const envConfigBtnEl = document.getElementById('env-config-btn');

// Get the current environment from storage
async function getCurrentEnvironment() {
  const result = await chrome.storage.local.get(['dannyEnvironment']);
  return result.dannyEnvironment || 'local';
}

// Save the current environment to storage
async function setCurrentEnvironment(env) {
  await chrome.storage.local.set({ dannyEnvironment: env });
}

// Get custom environment URLs from storage
async function getCustomEnvironments() {
  const result = await chrome.storage.local.get(['dannyCustomEnvironments']);
  return result.dannyCustomEnvironments || {};
}

// Save custom environment URLs
async function setCustomEnvironments(custom) {
  await chrome.storage.local.set({ dannyCustomEnvironments: custom });
}

// Get the full environment list (presets + custom)
async function getAllEnvironments() {
  const custom = await getCustomEnvironments();
  return { ...ENVIRONMENTS, ...custom };
}

// Get the web URL for the current environment
async function getDannyUrl() {
  const env = await getCurrentEnvironment();
  const allEnvs = await getAllEnvironments();
  const selectedEnv = allEnvs[env];
  
  if (!selectedEnv) {
    return ENVIRONMENTS.local.webUrl;
  }
  
  return selectedEnv.webUrl;
}

// Get the API URL for the current environment
async function getApiUrl() {
  const env = await getCurrentEnvironment();
  const allEnvs = await getAllEnvironments();
  const selectedEnv = allEnvs[env];
  
  if (!selectedEnv) {
    return ENVIRONMENTS.local.apiUrl;
  }
  
  return selectedEnv.apiUrl || '';
}

// Load the Danny app in the iframe
async function loadDanny() {
  showLoading();
  
  const webUrl = await getDannyUrl();
  const apiUrl = await getApiUrl();
  
  try {
    // Build URL with API URL as query parameter
    const url = new URL(webUrl);
    if (apiUrl) {
      url.searchParams.set('apiUrl', apiUrl);
    }
    
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
    
    // Set iframe permissions for clipboard access
    frameEl.setAttribute('allow', 'clipboard-write');
    frameEl.src = url.toString();
    
    // Listen for successful load
    frameEl.addEventListener('load', () => {
      clearTimeout(loadTimeout);
    }, { once: true });
  } catch (error) {
    console.error('Invalid URL:', webUrl, error);
    showError();
  }
}

// Populate environment selector
async function populateEnvironmentSelector() {
  const currentEnv = await getCurrentEnvironment();
  const allEnvs = await getAllEnvironments();
  
  // Clear existing options (except the first one if it's a placeholder)
  envSelectEl.innerHTML = '';
  
  // Add preset environments
  Object.entries(ENVIRONMENTS).forEach(([key, env]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = env.name;
    if (key === currentEnv) {
      option.selected = true;
    }
    envSelectEl.appendChild(option);
  });
  
  // Add custom environments
  const custom = await getCustomEnvironments();
  Object.entries(custom).forEach(([key, env]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${env.name} (Custom)`;
    if (key === currentEnv) {
      option.selected = true;
    }
    envSelectEl.appendChild(option);
  });
}

// Handle environment change
async function handleEnvironmentChange() {
  const newEnv = envSelectEl.value;
  await setCurrentEnvironment(newEnv);
  loadDanny();
}

// Open environment configuration
async function openEnvironmentConfig() {
  const currentEnv = await getCurrentEnvironment();
  const allEnvs = await getAllEnvironments();
  const selectedEnv = allEnvs[currentEnv];
  
  const name = prompt('Environment name:', selectedEnv?.name || '');
  if (!name) return;
  
  const webUrl = prompt('Web URL:', selectedEnv?.webUrl || '');
  if (!webUrl) return;
  
  const apiUrl = prompt('API URL (optional):', selectedEnv?.apiUrl || '');
  
  const custom = await getCustomEnvironments();
  custom[currentEnv] = {
    name,
    webUrl,
    apiUrl: apiUrl || ''
  };
  
  await setCustomEnvironments(custom);
  await populateEnvironmentSelector();
  loadDanny();
}

// Show loading state
function showLoading() {
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  frameEl.classList.add('hidden');
  if (envSelectorEl) envSelectorEl.classList.remove('hidden');
}

// Show the iframe
function showFrame() {
  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  frameEl.classList.remove('hidden');
  if (envSelectorEl) envSelectorEl.classList.remove('hidden');
}

// Show error state
function showError() {
  loadingEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
  frameEl.classList.add('hidden');
  if (envSelectorEl) envSelectorEl.classList.remove('hidden');
}

// Retry loading
function retryLoad() {
  loadDanny();
}

// Make functions available globally
window.retryLoad = retryLoad;
window.openSettings = openEnvironmentConfig;
window.handleEnvironmentChange = handleEnvironmentChange;

// Initialize on startup
(async () => {
  await populateEnvironmentSelector();
  envSelectEl.addEventListener('change', handleEnvironmentChange);
  if (envConfigBtnEl) {
    envConfigBtnEl.addEventListener('click', openEnvironmentConfig);
  }
  loadDanny();
})();

