# HTTP Request Watcher - Proxy Integration Guide

## Overview

The HTTP Request Watcher Chrome extension now includes proxy server integration to overcome the Chrome webRequest API limitations for accessing response bodies. This guide explains how to use the complete system.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chrome         │    │  Proxy Server   │    │  Target API     │
│  Extension      │───▶│  (Node.js)      │───▶│  Server         │
│                 │    │                 │    │                 │
│  - Background   │    │  - Intercepts   │    │  - Returns      │
│  - Content      │    │  - Processes    │    │    response     │
│  - Popup        │    │  - Executes JS  │    │    data         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Features

### With Proxy Server (Recommended)
- ✅ **Full response body access** - Process complete API responses
- ✅ **Enhanced data processing** - Execute JavaScript on actual response data
- ✅ **Better performance** - Direct access to response content
- ✅ **Complete logging** - Full request/response cycle logging

### Without Proxy Server (Fallback)
- ⚠️ **Limited response access** - Chrome webRequest API limitations
- ⚠️ **Basic monitoring** - Can detect requests but limited response data
- ⚠️ **Reduced functionality** - Some features may not work fully

## Quick Start

### 1. Install the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the extension directory
4. Note the extension ID for accessing logs

### 2. Start the Proxy Server
```bash
# In the extension directory
node proxy-server.js
```

The proxy server will start on `http://localhost:8080`

### 3. Start Test Server (Optional)
```bash
# In another terminal
node test-server.js
```

The test server will start on `http://localhost:3000`

### 4. Configure the Extension
1. Click the extension icon in Chrome
2. Check that "Proxy Server Status" shows "✅ Proxy Server Running"
3. Configure your endpoint (e.g., `http://localhost:3000/api/metrics`)
4. Choose a predefined function or write custom JavaScript
5. Click "Start Watching"

## Predefined Functions

### BUILDIN_birdeye-metrics
Designed for Birdeye API token metrics processing:
```javascript
BUILDIN_birdeye-metrics
```
- Processes `PRICE_DATA` monthly aggregations
- Calculates sums and statistics
- Returns formatted results

### BUILDIN_simple-log
Basic request/response logging:
```javascript
BUILDIN_simple-log
```
- Logs request URL, method, and status
- Shows response data preview
- Useful for debugging

### BUILDIN_count-records
Counts array elements in responses:
```javascript
BUILDIN_count-records
```
- Counts array items in response body
- Handles nested objects
- Returns record counts

## Custom JavaScript Functions

You can write custom processing functions:

```javascript
// Custom function example
function index(response) {
  // response.url - Request URL
  // response.method - HTTP method
  // response.status - Response status code
  // response.headers - Response headers
  // response.body - Response body (parsed JSON if applicable)
  
  // Your processing logic here
  return {
    url: response.url,
    status: response.status,
    dataCount: Array.isArray(response.body) ? response.body.length : 0
  };
}
```

## Proxy Server API

The proxy server provides several endpoints:

### GET /status
Get proxy server status:
```bash
curl http://localhost:8080/status
```

### POST /config
Update extension configuration:
```bash
curl -X POST http://localhost:8080/config \
  -H "Content-Type: application/json" \
  -d '{"isWatching": true, "endpoint": "https://api.example.com/*", "jsCode": "BUILDIN_simple-log"}'
```

### GET /results
Get processed results:
```bash
curl http://localhost:8080/results
```

### POST /proxy
Proxy requests (used internally by extension):
```bash
curl -X POST http://localhost:8080/proxy \
  -H "X-Target-URL: https://api.example.com/data" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Troubleshooting

### Proxy Server Not Running
If you see "❌ Proxy Server Not Running" in the extension:

1. **Start the proxy server**:
   ```bash
   node proxy-server.js
   ```

2. **Check the port**: Ensure port 8080 is available

3. **Firewall issues**: Make sure localhost:8080 is accessible

### Extension Not Intercepting Requests
1. **Check endpoint pattern**: Use wildcards like `https://api.example.com/*`
2. **Verify HTTP method**: Set to `*` for all methods or specific method
3. **Reload pages**: Refresh pages after starting the extension
4. **Check browser console**: Look for error messages

### JavaScript Execution Errors
1. **Use predefined functions**: Start with `BUILDIN_simple-log`
2. **Check function syntax**: Ensure you have an `index` function
3. **Test with simple code**: Start with basic logging
4. **Check logs**: View logs at `chrome-extension://[id]/logs.html`

### Performance Issues
1. **Limit endpoint patterns**: Use specific patterns instead of `*`
2. **Optimize JavaScript code**: Avoid heavy processing
3. **Clear results regularly**: Use the "Clear Results" button
4. **Monitor memory usage**: Check Chrome task manager

## Testing

### Automated Test
Use the provided test script:
```bash
./start-test.sh
```

This will:
1. Start the proxy server on port 8080
2. Start the test server on port 3000
3. Provide testing instructions

### Manual Testing
1. Configure extension to watch `http://localhost:3000/api/metrics`
2. Set JavaScript code to `BUILDIN_birdeye-metrics`
3. Open `http://localhost:3000/test.html`
4. Click "Test Metrics API"
5. Check extension popup for results

## Advanced Configuration

### Custom Proxy Port
Edit `background.js` to change the proxy port:
```javascript
const PROXY_CONFIG = {
  host: 'localhost',
  port: 9090, // Change this
  baseUrl: 'http://localhost:9090'
};
```

### CORS Configuration
The proxy server handles CORS automatically, but you can modify headers in `proxy-server.js`:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Target-URL');
```

### Logging Configuration
Adjust logging levels in any script:
```javascript
const MAX_LOGS = 2000; // Increase log retention
```

## Security Considerations

1. **Localhost only**: The proxy server only accepts localhost connections
2. **No external access**: Proxy is not accessible from outside the machine
3. **CORS enabled**: Necessary for Chrome extension communication
4. **No authentication**: Suitable for development/testing only

## Files Overview

- `background.js` - Main extension logic with proxy integration
- `popup.js` - Extension popup interface with proxy status
- `content.js` - Enhanced request interception
- `proxy-server.js` - Node.js proxy server for response body access
- `safe-functions.js` - Predefined processing functions
- `logs.html/js` - Comprehensive logging interface
- `test-server.js` - Test HTTP server for development
- `start-test.sh` - Automated testing script

## Support

For issues or questions:
1. Check the logs at `chrome-extension://[id]/logs.html`
2. Review browser console for errors
3. Verify proxy server is running and accessible
4. Test with predefined functions first

## Contributing

To add new predefined functions:
1. Edit `safe-functions.js`
2. Add your function to the `SAFE_FUNCTIONS` export
3. Update the popup examples in `popup.html`
4. Test thoroughly with the proxy server
