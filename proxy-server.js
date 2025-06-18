// proxy-server.js - Proxy server to intercept and modify HTTP responses

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

class ProxyServer {
  constructor(port = 8080) {
    this.port = port;
    this.watchedEndpoints = new Map(); // Map of endpoint patterns to user code
    this.extensionConfig = {
      isWatching: false,
      endpoint: '',
      method: '*',
      jsCode: ''
    };
    this.results = [];
  }

  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, () => {
      console.log(`🚀 Proxy server running on http://localhost:${this.port}`);
      console.log('📋 Available endpoints:');
      console.log(`   GET  /config - Get current extension configuration`);
      console.log(`   POST /config - Update extension configuration`);
      console.log(`   GET  /results - Get processed results`);
      console.log(`   POST /proxy - Proxy requests to target servers`);
      console.log(`   GET  /status - Get proxy status`);
    });
  }

  async handleRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Target-URL');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    switch (parsedUrl.pathname) {
      case '/config':
        this.handleConfig(req, res);
        break;
      case '/results':
        this.handleResults(req, res);
        break;
      case '/proxy':
        this.handleProxy(req, res);
        break;
      case '/status':
        this.handleStatus(req, res);
        break;
      case '/':
        this.serveProxyTestPage(req, res);
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
  }

  handleConfig(req, res) {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.extensionConfig));
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          this.extensionConfig = { ...this.extensionConfig, ...config };
          console.log('📝 Updated configuration:', this.extensionConfig);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config: this.extensionConfig }));
        } catch (error) {
          console.error('❌ Error updating config:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    }
  }

  handleResults(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ results: this.results }));
  }

  handleStatus(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      isRunning: true,
      isWatching: this.extensionConfig.isWatching,
      watchedEndpoint: this.extensionConfig.endpoint,
      resultsCount: this.results.length,
      port: this.port
    }));
  }

  async handleProxy(req, res) {
    const targetUrl = req.headers['x-target-url'];
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing X-Target-URL header' }));
      return;
    }

    console.log('🔄 Proxying request to:', targetUrl);

    try {
      // Forward the request to the target server
      const response = await this.forwardRequest(req, targetUrl);
      
      // Check if this request should be processed
      if (this.shouldProcessRequest(targetUrl, req.method)) {
        console.log('✅ Request matches watched endpoint, processing...');
        
        // Process the response with user code
        const processedResult = await this.processResponse({
          url: targetUrl,
          method: req.method,
          status: response.statusCode,
          headers: response.headers,
          body: response.body
        });

        // Store the result
        this.results.unshift({
          timestamp: Date.now(),
          url: targetUrl,
          method: req.method,
          status: response.statusCode,
          result: processedResult
        });

        // Keep only last 50 results
        this.results = this.results.slice(0, 50);
      }

      // Forward the response back to the client
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);

    } catch (error) {
      console.error('❌ Proxy error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy request failed', details: error.message }));
    }
  }

  async forwardRequest(req, targetUrl) {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.path,
          method: req.method,
          headers: { ...req.headers }
        };

        // Remove proxy-specific headers
        delete options.headers['x-target-url'];
        delete options.headers['host'];

        const proxyReq = httpModule.request(options, (proxyRes) => {
          let responseBody = '';
          
          proxyRes.on('data', chunk => {
            responseBody += chunk;
          });

          proxyRes.on('end', () => {
            // Try to parse JSON responses
            let parsedBody = responseBody;
            try {
              if (proxyRes.headers['content-type']?.includes('application/json')) {
                parsedBody = JSON.parse(responseBody);
              }
            } catch (e) {
              // Keep as string if not valid JSON
            }

            resolve({
              statusCode: proxyRes.statusCode,
              headers: proxyRes.headers,
              body: responseBody,
              parsedBody: parsedBody
            });
          });
        });

        proxyReq.on('error', reject);

        if (body) {
          proxyReq.write(body);
        }
        proxyReq.end();
      });
    });
  }

  shouldProcessRequest(requestUrl, method) {
    if (!this.extensionConfig.isWatching || !this.extensionConfig.endpoint) {
      return false;
    }

    // Check method
    if (this.extensionConfig.method !== '*' && this.extensionConfig.method !== method) {
      return false;
    }

    // Check URL pattern
    const endpointPattern = this.extensionConfig.endpoint
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    
    const regex = new RegExp(endpointPattern, 'i');
    return regex.test(requestUrl);
  }

  async processResponse(responseData) {
    if (!this.extensionConfig.jsCode) {
      return 'No processing code configured';
    }

    try {
      // Import safe functions
      const safeFunctions = require('./safe-functions.js');

      // Check for predefined functions
      if (this.extensionConfig.jsCode.includes('BUILDIN_birdeye-metrics')) {
        return safeFunctions['BUILDIN_birdeye-metrics']({
          ...responseData,
          body: responseData.parsedBody || responseData.body
        });
      }
      
      if (this.extensionConfig.jsCode.includes('BUILDIN_simple-log')) {
        return safeFunctions['BUILDIN_simple-log']({
          ...responseData,
          body: responseData.parsedBody || responseData.body
        });
      }
      
      if (this.extensionConfig.jsCode.includes('BUILDIN_count-records')) {
        return safeFunctions['BUILDIN_count-records']({
          ...responseData,
          body: responseData.parsedBody || responseData.body
        });
      }

      // Legacy support
      if (this.extensionConfig.jsCode.includes('monthly-sum') || 
          this.extensionConfig.jsCode.includes('PRICE_DATA')) {
        return safeFunctions['BUILDIN_birdeye-metrics']({
          ...responseData,
          body: responseData.parsedBody || responseData.body
        });
      }

      // For custom code, execute safely
      const func = new Function('response', this.extensionConfig.jsCode + '\nreturn index(response);');
      return func({
        ...responseData,
        body: responseData.parsedBody || responseData.body
      });

    } catch (error) {
      console.error('❌ Error processing response:', error);
      return `Error processing response: ${error.message}`;
    }
  }

  serveProxyTestPage(req, res) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Proxy Server Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        button { padding: 10px 15px; margin: 5px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 3px; }
        .status { padding: 10px; border-radius: 3px; margin: 10px 0; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>🔄 Proxy Server Test Page</h1>
    
    <div class="section">
        <h3>Proxy Status</h3>
        <div id="status">Loading...</div>
        <button onclick="checkStatus()">Refresh Status</button>
    </div>

    <div class="section">
        <h3>Test Proxied Requests</h3>
        <button onclick="testProxyRequest()">Test Proxy to Metrics API</button>
        <button onclick="testDirectRequest()">Test Direct Request</button>
        <div id="results"></div>
    </div>

    <div class="section">
        <h3>Configuration</h3>
        <p>To use this proxy with the Chrome extension:</p>
        <ol>
            <li>Configure your application to use this proxy: <code>http://localhost:${this.port}/proxy</code></li>
            <li>Set the <code>X-Target-URL</code> header to the actual target URL</li>
            <li>The proxy will forward requests and process responses based on extension configuration</li>
        </ol>
    </div>

    <script>
        async function checkStatus() {
            try {
                const response = await fetch('/status');
                const status = await response.json();
                document.getElementById('status').innerHTML = \`
                    <div class="success">
                        ✅ Proxy Server Running<br>
                        Port: \${status.port}<br>
                        Watching: \${status.isWatching ? 'Yes' : 'No'}<br>
                        Endpoint: \${status.watchedEndpoint || 'None'}<br>
                        Results: \${status.resultsCount}
                    </div>
                \`;
            } catch (error) {
                document.getElementById('status').innerHTML = \`
                    <div class="error">❌ Error: \${error.message}</div>
                \`;
            }
        }

        async function testProxyRequest() {
            try {
                const response = await fetch('/proxy', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Target-URL': 'http://localhost:3000/api/metrics'
                    },
                    body: JSON.stringify({
                        success: true,
                        results: [
                            { timestamp: 1747612800, PRICE_DATA: 5173157.064 },
                            { timestamp: 1747699200, PRICE_DATA: 6524387.016 }
                        ]
                    })
                });
                
                const result = await response.text();
                document.getElementById('results').innerHTML = \`
                    <h4>Proxy Request Result:</h4>
                    <pre>\${result}</pre>
                \`;
            } catch (error) {
                document.getElementById('results').innerHTML = \`
                    <div class="error">❌ Proxy Error: \${error.message}</div>
                \`;
            }
        }

        async function testDirectRequest() {
            try {
                const response = await fetch('http://localhost:3000/api/metrics');
                const result = await response.text();
                document.getElementById('results').innerHTML = \`
                    <h4>Direct Request Result:</h4>
                    <pre>\${result}</pre>
                \`;
            } catch (error) {
                document.getElementById('results').innerHTML = \`
                    <div class="error">❌ Direct Error: \${error.message}</div>
                \`;
            }
        }

        // Auto-check status on load
        checkStatus();
    </script>
</body>
</html>
    `;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('🛑 Proxy server stopped');
    }
  }
}

// Start the proxy server if run directly
if (require.main === module) {
  const proxy = new ProxyServer(8080);
  proxy.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down proxy server...');
    proxy.stop();
    process.exit(0);
  });
}

module.exports = ProxyServer;
