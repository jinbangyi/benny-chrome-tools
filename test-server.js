#!/usr/bin/env node

/**
 * Simple test server to receive network events from the Chrome extension
 * Run with: node test-server.js [port]
 */

const http = require('http');
const url = require('url');

const PORT = process.argv[2] || 3000;

// Store received events
const events = [];

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  if (path === '/network-events' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const eventData = JSON.parse(body);
        
        // Store the event
        events.push({
          ...eventData,
          receivedAt: new Date().toISOString()
        });

        // Keep only last 100 events
        if (events.length > 100) {
          events.splice(0, events.length - 100);
        }

        console.log('\n🔔 Network Event Received:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📅 Time: ${new Date(eventData.timestamp).toLocaleString()}`);
        console.log(`🌐 URL: ${eventData.url}`);
        console.log(`📋 Method: ${eventData.method}`);
        console.log(`📊 Status: ${eventData.status} ${eventData.statusText}`);
        console.log(`📏 Response Size: ${eventData.responseBody.content ? 
          (eventData.responseBody.encoding === 'base64' ? 
            Math.round(eventData.responseBody.content.length * 0.75) + ' bytes (base64)' : 
            eventData.responseBody.content.length + ' chars'
          ) : 'N/A'
        }`);
        console.log(`🎯 Matching Rules: ${eventData.matchingRules.join(', ')}`);
        
        if (eventData.responseBody.content && eventData.responseBody.content.length < 500) {
          console.log(`📄 Response Preview: ${eventData.responseBody.content.substring(0, 200)}${eventData.responseBody.content.length > 200 ? '...' : ''}`);
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Event received',
          eventId: eventData.requestId,
          totalEvents: events.length
        }));

      } catch (error) {
        console.error('❌ Error processing event:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON' 
        }));
      }
    });

  } else if (path === '/events' && req.method === 'GET') {
    // API to get all received events
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      events: events,
      count: events.length
    }));

  } else if (path === '/status' && req.method === 'GET') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      port: PORT,
      eventsReceived: events.length,
      uptime: process.uptime()
    }));

  } else if (path === '/' && req.method === 'GET') {
    // Simple dashboard
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Network Monitor Test Server</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { background: #007cba; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #007cba; }
    .events { background: white; border: 1px solid #ddd; border-radius: 8px; }
    .event { padding: 15px; border-bottom: 1px solid #eee; }
    .event:last-child { border-bottom: none; }
    .event-url { font-weight: bold; color: #007cba; margin-bottom: 5px; }
    .event-details { font-size: 0.9em; color: #666; }
    .no-events { padding: 40px; text-align: center; color: #999; }
  </style>
  <script>
    function refreshEvents() {
      fetch('/events')
        .then(r => r.json())
        .then(data => {
          const container = document.getElementById('events-container');
          if (data.events.length === 0) {
            container.innerHTML = '<div class="no-events">No events received yet</div>';
          } else {
            container.innerHTML = data.events.map(event => \`
              <div class="event">
                <div class="event-url">\${event.url}</div>
                <div class="event-details">
                  <strong>Method:</strong> \${event.method} | 
                  <strong>Status:</strong> \${event.status} \${event.statusText} | 
                  <strong>Time:</strong> \${new Date(event.timestamp).toLocaleString()} |
                  <strong>Rules:</strong> \${event.matchingRules.join(', ')}
                </div>
              </div>
            \`).join('');
          }
          document.getElementById('event-count').textContent = data.count;
        });
    }
    
    setInterval(refreshEvents, 2000);
    setTimeout(refreshEvents, 100);
  </script>
</head>
<body>
  <div class="header">
    <h1>🔍 Network Monitor Test Server</h1>
    <p>Listening for network events from Chrome extension</p>
  </div>
  
  <div class="stats">
    <div class="stat-card">
      <div class="stat-value" id="event-count">${events.length}</div>
      <div>Events Received</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${PORT}</div>
      <div>Server Port</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${Math.round(process.uptime())}s</div>
      <div>Uptime</div>
    </div>
  </div>
  
  <div class="events">
    <h3 style="margin: 0; padding: 20px; background: #f8f9fa; border-bottom: 1px solid #ddd;">Recent Events</h3>
    <div id="events-container">
      ${events.length === 0 ? '<div class="no-events">No events received yet</div>' : 
        events.map(event => `
          <div class="event">
            <div class="event-url">${event.url}</div>
            <div class="event-details">
              <strong>Method:</strong> ${event.method} | 
              <strong>Status:</strong> ${event.status} ${event.statusText} | 
              <strong>Time:</strong> ${new Date(event.timestamp).toLocaleString()} |
              <strong>Rules:</strong> ${event.matchingRules.join(', ')}
            </div>
          </div>
        `).join('')
      }
    </div>
  </div>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);

  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Network Monitor Test Server Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/`);
  console.log(`🔗 Events endpoint: http://localhost:${PORT}/network-events`);
  console.log(`📋 API endpoints:`);
  console.log(`   GET  /status  - Server status`);
  console.log(`   GET  /events  - List all events`);
  console.log(`   POST /network-events - Receive events`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 Waiting for network events from Chrome extension...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});