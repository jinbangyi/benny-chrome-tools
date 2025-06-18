// background.js - Service worker that handles HTTP request monitoring

// Import safe functions
importScripts('safe-functions.js');

// Logging system
let extensionLogs = [];
const MAX_LOGS = 1000; // Maximum number of logs to keep

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
  
  // Keep only the last MAX_LOGS entries
  if (extensionLogs.length > MAX_LOGS) {
    extensionLogs = extensionLogs.slice(-MAX_LOGS);
  }
  
  // Save to storage periodically (every 10 logs)
  if (extensionLogs.length % 10 === 0) {
    chrome.storage.local.set({ extensionLogs: extensionLogs }).catch(err => {
      originalConsole.error('Failed to save logs to storage:', err);
    });
  }
  
  // Call original console method
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

// Initialize when extension starts
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

async function initialize() {
  console.log('Extension initializing...');
  try {
    const stored = await chrome.storage.local.get(['isWatching', 'endpoint', 'method', 'jsCode', 'results']);
    console.log('Loaded stored configuration:', stored);
    
    if (stored.isWatching) {
      watchConfig.endpoint = stored.endpoint || '';
      watchConfig.method = stored.method || '*';
      watchConfig.jsCode = stored.jsCode || '';
      results = stored.results || [];
      console.log('Restoring watch state with config:', watchConfig);
      startRequestMonitoring();
    } else {
      console.log('Extension not previously watching, starting fresh');
    }
  } catch (error) {
    console.error('Error initializing:', error);
  }
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startWatching':
      startWatching(message);
      break;
    case 'stopWatching':
      stopWatching();
      break;
    case 'clearResults':
      clearResults();
      break;
    case 'httpRequestIntercepted':
      handleInterceptedRequest(message.data);
      break;
    case 'addLog':
      handleLogFromContentScript(message.logEntry);
      break;
  }
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

  startRequestMonitoring();
  
  console.log('Request monitoring started successfully');
  
  // Notify popup
  notifyPopup('statusUpdate', { isWatching: true });
}

// Stop watching for requests
async function stopWatching() {
  console.log('Stopping request monitoring');
  
  isWatching = false;
  
  // Save state
  await chrome.storage.local.set({ isWatching: false });
  
  stopRequestMonitoring();
  
  console.log('Request monitoring stopped');
  
  // Notify popup
  notifyPopup('statusUpdate', { isWatching: false });
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

// Handle request start
function handleRequest(details) {
  if (!isWatching) return;
  
  console.log('Intercepting request:', details.method, details.url);
  
  requestData.set(details.requestId, {
    url: details.url,
    method: details.method,
    requestBody: details.requestBody,
    timestamp: Date.now()
  });
  
  console.log('Stored request data for ID:', details.requestId);
}

// Handle request completion
async function handleResponse(details) {
  if (!isWatching) return;
  
  console.log('Handling response for:', details.url, 'Status:', details.statusCode);
  
  const requestInfo = requestData.get(details.requestId);
  if (!requestInfo) {
    console.log('No request info found for ID:', details.requestId);
    return;
  }

  // Clean up
  requestData.delete(details.requestId);

  // Check if this request matches our endpoint
  if (!matchesEndpoint(requestInfo.url, requestInfo.method)) {
    console.log('Request does not match endpoint pattern:', requestInfo.url);
    return;
  }

  console.log('Request matches endpoint! Processing...', requestInfo.url);

  try {
    // Get response body
    const responseBody = await getResponseBody(details.tabId, details.url);
    
    // Prepare response object for user function
    const responseObject = {
      url: requestInfo.url,
      method: requestInfo.method,
      status: details.statusCode,
      headers: details.responseHeaders || [],
      body: responseBody,
      requestBody: requestInfo.requestBody
    };
    
    // Execute user's JavaScript code
    const result = await executeUserCode(responseObject, details.tabId);
    
    // Store result
    const resultEntry = {
      timestamp: Date.now(),
      url: requestInfo.url,
      method: requestInfo.method,
      status: details.statusCode,
      result: result
    };
    
    results.unshift(resultEntry); // Add to beginning
    results = results.slice(0, 50); // Keep only last 50 results
    
    // Save results
    await chrome.storage.local.set({ results: results });
    
    // Notify popup
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
  
  // Check method
  if (watchConfig.method !== '*' && watchConfig.method !== method) {
    return false;
  }
  
  // Check URL (support wildcards)
  const endpointPattern = watchConfig.endpoint
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\\\*/g, '.*'); // Convert * to .*
  
  const regex = new RegExp(endpointPattern, 'i');
  return regex.test(url);
}

// Get response body by using intercepted data from content script
async function getResponseBody(tabId, url) {
  try {
    console.log('Attempting to get response body for:', url);
    
    // Since webRequest API has limitations, we rely on content script interception
    // Return a message indicating to check intercepted requests
    return { 
      message: 'Response body from webRequest API is limited. Using content script interception for full response data.',
      url: url,
      note: 'Check intercepted requests for complete response data'
    };
  } catch (error) {
    console.error('Error getting response body:', error);
    return { error: 'Could not access response body', details: error.message };
  }
}

// Execute user's JavaScript code safely
async function executeUserCode(responseObject, tabId) {
  try {
    // Check if the code is one of our predefined safe functions
    if (watchConfig.jsCode.includes('BUILDIN_birdeye-metrics')) {
      return SAFE_FUNCTIONS['BUILDIN_birdeye-metrics'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('BUILDIN_simple-log')) {
      return SAFE_FUNCTIONS['BUILDIN_simple-log'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('BUILDIN_count-records')) {
      return SAFE_FUNCTIONS['BUILDIN_count-records'](responseObject);
    }
    
    // For custom code, try to inject it safely in the page context
    if (tabId && tabId !== -1) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (responseData, userCode) => {
          try {
            // Create a safe execution environment
            const func = new Function('response', userCode + '\nreturn index(response);');
            return func(responseData);
          } catch (error) {
            return 'Error: ' + error.message;
          }
        },
        args: [responseObject, watchConfig.jsCode]
      });
      
      return results[0].result;
    } else {
      return `Custom code execution not available for this request type.
URL: ${responseObject.url}
Status: ${responseObject.status}
Method: ${responseObject.method}

Use predefined functions like 'monthly-sum' for better compatibility.`;
    }
    
  } catch (error) {
    return 'Execution error: ' + error.message;
  }
}

// Simpler execution for intercepted requests (no tab context)
async function executeUserCodeSimple(responseObject) {
  try {
    console.log('Executing simple user code for intercepted request:', responseObject.url);
    
    // Check for new BUILDIN_ naming convention
    if (watchConfig.jsCode.includes('BUILDIN_birdeye-metrics')) {
      console.log('Using BUILDIN_birdeye-metrics function for intercepted request');
      return SAFE_FUNCTIONS['BUILDIN_birdeye-metrics'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('BUILDIN_simple-log')) {
      console.log('Using BUILDIN_simple-log function for intercepted request');
      return SAFE_FUNCTIONS['BUILDIN_simple-log'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('BUILDIN_count-records')) {
      console.log('Using BUILDIN_count-records function for intercepted request');
      return SAFE_FUNCTIONS['BUILDIN_count-records'](responseObject);
    }
    
    // Legacy support for old naming
    if (watchConfig.jsCode.includes('monthly-sum') || watchConfig.jsCode.includes('PRICE_DATA')) {
      console.log('Using legacy monthly-sum function for intercepted request');
      return SAFE_FUNCTIONS['BUILDIN_birdeye-metrics'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('simple-log')) {
      console.log('Using legacy simple-log function for intercepted request');
      return SAFE_FUNCTIONS['BUILDIN_simple-log'](responseObject);
    }
    
    if (watchConfig.jsCode.includes('count-records')) {
      console.log('Using legacy count-records function for intercepted request');
      return SAFE_FUNCTIONS['BUILDIN_count-records'](responseObject);
    }
    
    // For other code, return a basic summary
    console.log('No matching predefined function found, returning basic summary');
    return `Request intercepted:
URL: ${responseObject.url}
Status: ${responseObject.status}
Method: ${responseObject.method}
Data preview: ${JSON.stringify(responseObject.body).substring(0, 200)}...

Note: Use predefined functions like 'BUILDIN_birdeye-metrics' for data processing.`;
    
  } catch (error) {
    console.error('Simple execution error:', error);
    return 'Simple execution error: ' + error.message;
  }
}

// Handle intercepted requests from content script
async function handleInterceptedRequest(requestData) {
  if (!isWatching) return;
  
  // Check if this request matches our endpoint
  if (!matchesEndpoint(requestData.url, requestData.method)) {
    return;
  }
  
  try {
    // Prepare response object for user function
    const responseObject = {
      url: requestData.url,
      method: requestData.method,
      status: requestData.status,
      headers: requestData.headers || {},
      body: requestData.body,
      requestData: requestData.requestData || requestData.requestOptions
    };
    
    // Execute user's JavaScript code - note: no tabId available for intercepted requests
    // Use a simpler approach for intercepted requests
    const result = await executeUserCodeSimple(responseObject);
    
    // Store result
    const resultEntry = {
      timestamp: Date.now(),
      url: requestData.url,
      method: requestData.method,
      status: requestData.status,
      result: result
    };
    
    results.unshift(resultEntry); // Add to beginning
    results = results.slice(0, 50); // Keep only last 50 results
    
    // Save results
    await chrome.storage.local.set({ results: results });
    
    // Notify popup
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
  
  // Keep only the last MAX_LOGS entries
  if (extensionLogs.length > MAX_LOGS) {
    extensionLogs = extensionLogs.slice(-MAX_LOGS);
  }
  
  // Save to storage
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
