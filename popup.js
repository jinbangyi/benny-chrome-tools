// popup.js - Handles the extension popup interface

// Setup logging for popup
function setupPopupLogging() {
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
      source: 'popup',
      message: message
    };
    
    // Get existing logs and add new entry
    chrome.storage.local.get(['extensionLogs']).then(result => {
      const logs = result.extensionLogs || [];
      logs.push(logEntry);
      
      // Keep only the last 1000 entries
      const trimmedLogs = logs.slice(-1000);
      
      chrome.storage.local.set({ extensionLogs: trimmedLogs }).catch(err => {
        originalConsole.error('Failed to save popup logs:', err);
      });
    }).catch(err => {
      originalConsole.error('Failed to get existing logs:', err);
    });
    
    // Call original console method
    originalConsole[level](`[POPUP]`, ...args);
  }

  // Override console methods
  console.log = (...args) => logToStorage('info', ...args);
  console.error = (...args) => logToStorage('error', ...args);
  console.warn = (...args) => logToStorage('warn', ...args);
  console.info = (...args) => logToStorage('info', ...args);
  console.debug = (...args) => logToStorage('debug', ...args);
}

// Initialize logging
setupPopupLogging();

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded and ready');
  
  const endpointInput = document.getElementById('endpoint');
  const methodSelect = document.getElementById('method');
  const jsCodeTextarea = document.getElementById('jsCode');
  const startButton = document.getElementById('startWatching');
  const stopButton = document.getElementById('stopWatching');
  const clearButton = document.getElementById('clearResults');
  const viewLogsButton = document.getElementById('viewLogs');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');

  // Load saved configuration
  loadConfiguration();

  // Event listeners
  startButton.addEventListener('click', startWatching);
  stopButton.addEventListener('click', stopWatching);
  clearButton.addEventListener('click', clearResults);
  viewLogsButton.addEventListener('click', openLogsPage);

  // Load configuration from storage
  async function loadConfiguration() {
    try {
      const result = await chrome.storage.local.get([
        'endpoint', 
        'method', 
        'jsCode', 
        'isWatching',
        'results'
      ]);
      
      if (result.endpoint) endpointInput.value = result.endpoint;
      if (result.method) methodSelect.value = result.method;
      if (result.jsCode) jsCodeTextarea.value = result.jsCode;
      
      updateStatus(result.isWatching || false);
      displayResults(result.results || []);
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  }

  // Save configuration to storage
  async function saveConfiguration() {
    try {
      await chrome.storage.local.set({
        endpoint: endpointInput.value,
        method: methodSelect.value,
        jsCode: jsCodeTextarea.value
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  }

  // Start watching for requests
  async function startWatching() {
    console.log('User clicked Start Watching button');
    
    const endpoint = endpointInput.value.trim();
    const jsCode = jsCodeTextarea.value.trim();

    console.log('Validating input - endpoint:', endpoint, 'jsCode length:', jsCode.length);

    if (!endpoint) {
      console.warn('No endpoint provided by user');
      alert('Please enter an endpoint to watch');
      return;
    }

    if (!jsCode) {
      console.warn('No JavaScript code provided by user');
      alert('Please enter JavaScript code with an index function');
      return;
    }

    // Validate JavaScript code has index function
    if (!jsCode.includes('function index(')) {
      console.warn('JavaScript code does not contain index function');
      alert('JavaScript code must contain a function named "index"');
      return;
    }

    console.log('Input validation passed, saving configuration and starting watch');

    await saveConfiguration();
    
    // Send message to background script to start watching
    chrome.runtime.sendMessage({
      action: 'startWatching',
      endpoint: endpoint,
      method: methodSelect.value,
      jsCode: jsCode
    });

    updateStatus(true);
  }

  // Stop watching for requests
  async function stopWatching() {
    chrome.runtime.sendMessage({ action: 'stopWatching' });
    updateStatus(false);
  }

  // Open logs page
  function openLogsPage() {
    console.log('Opening logs page');
    chrome.tabs.create({
      url: chrome.runtime.getURL('logs.html')
    }).catch(error => {
      console.error('Failed to open logs page:', error);
      alert('Failed to open logs page. Please try again.');
    });
  }

  // Clear results
  async function clearResults() {
    console.log('Clearing results');
    chrome.runtime.sendMessage({ action: 'clearResults' });
    displayResults([]);
  }

  // Update status display
  function updateStatus(isWatching) {
    if (isWatching) {
      statusDiv.textContent = 'Status: Active - Watching for requests';
      statusDiv.className = 'status active';
      startButton.disabled = true;
      stopButton.disabled = false;
    } else {
      statusDiv.textContent = 'Status: Inactive';
      statusDiv.className = 'status inactive';
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  }

  // Display results
  function displayResults(results) {
    if (!results || results.length === 0) {
      resultsDiv.innerHTML = 'No results yet...';
      return;
    }

    resultsDiv.innerHTML = results.map(result => {
      const timeStr = new Date(result.timestamp).toLocaleTimeString();
      return `
        <div class="result-item">
          <div class="result-time">${timeStr}</div>
          <div><strong>URL:</strong> ${result.url}</div>
          <div><strong>Method:</strong> ${result.method}</div>
          <div><strong>Status:</strong> ${result.status}</div>
          <div><strong>Result:</strong> ${escapeHtml(String(result.result))}</div>
        </div>
      `;
    }).join('');
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'statusUpdate') {
      updateStatus(message.isWatching);
    } else if (message.action === 'newResult') {
      loadConfiguration(); // Reload to get updated results
    }
  });
});
