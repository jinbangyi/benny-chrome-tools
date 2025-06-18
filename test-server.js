// test-server.js - Simple server for testing the Chrome extension

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;

// Sample metrics data
const metricsData = {
  "success": true,
  "results": [
    {
      "timestamp": 1747612800,
      "PRICE_DATA": 5173157.063999999
    },
    {
      "timestamp": 1747699200,
      "PRICE_DATA": 6524387.016000001
    },
    {
      "timestamp": 1747785600,
      "PRICE_DATA": 2353555.92
    },
    {
      "timestamp": 1747872000,
      "PRICE_DATA": 74710.704
    },
    {
      "timestamp": 1747958400,
      "PRICE_DATA": 504797.952
    }
  ],
  "items": ["PRICE_DATA"]
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Handle API routes
  if (req.url === '/api/metrics') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metricsData));
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        console.log('Received POST data:', body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Data received',
          receivedData: JSON.parse(body || '{}')
        }));
      });
    }
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/test.html' : req.url;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/metrics - Returns sample metrics data');
  console.log('  POST /api/metrics - Accepts metrics data');
  console.log('  GET  / - Test page');
  console.log('\nTo test the extension:');
  console.log('1. Load the extension in Chrome');
  console.log('2. Set endpoint to: http://localhost:3000/api/metrics');
  console.log('3. Visit http://localhost:3000 to test');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
