// Background service worker for the Network Monitor Extension

class NetworkMonitor {
  constructor() {
    this.attachedTabs = new Set();
    this.monitoringRules = [];
    this.serverConfig = {
      host: 'localhost',
      port: 3000,
      endpoint: '/network-events'
    };
    
    this.init();
  }

  async init() {
    // Load configuration from storage
    await this.loadConfig();
    
    // Set up message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });

    // Handle tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.attachedTabs.has(tabId)) {
        this.attachDebugger(tabId);
      }
    });

    // Handle tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.detachDebugger(tabId);
    });
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get(['monitoringRules', 'serverConfig']);
      this.monitoringRules = result.monitoringRules || [];
      this.serverConfig = { ...this.serverConfig, ...(result.serverConfig || {}) };
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  async saveConfig() {
    try {
      await chrome.storage.sync.set({
        monitoringRules: this.monitoringRules,
        serverConfig: this.serverConfig
      });
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'startMonitoring':
          await this.startMonitoring(message.tabId);
          sendResponse({ success: true });
          break;
        
        case 'stopMonitoring':
          await this.stopMonitoring(message.tabId);
          sendResponse({ success: true });
          break;
        
        case 'updateRules':
          this.monitoringRules = message.rules;
          await this.saveConfig();
          sendResponse({ success: true });
          break;
        
        case 'updateServerConfig':
          this.serverConfig = { ...this.serverConfig, ...message.config };
          await this.saveConfig();
          sendResponse({ success: true });
          break;
        
        case 'getRules':
          sendResponse({ rules: this.monitoringRules });
          break;
        
        case 'getServerConfig':
          sendResponse({ config: this.serverConfig });
          break;
        
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async startMonitoring(tabId) {
    if (this.attachedTabs.has(tabId)) {
      return;
    }

    try {
      await this.attachDebugger(tabId);
      this.attachedTabs.add(tabId);
      console.log(`Started monitoring tab ${tabId}`);
    } catch (error) {
      console.error(`Failed to start monitoring tab ${tabId}:`, error);
      throw error;
    }
  }

  async stopMonitoring(tabId) {
    if (!this.attachedTabs.has(tabId)) {
      return;
    }

    try {
      await this.detachDebugger(tabId);
      this.attachedTabs.delete(tabId);
      console.log(`Stopped monitoring tab ${tabId}`);
    } catch (error) {
      console.error(`Failed to stop monitoring tab ${tabId}:`, error);
    }
  }

  async attachDebugger(tabId) {
    try {
      // Attach debugger
      await chrome.debugger.attach({ tabId }, '1.3');
      
      // Enable Network domain
      await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
      
      // Set up event listeners
      chrome.debugger.onEvent.addListener((source, method, params) => {
        if (source.tabId === tabId) {
          this.handleNetworkEvent(tabId, method, params);
        }
      });

      chrome.debugger.onDetach.addListener((source, reason) => {
        if (source.tabId === tabId) {
          this.attachedTabs.delete(tabId);
          console.log(`Debugger detached from tab ${tabId}, reason: ${reason}`);
        }
      });

    } catch (error) {
      console.error(`Failed to attach debugger to tab ${tabId}:`, error);
      throw error;
    }
  }

  async detachDebugger(tabId) {
    try {
      await chrome.debugger.detach({ tabId });
    } catch (error) {
      // Ignore errors when detaching (tab might already be closed)
      console.log(`Error detaching debugger from tab ${tabId}:`, error.message);
    }
  }

  async handleNetworkEvent(tabId, method, params) {
    if (method === 'Network.responseReceived') {
      await this.handleResponseReceived(tabId, params);
    }
  }

  async handleResponseReceived(tabId, params) {
    const { requestId, response } = params;
    
    // Check if this request matches any monitoring rules
    const matchingRules = this.monitoringRules.filter(rule => 
      this.matchesRule(response.url, rule)
    );

    if (matchingRules.length === 0) {
      return;
    }

    try {
      // Get response body
      const responseBody = await this.getResponseBody(tabId, requestId);
      
      // Create event data
      const eventData = {
        timestamp: Date.now(),
        tabId,
        requestId,
        url: response.url,
        method: response.requestHeaders?.method || 'GET',
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        responseBody,
        matchingRules: matchingRules.map(rule => rule.name)
      };

      // Forward to localhost server
      await this.forwardEvent(eventData);

    } catch (error) {
      console.error('Error handling response:', error);
    }
  }

  async getResponseBody(tabId, requestId) {
    try {
      const result = await chrome.debugger.sendCommand(
        { tabId }, 
        'Network.getResponseBody', 
        { requestId }
      );
      
      if (result.base64Encoded) {
        return {
          content: result.body,
          encoding: 'base64'
        };
      } else {
        return {
          content: result.body,
          encoding: 'utf8'
        };
      }
    } catch (error) {
      console.error('Failed to get response body:', error);
      return {
        content: null,
        encoding: null,
        error: error.message
      };
    }
  }

  matchesRule(url, rule) {
    try {
      if (rule.type === 'regex') {
        const regex = new RegExp(rule.pattern, rule.flags || 'i');
        return regex.test(url);
      } else if (rule.type === 'contains') {
        return url.toLowerCase().includes(rule.pattern.toLowerCase());
      } else if (rule.type === 'exact') {
        return url === rule.pattern;
      } else if (rule.type === 'startsWith') {
        return url.startsWith(rule.pattern);
      } else if (rule.type === 'endsWith') {
        return url.endsWith(rule.pattern);
      }
      return false;
    } catch (error) {
      console.error('Error matching rule:', error);
      return false;
    }
  }

  async forwardEvent(eventData) {
    const url = `http://${this.serverConfig.host}:${this.serverConfig.port}${this.serverConfig.endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('Event forwarded successfully:', eventData.url);
    } catch (error) {
      console.error('Failed to forward event:', error);
      // Could implement retry logic or queue here
    }
  }
}

// Initialize the network monitor
const networkMonitor = new NetworkMonitor();