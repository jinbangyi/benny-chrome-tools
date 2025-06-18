// content.js - Content script for enhanced HTTP monitoring
// This script helps capture more detailed request/response information

// Setup logging for content script
function setupContentLogging() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };

  function logToStorage(level, ...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    const logEntry = {
      timestamp: Date.now(),
      level: level,
      source: 'content',
      message: message
    };
    
    // Send to background script to handle storage
    chrome.runtime.sendMessage({
      action: 'addLog',
      logEntry: logEntry
    }).catch(() => {
      // Extension might not be ready, use original console
      originalConsole[level](`[CONTENT]`, ...args);
    });
    
    // Call original console method
    originalConsole[level](`[CONTENT]`, ...args);
  }

  // Override console methods
  console.log = (...args) => logToStorage('info', ...args);
  console.error = (...args) => logToStorage('error', ...args);
  console.warn = (...args) => logToStorage('warn', ...args);
  console.info = (...args) => logToStorage('info', ...args);
  console.debug = (...args) => logToStorage('debug', ...args);
}

// Initialize logging
setupContentLogging();

// Enhanced request monitoring using fetch and XMLHttpRequest interception
(function() {
  'use strict';
  
  console.log('Content script loaded and monitoring HTTP requests');
  
  // Store original functions
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  // Intercept fetch requests
  window.fetch = async function(...args) {
    const [url, options = {}] = args;
    
    try {
      const response = await originalFetch.apply(this, args);
      
      // Clone response to read body without consuming it
      const responseClone = response.clone();
      let responseBody = null;
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseBody = await responseClone.json();
        } else {
          responseBody = await responseClone.text();
        }
      } catch (e) {
        responseBody = '[Could not parse response body]';
      }
      
      // Send to extension
      window.postMessage({
        type: 'HTTP_REQUEST_INTERCEPTED',
        data: {
          url: url,
          method: options.method || 'GET',
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          requestOptions: options
        }
      }, '*');
      
      return response;
    } catch (error) {
      console.error('Fetch interception error:', error);
      throw error;
    }
  };
  
  // Intercept XMLHttpRequest
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._interceptedData = {
      method: method,
      url: url
    };
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    const xhr = this;
    
    // Store original onreadystatechange
    const originalOnReadyStateChange = xhr.onreadystatechange;
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) { // Request completed
        try {
          let responseBody = xhr.responseText;
          
          // Try to parse as JSON
          try {
            responseBody = JSON.parse(xhr.responseText);
          } catch (e) {
            // Keep as text if not JSON
          }
          
          // Send to extension
          window.postMessage({
            type: 'HTTP_REQUEST_INTERCEPTED',
            data: {
              url: xhr._interceptedData?.url || '',
              method: xhr._interceptedData?.method || 'GET',
              status: xhr.status,
              statusText: xhr.statusText,
              headers: parseResponseHeaders(xhr.getAllResponseHeaders()),
              body: responseBody,
              requestData: data
            }
          }, '*');
          
        } catch (error) {
          console.error('XHR interception error:', error);
        }
      }
      
      // Call original handler
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, arguments);
      }
    };
    
    return originalXHRSend.apply(this, [data]);
  };
  
  // Helper function to parse response headers
  function parseResponseHeaders(headerString) {
    const headers = {};
    if (headerString) {
      headerString.split('\r\n').forEach(line => {
        const parts = line.split(': ');
        if (parts.length === 2) {
          headers[parts[0]] = parts[1];
        }
      });
    }
    return headers;
  }
  
  // Listen for messages from the page
  window.addEventListener('message', function(event) {
    if (event.source !== window || event.data.type !== 'HTTP_REQUEST_INTERCEPTED') {
      return;
    }
    
    // Forward to background script
    chrome.runtime.sendMessage({
      action: 'httpRequestIntercepted',
      data: event.data.data
    }).catch(() => {
      // Extension might not be ready, ignore error
    });
  });
  
})();
