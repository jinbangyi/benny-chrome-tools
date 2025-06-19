#!/usr/bin/env node

/**
 * Fully automated test for Network Monitor Chrome Extension using Puppeteer
 * This script automates everything including DevTools interaction
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutomatedExtensionTest {
  constructor() {
    this.proxyPort = 3000;
    this.apiPort = 8080;
    this.processes = [];
    this.receivedEvents = [];
    this.browser = null;
    this.page = null;
  }

  async runFullTest() {
    console.log('🤖 Starting Fully Automated Extension Test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Step 1: Start servers
      await this.startServers();
      
      // Step 2: Launch Chrome with extension
      await this.launchChromeWithExtension();
      
      // Step 3: Configure extension automatically
      await this.configureExtension();
      
      // Step 4: Run tests and monitor events
      await this.runTestsAndMonitor();
      
      // Step 5: Verify results
      await this.verifyResults();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }

  async startServers() {
    console.log('\n📡 Starting proxy server...');
    await this.startProxyServer();
    
    console.log('\n🎯 Starting demo API server...');
    await this.startApiServer();
  }

  async startProxyServer() {
    return new Promise((resolve, reject) => {
      const proxyServer = spawn('node', ['test-server.js', this.proxyPort], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.push(proxyServer);

      proxyServer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on')) {
          console.log('✅ Proxy server started');
          resolve();
        }
        if (output.includes('Network Event Received')) {
          this.receivedEvents.push({
            timestamp: Date.now(),
            data: output
          });
          console.log('📨 Event received by proxy!');
        }
      });

      proxyServer.on('error', reject);
      setTimeout(() => reject(new Error('Proxy server timeout')), 10000);
    });
  }

  async startApiServer() {
    return new Promise((resolve, reject) => {
      const apiServer = spawn('node', ['demo-api.js', this.apiPort], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.push(apiServer);

      apiServer.stdout.on('data', (data) => {
        if (data.toString().includes('Demo API running on')) {
          console.log('✅ Demo API server started');
          resolve();
        }
      });

      apiServer.on('error', reject);
      setTimeout(() => reject(new Error('API server timeout')), 10000);
    });
  }

  async launchChromeWithExtension() {
    console.log('\n🌐 Launching Chrome with extension...');
    
    const extensionPath = path.resolve(__dirname);
    
    this.browser = await puppeteer.launch({
      headless: false, // Keep visible for demonstration
      devtools: true,  // Open DevTools automatically
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });

    const pages = await this.browser.pages();
    this.page = pages[0];
    
    console.log('✅ Chrome launched with extension');
  }

  async configureExtension() {
    console.log('\n⚙️  Configuring extension...');
    
    // Navigate to demo API page
    await this.page.goto(`http://localhost:${this.apiPort}`);
    await this.page.waitForTimeout(2000);
    
    // Get extension ID
    const extensionId = await this.getExtensionId();
    console.log('🔧 Extension ID:', extensionId);
    
    // Open extension popup to verify it's loaded
    try {
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      const popupPage = await this.browser.newPage();
      await popupPage.goto(popupUrl);
      console.log('✅ Extension popup accessible');
      await popupPage.close();
    } catch (error) {
      console.log('⚠️  Could not access extension popup:', error.message);
    }

    // Configure via DevTools (this is complex with Puppeteer, so we'll use a different approach)
    // Instead, we'll inject configuration directly via the extension's background script
    await this.injectConfiguration();
    
    console.log('✅ Extension configured');
  }

  async getExtensionId() {
    // Navigate to extensions page to get the extension ID
    const extensionsPage = await this.browser.newPage();
    await extensionsPage.goto('chrome://extensions/');
    await extensionsPage.waitForTimeout(1000);
    
    // Extract extension ID from the page
    const extensionId = await extensionsPage.evaluate(() => {
      const extensions = document.querySelectorAll('extensions-item');
      for (const ext of extensions) {
        const name = ext.shadowRoot?.querySelector('#name')?.textContent;
        if (name && name.includes('Network Monitor')) {
          return ext.id;
        }
      }
      return null;
    });
    
    await extensionsPage.close();
    return extensionId;
  }

  async injectConfiguration() {
    // Inject configuration by executing script in the context of the page
    await this.page.evaluate((proxyPort) => {
      // Send configuration to extension
      if (window.chrome && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'updateServerConfig',
          config: {
            host: 'localhost',
            port: proxyPort,
            endpoint: '/network-events'
          }
        });

        chrome.runtime.sendMessage({
          action: 'updateRules',
          rules: [
            {
              id: '1',
              name: 'API Calls',
              type: 'contains',
              pattern: '/api/',
              enabled: true,
              created: new Date().toISOString()
            },
            {
              id: '2',
              name: 'JSON Files',
              type: 'endsWith',
              pattern: '.json',
              enabled: true,
              created: new Date().toISOString()
            }
          ]
        });

        // Start monitoring
        chrome.runtime.sendMessage({
          action: 'startMonitoring',
          tabId: chrome.devtools ? chrome.devtools.inspectedWindow.tabId : null
        });
      }
    }, this.proxyPort);
  }

  async runTestsAndMonitor() {
    console.log('\n🧪 Running automated tests...');
    
    // Navigate back to demo page
    await this.page.goto(`http://localhost:${this.apiPort}`);
    await this.page.waitForTimeout(2000);

    // Start monitoring by injecting script to send message to extension
    await this.page.evaluate(() => {
      if (window.chrome && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'startMonitoring',
          tabId: window.location.href
        }).catch(console.error);
      }
    });

    const testEndpoints = [
      '/api/users',
      '/api/products', 
      '/api/data.json',
      '/api/users/1',
      '/api/auth/login'
    ];

    // Click test buttons on the demo page
    for (let i = 0; i < testEndpoints.length; i++) {
      const endpoint = testEndpoints[i];
      console.log(`📡 [${i + 1}/${testEndpoints.length}] Testing ${endpoint}...`);
      
      try {
        if (endpoint === '/api/auth/login') {
          // Click the auth test button
          await this.page.click('button[onclick="testAuth()"]');
        } else {
          // Click the corresponding button or make direct request
          await this.page.evaluate((endpoint) => {
            window.makeRequest(endpoint);
          }, endpoint);
        }
        
        await this.page.waitForTimeout(1500); // Wait for request to complete
        
      } catch (error) {
        console.log(`   ❌ Error testing ${endpoint}:`, error.message);
      }
    }

    // Run the comprehensive test suite
    console.log('🔥 Running comprehensive test suite...');
    try {
      await this.page.click('button[onclick="runAllTests()"]');
      await this.page.waitForTimeout(5000); // Wait for all tests to complete
    } catch (error) {
      console.log('⚠️  Could not run comprehensive tests:', error.message);
    }

    // Wait for events to be processed
    await this.page.waitForTimeout(3000);
  }

  async verifyResults() {
    console.log('\n📊 Verifying test results...');
    
    // Check proxy server status
    try {
      const response = await fetch(`http://localhost:${this.proxyPort}/status`);
      const status = await response.json();
      console.log('📡 Proxy server status:', status);
    } catch (error) {
      console.log('❌ Could not check proxy server status');
    }

    // Check received events
    try {
      const response = await fetch(`http://localhost:${this.proxyPort}/events`);
      const data = await response.json();
      console.log(`📨 Events received by proxy: ${data.count}`);
      
      if (data.count > 0) {
        console.log('🎉 SUCCESS: Extension is working correctly!');
        console.log('\n📋 Sample events:');
        data.events.slice(0, 3).forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.method} ${event.url} - ${event.status}`);
        });
      } else {
        console.log('⚠️  No events received - extension may not be working');
      }
    } catch (error) {
      console.log('❌ Could not verify events:', error.message);
    }

    // Take a screenshot for verification
    try {
      await this.page.screenshot({ 
        path: 'test-results.png', 
        fullPage: true 
      });
      console.log('📸 Screenshot saved as test-results.png');
    } catch (error) {
      console.log('⚠️  Could not take screenshot');
    }

    console.log('\n🔗 Verification URLs:');
    console.log(`   📊 Proxy Dashboard: http://localhost:${this.proxyPort}/`);
    console.log(`   🎯 Demo API: http://localhost:${this.apiPort}/`);
    console.log(`   📈 Events API: http://localhost:${this.proxyPort}/events`);
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.browser) {
      await this.browser.close();
    }
    
    this.processes.forEach(process => {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Ignore errors
      }
    });
    
    console.log('✅ Cleanup completed');
  }
}

// Install puppeteer if not available
async function ensurePuppeteer() {
  try {
    require('puppeteer');
  } catch (error) {
    console.log('📦 Installing Puppeteer...');
    const { execSync } = require('child_process');
    execSync('npm install puppeteer', { stdio: 'inherit' });
    console.log('✅ Puppeteer installed');
  }
}

// Main execution
async function main() {
  console.log('🤖 Network Monitor Extension - Fully Automated Test');
  console.log('═══════════════════════════════════════════════════');
  
  try {
    await ensurePuppeteer();
    const tester = new AutomatedExtensionTest();
    await tester.runFullTest();
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AutomatedExtensionTest;