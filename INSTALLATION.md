# Quick Installation Guide

## 1. Install the Chrome Extension

1. **Download/Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Verify Installation** - you should see "Network Monitor" in your extensions

## 2. Start the Test Server

```bash
# Navigate to the extension directory
cd /path/to/network-monitor-extension

# Start the test server (uses port 3000 by default)
node test-server.js

# Or specify a custom port
node test-server.js 8080
```

## 3. Configure the Extension

1. **Open any website** in Chrome
2. **Open DevTools** (F12 or right-click → Inspect)
3. **Find "Network Monitor" tab** in DevTools
4. **Configure server settings**:
   - Host: `localhost`
   - Port: `3000` (or your custom port)
   - Endpoint: `/network-events`
5. **Add monitoring rules**:
   - Rule Name: `API Calls`
   - Type: `Contains`
   - Pattern: `/api/`

## 4. Start Monitoring

1. **Click "Start Monitoring"** in the DevTools panel
2. **Browse the website** to trigger network requests
3. **View captured events** in:
   - DevTools panel (real-time)
   - Server dashboard: `http://localhost:3000/`
   - Server console output

## 5. Test the Setup

You can test the connection using the "Test Connection" button in the extension popup or DevTools panel.

## Quick Test

```bash
# Test the server endpoint directly
curl -X POST http://localhost:3000/network-events \
  -H "Content-Type: application/json" \
  -d '{"test": true, "url": "https://example.com", "method": "GET", "status": 200, "statusText": "OK", "headers": {}, "responseBody": {"content": "test", "encoding": "utf8"}, "matchingRules": ["Test"]}'
```

## Troubleshooting

- **Extension not loading**: Check for errors in `chrome://extensions/`
- **DevTools tab missing**: Refresh the page after installing
- **No events captured**: Verify rules are configured and monitoring is started
- **Server connection failed**: Ensure server is running and CORS is enabled

That's it! You're ready to monitor network requests. 🎉