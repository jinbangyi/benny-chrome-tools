// Enhanced background script with proxy server integration

// Import safe functions
importScripts('safe-functions.js');

// Proxy server configuration
const PROXY_CONFIG = {
  host: 'localhost',
  port: 8081,
  baseUrl: 'http://localhost:8081'
};

// Logging system
let extensionLogs = [];
const MAX_LOGS = 1000;

// Override console methods to capture logs
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// Custom logging function
function logToStorage(level, source, ...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  const logEntry = {
    timestamp: Date.now(),
    level: level,
    source: source,
    message: message
  };
  
  extensionLogs.push(logEntry);
  
  if (extensionLogs.length > MAX_LOGS) {
    extensionLogs = extensionLogs.slice(-MAX_LOGS);
  }
  
  if (extensionLogs.length % 10 === 0) {
    chrome.storage.local.set({ extensionLogs: extensionLogs }).catch(err => {
      originalConsole.error('Failed to save logs to storage:', err);
    });
  }
  
  originalConsole[level](`[${source.toUpperCase()}]`, ...args);
}

// Override console methods
console.log = (...args) => logToStorage('info', 'background', ...args);
console.error = (...args) => logToStorage('error', 'background', ...args);
console.warn = (...args) => logToStorage('warn', 'background', ...args);
console.info = (...args) => logToStorage('info', 'background', ...args);
console.debug = (...args) => logToStorage('debug', 'background', ...args);

let isWatching = false;
let watchConfig = {
  endpoint: '',
  method: '*',
  jsCode: ''
};
// Note: Results are now handled by proxy server only

// Proxy server integration
let proxyServerStatus = {
  isRunning: false,
  lastCheck: 0
};

// Initialize when extension starts
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

async function initialize() {
  console.log('Extension initializing with proxy integration...');
  try {
    const stored = await chrome.storage.local.get(['isWatching', 'endpoint', 'method', 'jsCode', 'results']);
    console.log('Loaded stored configuration:', stored);
    
    if (stored.isWatching) {
      watchConfig.endpoint = stored.endpoint || '';
      watchConfig.method = stored.method || '*';
      watchConfig.jsCode = stored.jsCode || '';
      console.log('Restoring watch state with config:', watchConfig);
      await startWatching(watchConfig);
    } else {
      console.log('Extension not previously watching, starting fresh');
    }

    // Check proxy server status
    await checkProxyServerStatus();
  } catch (error) {
    console.error('Error initializing:', error);
  }
}

// Check if proxy server is running
async function checkProxyServerStatus() {
  try {
    console.log('Checking proxy server status at:', PROXY_CONFIG.baseUrl);
    
    const response = await fetch(`${PROXY_CONFIG.baseUrl}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Proxy status response status:', response.status);
    
    if (response.ok) {
      const status = await response.json();
      proxyServerStatus = {
        isRunning: true,
        lastCheck: Date.now(),
        ...status
      };
      console.log('Proxy server is running:', status);
      return true;
    } else {
      console.log('Proxy server responded with error status:', response.status);
    }
  } catch (error) {
    console.log('Proxy server not available:', error.message);
    console.log('Error details:', error);
    
    // Try a simpler connection test
    try {
      console.log('Attempting simple connection test...');
      const testResponse = await fetch(`${PROXY_CONFIG.baseUrl}/`, {
        method: 'GET',
        mode: 'no-cors'  // This won't give us response data but will test connectivity
      });
      console.log('Simple connection test completed');
    } catch (testError) {
      console.log('Simple connection test also failed:', testError.message);
    }
  }
  
  proxyServerStatus = {
    isRunning: false,
    lastCheck: Date.now(),
    error: 'Connection failed'
  };
  console.log('Proxy server status set to not running');
  return false;
}

// Sync configuration with proxy server
async function syncConfigWithProxy() {
  if (!proxyServerStatus.isRunning) {
    console.log('Proxy server not available, skipping sync');
    return;
  }

  try {
    const response = await fetch(`${PROXY_CONFIG.baseUrl}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        isWatching: isWatching,
        endpoint: watchConfig.endpoint,
        method: watchConfig.method,
        jsCode: watchConfig.jsCode
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Configuration synced with proxy server:', result);
    } else {
      console.error('Failed to sync config with proxy server:', response.status);
    }
  } catch (error) {
    console.error('Error syncing config with proxy server:', error);
  }
}

// Get results from proxy server
async function getProxyResults() {
  if (!proxyServerStatus.isRunning) {
    return [];
  }

  try {
    const response = await fetch(`${PROXY_CONFIG.baseUrl}/results`);
    if (response.ok) {
      const data = await response.json();
      return data.results || [];
    }
  } catch (error) {
    console.error('Error getting proxy results:', error);
  }
  return [];
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
    case 'startWatching':
      await startWatching(message);
      sendResponse({ success: true });
      break;
    case 'stopWatching':
      await stopWatching();
      sendResponse({ success: true });
      break;
    case 'clearResults':
      await clearResults();
      sendResponse({ success: true });
      break;
    case 'addLog':
      handleLogFromContentScript(message.logEntry);
      sendResponse({ success: true });
      break;
    case 'getProxyStatus':
      await checkProxyServerStatus();
      sendResponse({ status: proxyServerStatus });
      break;
    case 'getResults':
      // Get results from proxy server only
      const proxyResults = await getProxyResults();
      sendResponse({ results: proxyResults });
      break;
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  return true; // Keep message channel open for async response
});

// Start watching for requests (proxy-only)
async function startWatching(config) {
  console.log('Starting proxy-only request watching for endpoint:', config.endpoint);
  
  watchConfig = {
    endpoint: config.endpoint,
    method: config.method,
    jsCode: config.jsCode
  };
  
  isWatching = true;
  
  console.log('Watch configuration set:', watchConfig);
  
  // Save state
  await chrome.storage.local.set({
    isWatching: true,
    endpoint: config.endpoint,
    method: config.method,
    jsCode: config.jsCode
  });

  // Check proxy server and sync config
  await checkProxyServerStatus();
  if (proxyServerStatus.isRunning) {
    await syncConfigWithProxy();
    console.log('Using proxy server for enhanced response body access');
    startRequestMonitoring();
    console.log('Proxy-based request monitoring started successfully');
  } else {
    console.error('Proxy server not available - monitoring cannot start');
    console.log('Please start the proxy server with: node proxy-server.js');
  }
  
  // Notify popup
  notifyPopup('statusUpdate', { isWatching: true, proxyStatus: proxyServerStatus });
}

// Stop watching for requests
async function stopWatching() {
  console.log('Stopping request monitoring');
  
  isWatching = false;
  
  // Save state
  await chrome.storage.local.set({ isWatching: false });
  
  // Sync with proxy server
  if (proxyServerStatus.isRunning) {
    await syncConfigWithProxy();
  }
  
  stopRequestMonitoring();
  
  console.log('Request monitoring stopped');
  
  // Notify popup
  notifyPopup('statusUpdate', { isWatching: false, proxyStatus: proxyServerStatus });
}

// Clear results (proxy-only)
async function clearResults() {
  console.log('Clearing proxy server results');
  
  // Clear local storage
  await chrome.storage.local.set({ results: [] });
  
  // Note: Proxy server results are managed by the proxy server itself
  console.log('Local results cleared successfully');
}

// Start monitoring HTTP requests (proxy-only)
function startRequestMonitoring() {
  // Inject content script for proxy communication
  if (proxyServerStatus.isRunning) {
    console.log('Starting proxy-based request monitoring');
    injectProxyContentScript();
  } else {
    console.warn('Proxy server not running - no request monitoring available');
  }
}

// Stop monitoring HTTP requests (proxy-only)
function stopRequestMonitoring() {
  console.log('Stopped proxy-based request monitoring');
  // No webRequest listeners to remove in proxy-only mode
}

// Inject content script for proxy communication
async function injectProxyContentScript() {
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      // Skip chrome:// and other restricted URLs
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('moz-extension://') || tab.url.startsWith('edge://')) {
        continue;
      }
      
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectProxyInterceptor,
          args: [PROXY_CONFIG, watchConfig]
        });
        console.log('Injected proxy interceptor into tab:', tab.url);
      } catch (error) {
        console.log('Could not inject into tab:', tab.url, error.message);
      }
    }
  } catch (error) {
    console.error('Error injecting proxy content script:', error);
  }
}

// Function to be injected into pages for proxy interception
function injectProxyInterceptor(proxyConfig, watchConfig) {
  // Only inject once
  if (window.httpWatcherProxyInjected) return;
  window.httpWatcherProxyInjected = true;
  
  console.log('[HTTP-Watcher] Proxy interceptor injected');
  
  // Store original fetch and XMLHttpRequest
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  // Helper function to check if URL matches endpoint pattern
  function matchesEndpoint(url, method) {
    if (!watchConfig.endpoint) return false;
    
    if (watchConfig.method !== '*' && watchConfig.method !== method) {
      return false;
    }
    
    const endpointPattern = watchConfig.endpoint
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    
    const regex = new RegExp(endpointPattern, 'i');
    return regex.test(url);
  }
  
  // Override fetch to route through proxy when needed
  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const method = init.method || 'GET';
    
    // Check if we should proxy this request
    if (matchesEndpoint(url, method)) {
      console.log('[HTTP-Watcher] Routing fetch request through proxy:', url);
      
      // Route through proxy
      return originalFetch(`${proxyConfig.baseUrl}/proxy`, {
        ...init,
        headers: {
          ...init.headers,
          'X-Target-URL': url
        }
      });
    }
    
    return originalFetch(input, init);
  };
  
  // Override XMLHttpRequest
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this._httpWatcherMethod = method;
    this._httpWatcherUrl = url;
    this._httpWatcherShouldProxy = matchesEndpoint(url, method);
    
    if (this._httpWatcherShouldProxy) {
      console.log('[HTTP-Watcher] Routing XHR through proxy:', url);
      // Modify to go through proxy
      return originalXHROpen.call(this, method, `${proxyConfig.baseUrl}/proxy`, async, user, password);
    }
    
    return originalXHROpen.call(this, method, url, async, user, password);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    if (this._httpWatcherShouldProxy) {
      // Set the target URL header for proxy
      this.setRequestHeader('X-Target-URL', this._httpWatcherUrl);
    }
    
    return originalXHRSend.call(this, data);
  };
}

// Handle log entries from content scripts
function handleLogFromContentScript(logEntry) {
  extensionLogs.push(logEntry);
  
  if (extensionLogs.length > MAX_LOGS) {
    extensionLogs = extensionLogs.slice(-MAX_LOGS);
  }
  
  chrome.storage.local.set({ extensionLogs: extensionLogs }).catch(err => {
    originalConsole.error('Failed to save content script logs:', err);
  });
}

// Notify popup of changes
function notifyPopup(action, data) {
  chrome.runtime.sendMessage({ action: action, ...data }).catch(() => {
    // Popup might not be open, ignore error
  });
}

// Periodic proxy server status check
setInterval(async () => {
  if (Date.now() - proxyServerStatus.lastCheck > 30000) { // Check every 30 seconds
    await checkProxyServerStatus();
  }
}, 30000);
