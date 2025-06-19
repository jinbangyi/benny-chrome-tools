#!/usr/bin/env node

/**
 * Simple test script for Network Monitor Chrome Extension
 * Tests the proxy server and demonstrates the extension functionality
 */

const { spawn } = require('child_process');
const http = require('http');

class SimpleExtensionTest {
  constructor() {
    this.proxyPort = 3000;
    this.apiPort = 8080;
    this.processes = [];
    this.receivedEvents = 0;
  }

  async runTest() {
    console.log('🔍 Network Monitor Extension - Simple Test');
    console.log('═══════════════════════════════════════════════');

    try {
      // Start servers
      await this.startProxyServer();
      await this.startApiServer();
      
      // Wait a moment for servers to stabilize
      await this.sleep(2000);
      
      // Test the setup
      await this.testSetup();
      
      // Provide instructions
      this.showInstructions();
      
      // Keep running until user stops
      await this.waitForUserInput();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    } finally {
      this.cleanup();
    }
  }

  async startProxyServer() {
    console.log('\n📡 Starting proxy server...');
    
    return new Promise((resolve, reject) => {
      const server = spawn('node', ['test-server.js', this.proxyPort], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.push(server);

      server.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on')) {
          console.log('✅ Proxy server started on port', this.proxyPort);
          resolve();
        }
        if (output.includes('Network Event Received')) {
          this.receivedEvents++;
          console.log(`📨 Event #${this.receivedEvents} received by proxy server!`);
        }
      });

      server.stderr.on('data', (data) => {
        console.error('Proxy error:', data.toString());
      });

      server.on('error', reject);
      
      setTimeout(() => {
        reject(new Error('Proxy server failed to start'));
      }, 10000);
    });
  }

  async startApiServer() {
    console.log('\n🎯 Starting demo API server...');
    
    return new Promise((resolve, reject) => {
      const server = spawn('node', ['demo-api.js', this.apiPort], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.push(server);

      server.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Demo API running on')) {
          console.log('✅ Demo API server started on port', this.apiPort);
          resolve();
        }
      });

      server.stderr.on('data', (data) => {
        console.error('API error:', data.toString());
      });

      server.on('error', reject);
      
      setTimeout(() => {
        reject(new Error('API server failed to start'));
      }, 10000);
    });
  }

  async testSetup() {
    console.log('\n🧪 Testing server setup...');
    
    // Test proxy server
    try {
      const response = await this.makeRequest(`http://localhost:${this.proxyPort}/status`);
      console.log('✅ Proxy server responding');
    } catch (error) {
      throw new Error('Proxy server not responding');
    }

    // Test API server
    try {
      const response = await this.makeRequest(`http://localhost:${this.apiPort}/api/users`);
      console.log('✅ Demo API server responding');
    } catch (error) {
      throw new Error('Demo API server not responding');
    }

    // Test proxy endpoint
    try {
      const testEvent = {
        test: true,
        timestamp: Date.now(),
        url: 'https://api.example.com/test',
        method: 'GET',
        status: 200,
        statusText: 'OK',
        headers: {},
        responseBody: {
          content: 'test response',
          encoding: 'utf8'
        },
        matchingRules: ['Test Rule']
      };

      const response = await this.makeRequest(`http://localhost:${this.proxyPort}/network-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testEvent)
      });

      console.log('✅ Proxy endpoint accepting events');
    } catch (error) {
      throw new Error('Proxy endpoint not working');
    }
  }

  showInstructions() {
    console.log('\n🎯 CHROME EXTENSION SETUP INSTRUCTIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. 📁 Load Extension in Chrome:');
    console.log('   - Open Chrome and go to chrome://extensions/');
    console.log('   - Enable "Developer mode"');
    console.log('   - Click "Load unpacked"');
    console.log(`   - Select this directory: ${__dirname}`);
    console.log('');
    console.log('2. 🌐 Open Demo Page:');
    console.log(`   - Navigate to: http://localhost:${this.apiPort}`);
    console.log('');
    console.log('3. 🔧 Configure Extension:');
    console.log('   - Open DevTools (F12)');
    console.log('   - Go to "Network Monitor" tab');
    console.log('   - Configure server settings:');
    console.log(`     * Host: localhost`);
    console.log(`     * Port: ${this.proxyPort}`);
    console.log(`     * Endpoint: /network-events`);
    console.log('   - Add monitoring rule:');
    console.log('     * Rule Name: API Calls');
    console.log('     * Type: Contains');
    console.log('     * Pattern: /api/');
    console.log('   - Click "Save Configuration"');
    console.log('   - Click "Start Monitoring"');
    console.log('');
    console.log('4. 🧪 Test the Extension:');
    console.log('   - Click the test buttons on the demo page');
    console.log('   - Watch this console for received events');
    console.log('   - Check the proxy dashboard for details');
    console.log('');
    console.log('🔗 USEFUL URLS:');
    console.log(`   📊 Proxy Dashboard: http://localhost:${this.proxyPort}/`);
    console.log(`   🎯 Demo API Page: http://localhost:${this.apiPort}/`);
    console.log(`   📈 Events API: http://localhost:${this.proxyPort}/events`);
    console.log(`   📋 Server Status: http://localhost:${this.proxyPort}/status`);
    console.log('');
    console.log('💡 TIP: Open the proxy dashboard in another tab to see events in real-time!');
    console.log('');
  }

  async waitForUserInput() {
    console.log('⏳ Servers are running. Press CTRL+C to stop...');
    console.log('');
    
    // Monitor for events periodically
    const monitorInterval = setInterval(async () => {
      try {
        const response = await this.makeRequest(`http://localhost:${this.proxyPort}/events`);
        const data = JSON.parse(response);
        
        if (data.count > 0 && data.count !== this.lastReportedCount) {
          console.log(`📊 Total events received: ${data.count}`);
          this.lastReportedCount = data.count;
          
          if (data.events && data.events.length > 0) {
            const latest = data.events[0];
            console.log(`   Latest: ${latest.method} ${latest.url} - ${latest.status}`);
          }
        }
      } catch (error) {
        // Ignore monitoring errors
      }
    }, 5000);

    return new Promise((resolve) => {
      process.on('SIGINT', () => {
        clearInterval(monitorInterval);
        console.log('\n🛑 Stopping servers...');
        resolve();
      });
    });
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = http.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    this.processes.forEach(process => {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    console.log('✅ Cleanup completed');
  }
}

// Main execution
async function main() {
  const tester = new SimpleExtensionTest();
  await tester.runTest();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = SimpleExtensionTest;