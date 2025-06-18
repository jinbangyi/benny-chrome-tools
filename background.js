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
let results = [];

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
      results = stored.results || [];
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
    const response = await fetch(`${PROXY_CONFIG.baseUrl}/status`);
    if (response.ok) {
      const status = await response.json();
      proxyServerStatus = {
        isRunning: true,
        lastCheck: Date.now(),
        ...status
      };
      console.log('Proxy server is running:', status);
      return true;
    }
  } catch (error) {
    console.log('Proxy server not available:', error.message);
  }
  
  proxyServerStatus = {
    isRunning: false,
    lastCheck: Date.now()
  };
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
    case 'httpRequestIntercepted':
      await handleInterceptedRequest(message.data);
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
    case 'shouldProxyRequest':
      const shouldProxy = isWatching && proxyServerStatus.isRunning && 
                         matchesEndpoint(message.url, message.method);
      sendResponse({ shouldProxy });
      break;
    case 'getResults':
      // Merge local and proxy results
      const proxyResults = await getProxyResults();
      const allResults = [...results, ...proxyResults]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
      sendResponse({ results: allResults });
      break;
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  return true; // Keep message channel open for async response
});

// Start watching for requests
async function startWatching(config) {
  console.log('Starting to watch requests for endpoint:', config.endpoint);
  
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
  } else {
    console.log('Proxy server not available, using webRequest API (limited response body access)');
  }

  startRequestMonitoring();
  
  console.log('Request monitoring started successfully');
  
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

// Clear results
async function clearResults() {
  console.log('Clearing all results');
  
  results = [];
  await chrome.storage.local.set({ results: [] });
  
  console.log('Results cleared successfully');
}

// Start monitoring HTTP requests
function startRequestMonitoring() {
  if (!chrome.webRequest.onBeforeRequest.hasListener(handleRequest)) {
    chrome.webRequest.onBeforeRequest.addListener(
      handleRequest,
      { urls: ["<all_urls>"] },
      ["requestBody"]
    );
  }
  
  if (!chrome.webRequest.onCompleted.hasListener(handleResponse)) {
    chrome.webRequest.onCompleted.addListener(
      handleResponse,
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );
  }

  // Inject content script for proxy communication if proxy is available
  if (proxyServerStatus.isRunning) {
    console.log('Proxy server available, enabling enhanced request interception');
    injectProxyContentScript();
  }
}

// Stop monitoring HTTP requests
function stopRequestMonitoring() {
  if (chrome.webRequest.onBeforeRequest.hasListener(handleRequest)) {
    chrome.webRequest.onBeforeRequest.removeListener(handleRequest);
  }
  
  if (chrome.webRequest.onCompleted.hasListener(handleResponse)) {
    chrome.webRequest.onCompleted.removeListener(handleResponse);
  }
}

// Store request details for later processing
const requestData = new Map();

// Inject content script for proxy communication
async function injectProxyContentScript() {
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      // Skip chrome:// and other restricted URLs
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        continue;
      }
      
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectProxyInterceptor,
          args: [PROXY_CONFIG]
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
function injectProxyInterceptor(proxyConfig) {
  // Only inject once
  if (window.httpWatcherProxyInjected) return;
  window.httpWatcherProxyInjected = true;
  
  console.log('[HTTP-Watcher] Proxy interceptor injected');
  
  // Store original fetch and XMLHttpRequest
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  // Override fetch to route through proxy when needed
  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    
    // Check if we should proxy this request
    const shouldProxy = await checkShouldProxy(url, init.method || 'GET');
    
    if (shouldProxy) {
      console.log('[HTTP-Watcher] Routing request through proxy:', url);
      
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
    
    return originalXHROpen.call(this, method, url, async, user, password);
  };
  
  XMLHttpRequest.prototype.send = async function(data) {
    const shouldProxy = await checkShouldProxy(this._httpWatcherUrl, this._httpWatcherMethod);
    
    if (shouldProxy) {
      console.log('[HTTP-Watcher] Routing XHR through proxy:', this._httpWatcherUrl);
      
      // Modify the request to go through proxy
      const proxyUrl = `${proxyConfig.baseUrl}/proxy`;
      this.setRequestHeader('X-Target-URL', this._httpWatcherUrl);
      
      // Update the URL to proxy
      this._httpWatcherOriginalUrl = this._httpWatcherUrl;
      originalXHROpen.call(this, this._httpWatcherMethod, proxyUrl, true);
    }
    
    return originalXHRSend.call(this, data);
  };
  
  async function checkShouldProxy(url, method) {
    // Ask background script if this request should be proxied
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'shouldProxyRequest',
        url: url,
        method: method
      });
      return response && response.shouldProxy;
    } catch (error) {
      return false;
    }
  }
}

// Handle request start (for non-proxy monitoring)
function handleRequest(details) {
  if (!isWatching || proxyServerStatus.isRunning) return; // Skip if using proxy
  
  console.log('Intercepting request:', details.method, details.url);
  
  requestData.set(details.requestId, {
    url: details.url,
    method: details.method,
    requestBody: details.requestBody,
    timestamp: Date.now()
  });
}

// Handle request completion (for non-proxy monitoring)
async function handleResponse(details) {
  if (!isWatching || proxyServerStatus.isRunning) return; // Skip if using proxy
  
  console.log('Handling response for:', details.url, 'Status:', details.statusCode);
  
  const requestInfo = requestData.get(details.requestId);
  if (!requestInfo) {
    return;
  }

  requestData.delete(details.requestId);

  if (!matchesEndpoint(requestInfo.url, requestInfo.method)) {
    return;
  }

  console.log('Request matches endpoint! Processing...', requestInfo.url);

  try {
    // Prepare response object (limited by webRequest API)
    const responseObject = {
      url: requestInfo.url,
      method: requestInfo.method,
      status: details.statusCode,
      headers: details.responseHeaders || [],
      body: { 
        message: 'Response body not available via webRequest API. Use proxy server for full access.',
        note: 'Start proxy server with: node proxy-server.js'
      },
      requestBody: requestInfo.requestBody
    };
    
    const result = await executeUserCodeSimple(responseObject);
    
    const resultEntry = {
      timestamp: Date.now(),
      url: requestInfo.url,
      method: requestInfo.method,
      status: details.statusCode,
      result: result
    };
    
    results.unshift(resultEntry);
    results = results.slice(0, 50);
    
    await chrome.storage.local.set({ results: results });
    notifyPopup('newResult', resultEntry);
    
  } catch (error) {
    console.error('Error processing response:', error);
    
    const errorEntry = {
      timestamp: Date.now(),
      url: requestInfo.url,
      method: requestInfo.method,
      status: details.statusCode,
      result: 'Error: ' + error.message
    };
    
    results.unshift(errorEntry);
    results = results.slice(0, 50);
    
    await chrome.storage.local.set({ results: results });
    notifyPopup('newResult', errorEntry);
  }
}

// Check if URL matches the configured endpoint
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

// Execute user's JavaScript code safely
async function executeUserCodeSimple(responseObject) {
  try {
    console.log('Executing user code for request:', responseObject.url);
    
    // Check for new BUILDIN_ naming convention
    if (watchConfig.jsCode.includes('BUILDIN_birdeye-metrics')) {
      console.log('Using BUILDIN_birdeye-metrics function');
      return SAFE_FUNCTIONS['BUILDIN_birdeye-metrics'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('BUILDIN_simple-log')) {
      console.log('Using BUILDIN_simple-log function');
      return SAFE_FUNCTIONS['BUILDIN_simple-log'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('BUILDIN_count-records')) {
      console.log('Using BUILDIN_count-records function');
      return SAFE_FUNCTIONS['BUILDIN_count-records'](responseObject);
    }
    
    // Legacy support
    if (watchConfig.jsCode.includes('monthly-sum') || watchConfig.jsCode.includes('PRICE_DATA')) {
      console.log('Using legacy monthly-sum function');
      return SAFE_FUNCTIONS['BUILDIN_birdeye-metrics'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('simple-log')) {
      console.log('Using legacy simple-log function');
      return SAFE_FUNCTIONS['BUILDIN_simple-log'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('count-records')) {
      console.log('Using legacy count-records function');
      return SAFE_FUNCTIONS['BUILDIN_count-records'](responseObject);
    }
    
    console.log('No matching predefined function found, returning basic summary');
    return `Request processed:
URL: ${responseObject.url}
Status: ${responseObject.status}
Method: ${responseObject.method}
Note: Use predefined functions like 'BUILDIN_birdeye-metrics' for data processing.
Tip: Start proxy server (node proxy-server.js) for full response body access.`;
    
  } catch (error) {
    console.error('Code execution error:', error);
    return 'Execution error: ' + error.message;
  }
}

// Handle intercepted requests from content script
async function handleInterceptedRequest(requestData) {
  if (!isWatching) return;
  
  if (!matchesEndpoint(requestData.url, requestData.method)) {
    return;
  }
  
  try {
    const responseObject = {
      url: requestData.url,
      method: requestData.method,
      status: requestData.status,
      headers: requestData.headers || {},
      body: requestData.body,
      requestData: requestData.requestData || requestData.requestOptions
    };
    
    const result = await executeUserCodeSimple(responseObject);
    
    const resultEntry = {
      timestamp: Date.now(),
      url: requestData.url,
      method: requestData.method,
      status: requestData.status,
      result: result
    };
    
    results.unshift(resultEntry);
    results = results.slice(0, 50);
    
    await chrome.storage.local.set({ results: results });
    notifyPopup('newResult', resultEntry);
    
  } catch (error) {
    console.error('Error processing intercepted request:', error);
    
    const errorEntry = {
      timestamp: Date.now(),
      url: requestData.url,
      method: requestData.method,
      status: requestData.status,
      result: 'Error: ' + error.message
    };
    
    results.unshift(errorEntry);
    results = results.slice(0, 50);
    
    await chrome.storage.local.set({ results: results });
    notifyPopup('newResult', errorEntry);
  }
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
