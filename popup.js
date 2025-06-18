// popup.js - Handles the extension popup interface

document.addEventListener('DOMContentLoaded', function() {
  const endpointInput = document.getElementById('endpoint');
  const methodSelect = document.getElementById('method');
  const jsCodeTextarea = document.getElementById('jsCode');
  const startButton = document.getElementById('startWatching');
  const stopButton = document.getElementById('stopWatching');
  const clearButton = document.getElementById('clearResults');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');

  // Load saved configuration
  loadConfiguration();

  // Event listeners
  startButton.addEventListener('click', startWatching);
  stopButton.addEventListener('click', stopWatching);
  clearButton.addEventListener('click', clearResults);

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
    const endpoint = endpointInput.value.trim();
    const jsCode = jsCodeTextarea.value.trim();

    if (!endpoint) {
      alert('Please enter an endpoint to watch');
      return;
    }

    if (!jsCode) {
      alert('Please enter JavaScript code with an index function');
      return;
    }

    // Validate JavaScript code has index function
    try {
      const testCode = jsCode + '\nif (typeof index !== "function") throw new Error("index function not found");';
      new Function(testCode)();
    } catch (error) {
      alert('JavaScript code must contain a function named "index": ' + error.message);
      return;
    }

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

  // Clear results
  async function clearResults() {
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
