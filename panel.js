// Panel script for Network Monitor Extension

class NetworkMonitorPanel {
  constructor() {
    this.isMonitoring = false;
    this.rules = [];
    this.events = [];
    this.serverConfig = {
      host: 'localhost',
      port: 3000,
      endpoint: '/network-events'
    };

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadConfiguration();
    this.updateUI();
  }

  setupEventListeners() {
    // Control buttons
    document.getElementById('startBtn').addEventListener('click', () => this.startMonitoring());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopMonitoring());
    
    // Configuration
    document.getElementById('saveConfigBtn').addEventListener('click', () => this.saveServerConfig());
    
    // Rules management
    document.getElementById('addRuleBtn').addEventListener('click', () => this.addRule());
    
    // Events management
    document.getElementById('clearEventsBtn').addEventListener('click', () => this.clearEvents());

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'networkEvent') {
        this.addEvent(message.data);
      }
    });

    // Listen for panel visibility changes
    window.addEventListener('message', (event) => {
      if (event.data.type === 'PANEL_SHOWN') {
        this.refreshData();
      }
    });
  }

  async loadConfiguration() {
    try {
      // Load rules
      const rulesResponse = await chrome.runtime.sendMessage({ action: 'getRules' });
      if (rulesResponse.rules) {
        this.rules = rulesResponse.rules;
      }

      // Load server config
      const configResponse = await chrome.runtime.sendMessage({ action: 'getServerConfig' });
      if (configResponse.config) {
        this.serverConfig = configResponse.config;
        this.updateServerConfigUI();
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  updateServerConfigUI() {
    document.getElementById('serverHost').value = this.serverConfig.host;
    document.getElementById('serverPort').value = this.serverConfig.port;
    document.getElementById('serverEndpoint').value = this.serverConfig.endpoint;
  }

  async saveServerConfig() {
    const host = document.getElementById('serverHost').value.trim();
    const port = parseInt(document.getElementById('serverPort').value);
    const endpoint = document.getElementById('serverEndpoint').value.trim();

    if (!host || !port || !endpoint) {
      alert('Please fill in all server configuration fields');
      return;
    }

    this.serverConfig = { host, port, endpoint };

    try {
      await chrome.runtime.sendMessage({
        action: 'updateServerConfig',
        config: this.serverConfig
      });
      alert('Server configuration saved successfully');
    } catch (error) {
      console.error('Failed to save server config:', error);
      alert('Failed to save server configuration');
    }
  }

  async startMonitoring() {
    try {
      const tabId = chrome.devtools.inspectedWindow.tabId;
      await chrome.runtime.sendMessage({
        action: 'startMonitoring',
        tabId: tabId
      });
      
      this.isMonitoring = true;
      this.updateUI();
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      alert('Failed to start monitoring: ' + error.message);
    }
  }

  async stopMonitoring() {
    try {
      const tabId = chrome.devtools.inspectedWindow.tabId;
      await chrome.runtime.sendMessage({
        action: 'stopMonitoring',
        tabId: tabId
      });
      
      this.isMonitoring = false;
      this.updateUI();
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
      alert('Failed to stop monitoring: ' + error.message);
    }
  }

  async addRule() {
    const name = document.getElementById('ruleName').value.trim();
    const type = document.getElementById('ruleType').value;
    const pattern = document.getElementById('rulePattern').value.trim();
    const flags = document.getElementById('ruleFlags').value.trim();

    if (!name || !pattern) {
      alert('Please provide both rule name and pattern');
      return;
    }

    const rule = {
      id: Date.now().toString(),
      name,
      type,
      pattern,
      flags: flags || undefined,
      enabled: true,
      created: new Date().toISOString()
    };

    this.rules.push(rule);

    try {
      await chrome.runtime.sendMessage({
        action: 'updateRules',
        rules: this.rules
      });

      // Clear form
      document.getElementById('ruleName').value = '';
      document.getElementById('rulePattern').value = '';
      document.getElementById('ruleFlags').value = '';

      this.updateRulesUI();
    } catch (error) {
      console.error('Failed to add rule:', error);
      alert('Failed to add rule: ' + error.message);
    }
  }

  async removeRule(ruleId) {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);

    try {
      await chrome.runtime.sendMessage({
        action: 'updateRules',
        rules: this.rules
      });
      this.updateRulesUI();
    } catch (error) {
      console.error('Failed to remove rule:', error);
      alert('Failed to remove rule: ' + error.message);
    }
  }

  async toggleRule(ruleId) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;

      try {
        await chrome.runtime.sendMessage({
          action: 'updateRules',
          rules: this.rules
        });
        this.updateRulesUI();
      } catch (error) {
        console.error('Failed to toggle rule:', error);
        alert('Failed to toggle rule: ' + error.message);
      }
    }
  }

  addEvent(eventData) {
    this.events.unshift(eventData);
    
    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(0, 100);
    }

    this.updateEventsUI();
  }

  clearEvents() {
    this.events = [];
    this.updateEventsUI();
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

    this.updateRulesUI();
    this.updateEventsUI();
  }

  updateRulesUI() {
    const rulesList = document.getElementById('rulesList');
    
    if (this.rules.length === 0) {
      rulesList.innerHTML = '<div class="no-rules">No monitoring rules configured</div>';
      return;
    }

    const rulesHTML = this.rules.map(rule => `
      <div class="rule-item">
        <div class="rule-header">
          <div class="rule-name">${this.escapeHtml(rule.name)}</div>
          <div class="rule-actions">
            <button class="btn btn-secondary" onclick="panel.toggleRule('${rule.id}')" style="padding: 4px 8px; font-size: 12px;">
              ${rule.enabled ? 'Disable' : 'Enable'}
            </button>
            <button class="btn btn-danger" onclick="panel.removeRule('${rule.id}')" style="padding: 4px 8px; font-size: 12px;">
              Remove
            </button>
          </div>
        </div>
        <div class="rule-details">
          <strong>Type:</strong> ${rule.type} | 
          <strong>Pattern:</strong> ${this.escapeHtml(rule.pattern)} |
          <strong>Status:</strong> ${rule.enabled ? 'Enabled' : 'Disabled'}
          ${rule.flags ? ` | <strong>Flags:</strong> ${rule.flags}` : ''}
        </div>
      </div>
    `).join('');

    rulesList.innerHTML = rulesHTML;
  }

  updateEventsUI() {
    const eventsList = document.getElementById('eventsList');
    const eventCount = document.getElementById('eventCount');
    
    eventCount.textContent = `${this.events.length} events`;

    if (this.events.length === 0) {
      eventsList.innerHTML = '<div class="no-events">No events captured yet</div>';
      return;
    }

    const eventsHTML = this.events.map(event => `
      <div class="event-item">
        <div class="event-url">${this.escapeHtml(event.url)}</div>
        <div class="event-details">
          <strong>Method:</strong> ${event.method} | 
          <strong>Status:</strong> ${event.status} ${event.statusText} | 
          <strong>Time:</strong> ${new Date(event.timestamp).toLocaleTimeString()} |
          <strong>Rules:</strong> ${event.matchingRules.join(', ')}
          <br>
          <strong>Response Size:</strong> ${event.responseBody.content ? 
            (event.responseBody.encoding === 'base64' ? 
              Math.round(event.responseBody.content.length * 0.75) + ' bytes (base64)' : 
              event.responseBody.content.length + ' chars'
            ) : 'N/A'
          }
        </div>
      </div>
    `).join('');

    eventsList.innerHTML = eventsHTML;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async refreshData() {
    await this.loadConfiguration();
    this.updateUI();
  }
}

// Initialize the panel
const panel = new NetworkMonitorPanel();

// Make panel available globally for button onclick handlers
window.panel = panel;