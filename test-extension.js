#!/usr/bin/env node

/**
 * Automated test script for Network Monitor Chrome Extension
 * This script will:
 * 1. Start the proxy server
 * 2. Start the demo API server
 * 3. Launch Chrome with the extension
 * 4. Open DevTools and configure the extension
 * 5. Make API requests and verify the proxy receives them
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

class ExtensionTester {
  constructor() {
    this.proxyPort = 3000;
    this.apiPort = 8080;
    this.chromePort = 9222;
    this.processes = [];
    this.extensionPath = __dirname;
    this.receivedEvents = [];
    this.testResults = {
      proxyServer: false,
      apiServer: false,
      chromeStarted: false,
      extensionLoaded: false,
      eventsReceived: false
    };
  }

  async runTests() {
    console.log('🚀 Starting Network Monitor Extension Test Suite');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Step 1: Start proxy server
      await this.startProxyServer();
      
      // Step 2: Start demo API server
      await this.startApiServer();
      
      // Step 3: Launch Chrome with extension
      await this.launchChrome();
      
      // Step 4: Wait for user to configure extension
      await this.waitForUserConfiguration();
      
      // Step 5: Run automated tests
      await this.runAutomatedTests();
      
      // Step 6: Verify results
      this.verifyResults();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  async startProxyServer() {
    console.log('\n📡 Starting proxy server...');
    
    return new Promise((resolve, reject) => {
      const proxyServer = spawn('node', ['test-server.js', this.proxyPort], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.extensionPath
      });

      this.processes.push(proxyServer);

      proxyServer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on')) {
          console.log('✅ Proxy server started on port', this.proxyPort);
          this.testResults.proxyServer = true;
          resolve();
        }
        if (output.includes('Network Event Received')) {
          this.receivedEvents.push({
            timestamp: Date.now(),
            data: output
          });
          console.log('📨 Event received by proxy server');
        }
      });

      proxyServer.stderr.on('data', (data) => {
        console.error('Proxy server error:', data.toString());
      });

      proxyServer.on('error', (error) => {
        reject(new Error(`Failed to start proxy server: ${error.message}`));
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!this.testResults.proxyServer) {
          reject(new Error('Proxy server failed to start within 5 seconds'));
        }
      }, 5000);
    });
  }

  async startApiServer() {
    console.log('\n🎯 Starting demo API server...');
    
    return new Promise((resolve, reject) => {
      const apiServer = spawn('node', ['demo-api.js', this.apiPort], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.extensionPath
      });

      this.processes.push(apiServer);

      apiServer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Demo API running on')) {
          console.log('✅ Demo API server started on port', this.apiPort);
          this.testResults.apiServer = true;
          resolve();
        }
      });

      apiServer.stderr.on('data', (data) => {
        console.error('API server error:', data.toString());
      });

      apiServer.on('error', (error) => {
        reject(new Error(`Failed to start API server: ${error.message}`));
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!this.testResults.apiServer) {
          reject(new Error('API server failed to start within 5 seconds'));
        }
      }, 5000);
    });
  }

  async launchChrome() {
    console.log('\n🌐 Launching Chrome with extension...');
    
    const chromeArgs = [
      `--load-extension=${this.extensionPath}`,
      `--remote-debugging-port=${this.chromePort}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-extensions-except=' + this.extensionPath,
      '--user-data-dir=' + path.join(__dirname, 'chrome-test-profile'),
      `http://localhost:${this.apiPort}`
    ];

    // Try different Chrome executable paths
    const chromePaths = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];

    let chromeProcess = null;
    
    for (const chromePath of chromePaths) {
      try {
        chromeProcess = spawn(chromePath, chromeArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false
        });
        
        console.log(`✅ Chrome started with: ${chromePath}`);
        this.testResults.chromeStarted = true;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!chromeProcess) {
      throw new Error('Could not find Chrome executable. Please install Chrome or Chromium.');
    }

    this.processes.push(chromeProcess);

    chromeProcess.on('error', (error) => {
      console.error('Chrome error:', error.message);
    });

    // Wait a bit for Chrome to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n📋 Chrome launched with the following configuration:');
    console.log(`   🔗 Demo API: http://localhost:${this.apiPort}`);
    console.log(`   📡 Proxy Server: http://localhost:${this.proxyPort}`);
    console.log(`   🔧 Remote Debugging: http://localhost:${this.chromePort}`);
    console.log(`   📁 Extension Path: ${this.extensionPath}`);
  }

  async waitForUserConfiguration() {
    console.log('\n⚙️  Manual Configuration Required:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. 🔧 Open DevTools (F12)');
    console.log('2. 📋 Go to "Network Monitor" tab');
    console.log('3. ⚙️  Configure server settings:');
    console.log(`   - Host: localhost`);
    console.log(`   - Port: ${this.proxyPort}`);
    console.log(`   - Endpoint: /network-events`);
    console.log('4. 📝 Add monitoring rules:');
    console.log('   - Rule Name: "API Calls"');
    console.log('   - Type: "Contains"');
    console.log('   - Pattern: "/api/"');
    console.log('5. ▶️  Click "Start Monitoring"');
    console.log('6. 🔄 Click "Save Configuration"');
    console.log('\n⏳ Press ENTER when configuration is complete...');

    return new Promise((resolve) => {
      process.stdin.once('data', () => {
        console.log('✅ Configuration completed, proceeding with tests...');
        resolve();
      });
    });
  }

  async runAutomatedTests() {
    console.log('\n🧪 Running automated API tests...');
    
    const testEndpoints = [
      '/api/users',
      '/api/products',
      '/api/data.json',
      '/api/users/1',
      '/api/large-response'
    ];

    for (let i = 0; i < testEndpoints.length; i++) {
      const endpoint = testEndpoints[i];
      console.log(`📡 [${i + 1}/${testEndpoints.length}] Testing ${endpoint}...`);
      
      try {
        const response = await this.makeHttpRequest(`http://localhost:${this.apiPort}${endpoint}`);
        console.log(`   ✅ ${response.status} ${response.statusText}`);
        
        // Wait a bit for the extension to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Test POST request
    console.log('📡 Testing POST /api/auth/login...');
    try {
      const response = await this.makeHttpRequest(`http://localhost:${this.apiPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password' })
      });
      console.log(`   ✅ ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async makeHttpRequest(url, options = {}) {
    const fetch = (await import('node-fetch')).default;
    return await fetch(url, options);
  }

  verifyResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const results = [
      { name: 'Proxy Server Started', status: this.testResults.proxyServer },
      { name: 'Demo API Server Started', status: this.testResults.apiServer },
      { name: 'Chrome Launched', status: this.testResults.chromeStarted },
      { name: 'Events Received by Proxy', status: this.receivedEvents.length > 0 }
    ];

    results.forEach(result => {
      const icon = result.status ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
    });

    console.log(`\n📨 Total events received: ${this.receivedEvents.length}`);
    
    if (this.receivedEvents.length > 0) {
      console.log('🎉 SUCCESS: Extension is working correctly!');
      console.log('\n📋 Received Events:');
      this.receivedEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. ${new Date(event.timestamp).toLocaleTimeString()}`);
      });
    } else {
      console.log('⚠️  WARNING: No events received by proxy server');
      console.log('\n🔍 Troubleshooting steps:');
      console.log('1. Ensure the extension is properly loaded in Chrome');
      console.log('2. Check that monitoring is started in DevTools');
      console.log('3. Verify the server configuration matches the proxy server');
      console.log('4. Check browser console for any errors');
    }

    console.log('\n🔗 Useful URLs:');
    console.log(`   📊 Proxy Dashboard: http://localhost:${this.proxyPort}/`);
    console.log(`   🎯 Demo API: http://localhost:${this.apiPort}/`);
    console.log(`   🔧 Chrome DevTools: chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=localhost:${this.chromePort}`);
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    // Kill all spawned processes
    this.processes.forEach(process => {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Ignore errors when killing processes
      }
    });

    // Clean up Chrome profile directory
    try {
      const profileDir = path.join(__dirname, 'chrome-test-profile');
      if (fs.existsSync(profileDir)) {
        exec(`rm -rf "${profileDir}"`, (error) => {
          if (error) {
            console.log('Note: Could not clean up Chrome profile directory');
          }
        });
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('✅ Cleanup completed');
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Test terminated');
  process.exit(0);
});

// Check if required files exist
function checkRequiredFiles() {
  const requiredFiles = [
    'manifest.json',
    'background.js',
    'test-server.js',
    'demo-api.js'
  ];

  const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(__dirname, file)));
  
  if (missingFiles.length > 0) {
    console.error('❌ Missing required files:', missingFiles.join(', '));
    console.error('Please ensure all extension files are present in the current directory.');
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🔍 Network Monitor Extension - Automated Test Suite');
  console.log('═══════════════════════════════════════════════════');
  
  checkRequiredFiles();
  
  const tester = new ExtensionTester();
  await tester.runTests();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = ExtensionTester;