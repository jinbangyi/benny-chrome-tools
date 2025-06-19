// Popup script for Network Monitor Extension

class NetworkMonitorPopup {
  constructor() {
    this.isMonitoring = false;
    this.currentTabId = null;
    this.stats = {
      rules: 0,
      events: 0
    };

    this.init();
  }

  async init() {
    await this.getCurrentTab();
    this.setupEventListeners();
    await this.loadStats();
    this.updateUI();
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTabId = tab.id;
      document.getElementById('tabInfo').textContent = `Tab: ${tab.title}`;
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => this.startMonitoring());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopMonitoring());
    document.getElementById('openDevTools').addEventListener('click', () => this.openDevTools());
    document.getElementById('testConnection').addEventListener('click', () => this.testConnection());
  }

  async loadStats() {
    try {
      // Get rules count
      const rulesResponse = await chrome.runtime.sendMessage({ action: 'getRules' });
      if (rulesResponse.rules) {
        this.stats.rules = rulesResponse.rules.length;
      }

      // Events count would need to be tracked separately
      // For now, we'll show 0 as events are not persisted in the background
      this.stats.events = 0;
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async startMonitoring() {
    if (!this.currentTabId) {
      alert('No active tab found');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'startMonitoring',
        tabId: this.currentTabId
      });
      
      this.isMonitoring = true;
      this.updateUI();
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      alert('Failed to start monitoring: ' + error.message);
    }
  }

  async stopMonitoring() {
    if (!this.currentTabId) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'stopMonitoring',
        tabId: this.currentTabId
      });
      
      this.isMonitoring = false;
      this.updateUI();
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
      alert('Failed to stop monitoring: ' + error.message);
    }
  }

  openDevTools() {
    // This will open DevTools, but the user needs to navigate to the Network Monitor tab manually
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            // This is a workaround - we can't programmatically open DevTools
            // But we can show an alert with instructions
            alert('Please open DevTools (F12) and navigate to the "Network Monitor" tab');
          }
        });
      }
    });
  }

  async testConnection() {
    try {
      const configResponse = await chrome.runtime.sendMessage({ action: 'getServerConfig' });
      const config = configResponse.config || { host: 'localhost', port: 3000, endpoint: '/network-events' };
      
      const testUrl = `http://${config.host}:${config.port}${config.endpoint}`;
      
      // Test connection with a simple ping
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: true,
          timestamp: Date.now(),
          message: 'Connection test from Network Monitor Extension'
        })
      });

      if (response.ok) {
        alert(`✅ Connection successful!\nServer: ${testUrl}\nStatus: ${response.status}`);
      } else {
        alert(`❌ Connection failed!\nServer: ${testUrl}\nStatus: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      alert(`❌ Connection failed!\nError: ${error.message}\n\nMake sure your server is running and accessible.`);
    }
  }

  updateUI() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');

    if (this.isMonitoring) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      status.textContent = 'Active';
      status.className = 'status active';
    } else {
      startBtn.disabled = false;
      stopBtn.disabled = true;
      status.textContent = 'Inactive';
      status.className = 'status inactive';
    }

    // Update stats
    document.getElementById('rulesCount').textContent = this.stats.rules;
    document.getElementById('eventsCount').textContent = this.stats.events;
  }
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  new NetworkMonitorPopup();
});