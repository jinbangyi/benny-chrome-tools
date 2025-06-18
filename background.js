// background.js - Service worker that handles HTTP request monitoring

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
  try {
    const stored = await chrome.storage.local.get(['isWatching', 'endpoint', 'method', 'jsCode', 'results']);
    if (stored.isWatching) {
      watchConfig.endpoint = stored.endpoint || '';
      watchConfig.method = stored.method || '*';
      watchConfig.jsCode = stored.jsCode || '';
      results = stored.results || [];
      startRequestMonitoring();
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
  }
});

// Start watching for requests
async function startWatching(config) {
  watchConfig = {
    endpoint: config.endpoint,
    method: config.method,
    jsCode: config.jsCode
  };
  
  isWatching = true;
  
  // Save state
  await chrome.storage.local.set({
    isWatching: true,
    endpoint: config.endpoint,
    method: config.method,
    jsCode: config.jsCode
  });

  startRequestMonitoring();
  
  // Notify popup
  notifyPopup('statusUpdate', { isWatching: true });
}

// Stop watching for requests
async function stopWatching() {
  isWatching = false;
  
  // Save state
  await chrome.storage.local.set({ isWatching: false });
  
  stopRequestMonitoring();
  
  // Notify popup
  notifyPopup('statusUpdate', { isWatching: false });
}

// Clear results
async function clearResults() {
  results = [];
  await chrome.storage.local.set({ results: [] });
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
  
  requestData.set(details.requestId, {
    url: details.url,
    method: details.method,
    requestBody: details.requestBody,
    timestamp: Date.now()
  });
}

// Handle request completion
async function handleResponse(details) {
  if (!isWatching) return;
  
  const requestInfo = requestData.get(details.requestId);
  if (!requestInfo) return;
  
  // Clean up
  requestData.delete(details.requestId);
  
  // Check if this request matches our endpoint
  if (!matchesEndpoint(requestInfo.url, requestInfo.method)) {
    return;
  }
  
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
    const result = await executeUserCode(responseObject);
    
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

// Get response body by injecting script into tab
async function getResponseBody(tabId, url) {
  try {
    // For security reasons, we can't directly access response bodies
    // This is a limitation of Chrome extensions
    // We'll return a placeholder for now
    return { message: 'Response body access is limited in Chrome extensions', url: url };
  } catch (error) {
    console.error('Error getting response body:', error);
    return { error: 'Could not access response body' };
  }
}

// Execute user's JavaScript code
async function executeUserCode(responseObject) {
  try {
    // Create a safe execution environment
    const userFunction = new Function('response', `
      ${watchConfig.jsCode}
      
      if (typeof index !== 'function') {
        throw new Error('index function not found');
      }
      
      return index(response);
    `);
    
    return userFunction(responseObject);
  } catch (error) {
    throw new Error('User code execution failed: ' + error.message);
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
    
    // Execute user's JavaScript code
    const result = await executeUserCode(responseObject);
    
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

// Notify popup of changes
function notifyPopup(action, data) {
  chrome.runtime.sendMessage({ action: action, ...data }).catch(() => {
    // Popup might not be open, ignore error
  });
}
