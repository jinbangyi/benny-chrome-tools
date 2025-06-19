#!/usr/bin/env node

/**
 * Demo API server for testing the Network Monitor Extension
 * Provides various endpoints that generate different types of responses
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 8080;

// Sample data for API responses
const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'user' }
];

const products = [
  { id: 1, name: 'Laptop', price: 999.99, category: 'Electronics' },
  { id: 2, name: 'Book', price: 19.99, category: 'Education' },
  { id: 3, name: 'Coffee Mug', price: 12.99, category: 'Kitchen' }
];

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`${new Date().toISOString()} - ${method} ${pathname}`);

  // Add artificial delay to simulate real API
  const delay = Math.random() * 500 + 100; // 100-600ms delay
  
  setTimeout(() => {
    handleRequest(req, res, pathname, method, parsedUrl.query);
  }, delay);
});

function handleRequest(req, res, pathname, method, query) {
  try {
    // API Routes
    if (pathname === '/api/users' && method === 'GET') {
      respondJSON(res, 200, { users, total: users.length, page: 1 });
      
    } else if (pathname.match(/^\/api\/users\/\d+$/) && method === 'GET') {
      const userId = parseInt(pathname.split('/')[3]);
      const user = users.find(u => u.id === userId);
      if (user) {
        respondJSON(res, 200, { user, timestamp: Date.now() });
      } else {
        respondJSON(res, 404, { error: 'User not found', code: 'USER_NOT_FOUND' });
      }
      
    } else if (pathname === '/api/products' && method === 'GET') {
      const category = query.category;
      let filteredProducts = products;
      if (category) {
        filteredProducts = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }
      respondJSON(res, 200, { products: filteredProducts, total: filteredProducts.length });
      
    } else if (pathname === '/api/auth/login' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { username, password } = JSON.parse(body);
          if (username === 'admin' && password === 'password') {
            respondJSON(res, 200, { 
              token: 'jwt-token-' + Date.now(), 
              user: { id: 1, username: 'admin', role: 'admin' },
              expiresIn: 3600
            });
          } else {
            respondJSON(res, 401, { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
          }
        } catch (e) {
          respondJSON(res, 400, { error: 'Invalid JSON', code: 'INVALID_JSON' });
        }
      });
      
    } else if (pathname === '/api/data.json' && method === 'GET') {
      respondJSON(res, 200, {
        timestamp: Date.now(),
        data: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          value: Math.random() * 100,
          label: `Item ${i + 1}`
        }))
      });
      
    } else if (pathname === '/api/large-response' && method === 'GET') {
      // Generate a large response to test handling
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        data: `This is item ${i + 1} with some additional data to make the response larger`,
        timestamp: Date.now() + i,
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        }
      }));
      respondJSON(res, 200, { items: largeData, total: largeData.length });
      
    } else if (pathname === '/api/error' && method === 'GET') {
      respondJSON(res, 500, { 
        error: 'Internal Server Error', 
        code: 'INTERNAL_ERROR',
        details: 'This is a simulated error for testing purposes'
      });
      
    } else if (pathname === '/api/slow' && method === 'GET') {
      // Simulate a slow endpoint
      setTimeout(() => {
        respondJSON(res, 200, { 
          message: 'This response was delayed by 2 seconds',
          timestamp: Date.now()
        });
      }, 2000);
      return; // Don't execute the rest of the function
      
    } else if (pathname === '/graphql' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { query: gqlQuery } = JSON.parse(body);
          respondJSON(res, 200, {
            data: {
              users: users.slice(0, 2),
              products: products.slice(0, 2)
            },
            query: gqlQuery
          });
        } catch (e) {
          respondJSON(res, 400, { errors: [{ message: 'Invalid GraphQL query' }] });
        }
      });
      
    } else if (pathname === '/' && method === 'GET') {
      // Serve test page
      serveTestPage(res);
      
    } else {
      respondJSON(res, 404, { error: 'Endpoint not found', path: pathname });
    }
  } catch (error) {
    console.error('Error handling request:', error);
    respondJSON(res, 500, { error: 'Internal server error' });
  }
}

function respondJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function serveTestPage(res) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Network Monitor Extension - Demo API Test Page</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 40px; 
      background: #f5f5f5;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { 
      background: #007cba; 
      color: white; 
      padding: 30px; 
      border-radius: 8px; 
      margin-bottom: 30px; 
      text-align: center;
    }
    .section { 
      background: white; 
      padding: 25px; 
      border-radius: 8px; 
      margin-bottom: 20px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn { 
      background: #007cba; 
      color: white; 
      border: none; 
      padding: 10px 20px; 
      border-radius: 4px; 
      cursor: pointer; 
      margin: 5px;
      font-size: 14px;
    }
    .btn:hover { background: #005a87; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
    .btn-warning { background: #ffc107; color: #000; }
    .btn-warning:hover { background: #e0a800; }
    .response { 
      background: #f8f9fa; 
      border: 1px solid #dee2e6; 
      border-radius: 4px; 
      padding: 15px; 
      margin-top: 10px; 
      font-family: monospace; 
      font-size: 12px;
      max-height: 300px;
      overflow-y: auto;
    }
    .endpoint-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 15px;
    }
    .endpoint-card {
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 15px;
      background: #fafafa;
    }
    .method { 
      display: inline-block; 
      padding: 2px 8px; 
      border-radius: 3px; 
      font-size: 11px; 
      font-weight: bold; 
      margin-right: 10px;
    }
    .get { background: #28a745; color: white; }
    .post { background: #007bff; color: white; }
    .instructions {
      background: #e7f3ff;
      border-left: 4px solid #007cba;
      padding: 20px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 Network Monitor Extension - Demo API</h1>
      <p>Test page for demonstrating network request monitoring</p>
    </div>

    <div class="instructions">
      <h3>📋 Testing Instructions</h3>
      <ol>
        <li><strong>Install Extension:</strong> Load the Network Monitor extension in Chrome</li>
        <li><strong>Open DevTools:</strong> Press F12 and go to "Network Monitor" tab</li>
        <li><strong>Configure Rules:</strong> Add rules like "contains: /api/" or "endsWith: .json"</li>
        <li><strong>Start Monitoring:</strong> Click "Start Monitoring" in the extension</li>
        <li><strong>Make Requests:</strong> Click the buttons below to trigger API calls</li>
        <li><strong>Check Results:</strong> View captured events in DevTools and proxy server</li>
      </ol>
    </div>

    <div class="section">
      <h3>🚀 Quick Test Buttons</h3>
      <button class="btn" onclick="makeRequest('/api/users')">Get Users</button>
      <button class="btn" onclick="makeRequest('/api/products')">Get Products</button>
      <button class="btn" onclick="makeRequest('/api/data.json')">Get JSON Data</button>
      <button class="btn" onclick="makeRequest('/api/users/1')">Get User #1</button>
      <button class="btn btn-warning" onclick="makeRequest('/api/slow')">Slow Request (2s)</button>
      <button class="btn btn-danger" onclick="makeRequest('/api/error')">Error Request</button>
      <button class="btn" onclick="makeRequest('/api/large-response')">Large Response</button>
      <button class="btn" onclick="testAuth()">Test Auth</button>
      <button class="btn" onclick="testGraphQL()">Test GraphQL</button>
      <button class="btn" onclick="runAllTests()">🔥 Run All Tests</button>
    </div>

    <div class="section">
      <h3>📡 Available API Endpoints</h3>
      <div class="endpoint-grid">
        <div class="endpoint-card">
          <div><span class="method get">GET</span><code>/api/users</code></div>
          <p>Returns list of users</p>
        </div>
        <div class="endpoint-card">
          <div><span class="method get">GET</span><code>/api/users/{id}</code></div>
          <p>Returns specific user by ID</p>
        </div>
        <div class="endpoint-card">
          <div><span class="method get">GET</span><code>/api/products</code></div>
          <p>Returns list of products</p>
        </div>
        <div class="endpoint-card">
          <div><span class="method get">GET</span><code>/api/data.json</code></div>
          <p>Returns JSON data array</p>
        </div>
        <div class="endpoint-card">
          <div><span class="method post">POST</span><code>/api/auth/login</code></div>
          <p>Authentication endpoint</p>
        </div>
        <div class="endpoint-card">
          <div><span class="method post">POST</span><code>/graphql</code></div>
          <p>GraphQL endpoint</p>
        </div>
        <div class="endpoint-card">
          <div><span class="method get">GET</span><code>/api/large-response</code></div>
          <p>Returns large JSON response</p>
        </div>
        <div class="endpoint-card">
          <div><span class="method get">GET</span><code>/api/slow</code></div>
          <p>Slow response (2 second delay)</p>
        </div>
        <div class="endpoint-card">
          <div><span class="method get">GET</span><code>/api/error</code></div>
          <p>Returns 500 error</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>📄 Response Output</h3>
      <div id="response" class="response">Click a button above to see API responses...</div>
    </div>
  </div>

  <script>
    let requestCount = 0;

    async function makeRequest(endpoint, options = {}) {
      const responseDiv = document.getElementById('response');
      const requestId = ++requestCount;
      
      try {
        responseDiv.innerHTML += \`\\n🔄 [\${requestId}] Making request to \${endpoint}...\\n\`;
        responseDiv.scrollTop = responseDiv.scrollHeight;
        
        const response = await fetch(endpoint, {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body
        });
        
        const data = await response.text();
        const status = response.status;
        
        responseDiv.innerHTML += \`✅ [\${requestId}] \${status} \${response.statusText} - \${endpoint}\\n\`;
        responseDiv.innerHTML += \`📄 Response: \${data.substring(0, 200)}\${data.length > 200 ? '...' : ''}\\n\`;
        responseDiv.innerHTML += \`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\`;
        
      } catch (error) {
        responseDiv.innerHTML += \`❌ [\${requestId}] Error: \${error.message}\\n\`;
        responseDiv.innerHTML += \`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\`;
      }
      
      responseDiv.scrollTop = responseDiv.scrollHeight;
    }

    async function testAuth() {
      await makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password' })
      });
    }

    async function testGraphQL() {
      await makeRequest('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: 'query { users { id name email } products { id name price } }' 
        })
      });
    }

    async function runAllTests() {
      const endpoints = [
        '/api/users',
        '/api/products', 
        '/api/data.json',
        '/api/users/1',
        '/api/users/999', // 404 test
        '/api/error'
      ];
      
      document.getElementById('response').innerHTML = '🔥 Running comprehensive test suite...\\n';
      
      for (const endpoint of endpoints) {
        await makeRequest(endpoint);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
      }
      
      await testAuth();
      await new Promise(resolve => setTimeout(resolve, 500));
      await testGraphQL();
      
      document.getElementById('response').innerHTML += '\\n🎉 All tests completed! Check your Network Monitor extension for captured events.\\n';
    }

    // Auto-run a test request when page loads
    setTimeout(() => {
      makeRequest('/api/users');
    }, 1000);
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('🎯 Demo API Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 Demo API running on: http://localhost:${PORT}`);
  console.log(`📋 Test page: http://localhost:${PORT}/`);
  console.log(`🔗 API endpoints:`);
  console.log(`   GET  /api/users           - List users`);
  console.log(`   GET  /api/users/{id}      - Get user by ID`);
  console.log(`   GET  /api/products        - List products`);
  console.log(`   GET  /api/data.json       - JSON data`);
  console.log(`   POST /api/auth/login      - Authentication`);
  console.log(`   POST /graphql             - GraphQL endpoint`);
  console.log(`   GET  /api/large-response  - Large response`);
  console.log(`   GET  /api/slow            - Slow response`);
  console.log(`   GET  /api/error           - Error response`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 Ready for Network Monitor Extension testing!\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down demo API server...');
  server.close(() => {
    console.log('✅ Demo API server stopped');
    process.exit(0);
  });
});