// Enhanced popup script with proxy server integration

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
    
    chrome.storage.local.get(['extensionLogs']).then(result => {
      const logs = result.extensionLogs || [];
      logs.push(logEntry);
      
      const trimmedLogs = logs.slice(-1000);
      
      chrome.storage.local.set({ extensionLogs: trimmedLogs }).catch(err => {
        originalConsole.error('Failed to save popup logs:', err);
      });
    }).catch(err => {
      originalConsole.error('Failed to get existing logs:', err);
    });
    
    originalConsole[level](`[POPUP]`, ...args);
  }

  console.log = (...args) => logToStorage('info', ...args);
  console.error = (...args) => logToStorage('error', ...args);
  console.warn = (...args) => logToStorage('warn', ...args);
  console.info = (...args) => logToStorage('info', ...args);
  console.debug = (...args) => logToStorage('debug', ...args);
}

// Initialize logging
setupPopupLogging();

// DOM elements
let statusDiv, proxyStatusDiv, endpointInput, methodSelect, jsCodeTextarea, 
    startButton, stopButton, clearButton, viewLogsButton, resultsDiv;

// State
let isWatching = false;
let proxyStatus = { isRunning: false };

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup DOM loaded, initializing...');
  
  // Get DOM elements
  statusDiv = document.getElementById('status');
  proxyStatusDiv = document.getElementById('proxy-status');
  endpointInput = document.getElementById('endpoint');
  methodSelect = document.getElementById('method');
  jsCodeTextarea = document.getElementById('jsCode');
  startButton = document.getElementById('startButton');
  stopButton = document.getElementById('stopButton');
  clearButton = document.getElementById('clearButton');
  viewLogsButton = document.getElementById('viewLogsButton');
  resultsDiv = document.getElementById('results');
  
  // Set up event listeners
  startButton.addEventListener('click', startWatching);
  stopButton.addEventListener('click', stopWatching);
  clearButton.addEventListener('click', clearResults);
  viewLogsButton.addEventListener('click', viewLogs);
  
  // Load saved state
  loadSavedState();
  
  // Check proxy server status
  checkProxyStatus();
  
  // Set up periodic status updates
  setInterval(updateStatus, 5000);
});

async function loadSavedState() {
  try {
    console.log('Loading saved state...');
    
    const result = await chrome.storage.local.get([
      'isWatching', 'endpoint', 'method', 'jsCode', 'results'
    ]);
    
    console.log('Loaded saved state:', result);
    
    isWatching = result.isWatching || false;
    endpointInput.value = result.endpoint || '';
    methodSelect.value = result.method || '*';
    jsCodeTextarea.value = result.jsCode || '';
    
    updateUI();
    displayResults(result.results || []);
    
  } catch (error) {
    console.error('Error loading saved state:', error);
  }
}

async function checkProxyStatus() {
  try {
    console.log('Checking proxy server status...');
    
    const response = await chrome.runtime.sendMessage({ action: 'getProxyStatus' });
    
    if (response && response.status) {
      proxyStatus = response.status;
      updateProxyStatusUI();
      console.log('Proxy status updated:', proxyStatus);
    }
  } catch (error) {
    console.error('Error checking proxy status:', error);
    proxyStatus = { isRunning: false, error: error.message };
    updateProxyStatusUI();
  }
}

function updateProxyStatusUI() {
  if (!proxyStatusDiv) return;
  
  if (proxyStatus.isRunning) {
    proxyStatusDiv.className = 'proxy-status proxy-running';
    proxyStatusDiv.innerHTML = `
      ✅ Proxy Server Running (Port: ${proxyStatus.port || 8080})
      <br><small>Enhanced response body access enabled</small>
    `;
  } else {
    proxyStatusDiv.className = 'proxy-status proxy-stopped';
    proxyStatusDiv.innerHTML = `
      ❌ Proxy Server Not Running
      <br><small>Limited to webRequest API (no response body access)</small>
      <br><small>Run: <code>node proxy-server.js</code> for full features</small>
    `;
  }
}

async function startWatching() {
  const endpoint = endpointInput.value.trim();
  const method = methodSelect.value;
  const jsCode = jsCodeTextarea.value.trim();
  
  if (!endpoint) {
    alert('Please enter an endpoint to watch');
    return;
  }
  
  if (!jsCode) {
    alert('Please enter some JavaScript code to execute');
    return;
  }
  
  console.log('Starting to watch endpoint:', endpoint);
  
  try {
    await chrome.runtime.sendMessage({
      action: 'startWatching',
      endpoint: endpoint,
      method: method,
      jsCode: jsCode
    });
    
    isWatching = true;
    updateUI();
    
    console.log('Successfully started watching');
    
    // Refresh proxy status
    await checkProxyStatus();
    
  } catch (error) {
    console.error('Error starting to watch:', error);
    alert('Error starting to watch: ' + error.message);
  }
}

async function stopWatching() {
  console.log('Stopping watch...');
  
  try {
    await chrome.runtime.sendMessage({ action: 'stopWatching' });
    
    isWatching = false;
    updateUI();
    
    console.log('Successfully stopped watching');
    
  } catch (error) {
    console.error('Error stopping watch:', error);
    alert('Error stopping watch: ' + error.message);
  }
}

async function clearResults() {
  console.log('Clearing results...');
  
  try {
    await chrome.runtime.sendMessage({ action: 'clearResults' });
    
    displayResults([]);
    
    console.log('Successfully cleared results');
    
  } catch (error) {
    console.error('Error clearing results:', error);
    alert('Error clearing results: ' + error.message);
  }
}

function viewLogs() {
  console.log('Opening logs viewer...');
  chrome.tabs.create({
    url: chrome.runtime.getURL('logs.html')
  });
}

function updateUI() {
  if (isWatching) {
    statusDiv.textContent = 'Status: Watching for requests';
    statusDiv.className = 'status active';
    startButton.disabled = true;
    stopButton.disabled = false;
    endpointInput.disabled = true;
    methodSelect.disabled = true;
    jsCodeTextarea.disabled = true;
  } else {
    statusDiv.textContent = 'Status: Inactive';
    statusDiv.className = 'status inactive';
    startButton.disabled = false;
    stopButton.disabled = true;
    endpointInput.disabled = false;
    methodSelect.disabled = false;
    jsCodeTextarea.disabled = false;
  }
}

async function updateStatus() {
  try {
    // Get results from background script (includes proxy results)
    const response = await chrome.runtime.sendMessage({ action: 'getResults' });
    
    if (response && response.results) {
      displayResults(response.results);
    }
    
    // Update proxy status periodically
    if (Date.now() % 30000 < 5000) { // Every 30 seconds, within 5 second window
      await checkProxyStatus();
    }
    
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

function displayResults(results) {
  if (!resultsDiv) return;
  
  if (results.length === 0) {
    resultsDiv.innerHTML = '<p>No results yet. Waiting for matching requests...</p>';
    return;
  }
  
  resultsDiv.innerHTML = results.slice(0, 10).map(result => {
    const timestamp = new Date(result.timestamp).toLocaleTimeString();
    const resultText = typeof result.result === 'object' 
      ? JSON.stringify(result.result, null, 2) 
      : result.result;
    
    return `
      <div class="result-item">
        <div class="result-meta">
          <span class="time">${timestamp}</span>
          <span class="method">${result.method}</span>
          <span class="status">Status: ${result.status}</span>
        </div>
        <div class="url">${result.url}</div>
        <div class="result-content">
          <pre>${resultText}</pre>
        </div>
      </div>
    `;
  }).join('');
}

// Listen for background script messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'statusUpdate':
      console.log('Received status update:', message);
      isWatching = message.isWatching;
      if (message.proxyStatus) {
        proxyStatus = message.proxyStatus;
        updateProxyStatusUI();
      }
      updateUI();
      break;
    case 'newResult':
      console.log('Received new result:', message);
      updateStatus(); // Refresh results display
      break;
  }
});

// Handle popup example clicks
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('example-link')) {
    e.preventDefault();
    const example = e.target.dataset.example;
    
    switch (example) {
      case 'birdeye-metrics':
        endpointInput.value = 'https://api.birdeye.so/defi/v3/charts/token/*';
        methodSelect.value = 'GET';
        jsCodeTextarea.value = 'BUILDIN_birdeye-metrics';
        break;
      case 'simple-log':
        endpointInput.value = 'https://api.example.com/*';
        methodSelect.value = '*';
        jsCodeTextarea.value = 'BUILDIN_simple-log';
        break;
      case 'count-records':
        endpointInput.value = 'https://api.example.com/data';
        methodSelect.value = 'GET';
        jsCodeTextarea.value = 'BUILDIN_count-records';
        break;
    }
    
    console.log('Applied example:', example);
  }
});

console.log('Popup script loaded successfully');
