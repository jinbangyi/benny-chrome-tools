# Network Monitor Chrome Extension

A powerful Chrome extension that monitors network requests in DevTools based on user-defined rules and forwards events (including HTTP response bodies) to a localhost HTTP server.

## Features

- 🔍 **Real-time Network Monitoring**: Captures network requests as they happen in the browser
- 📋 **Flexible Rule System**: Define custom rules using regex, contains, exact match, starts with, or ends with patterns
- 📡 **HTTP Response Bodies**: Captures and forwards complete response bodies (text and binary)
- ⚙️ **Configurable Server**: Forward events to any localhost server with customizable host, port, and endpoint
- 🎛️ **DevTools Integration**: Full-featured panel in Chrome DevTools for configuration and monitoring
- 📊 **Event Dashboard**: Built-in popup interface for quick status and control
- 🔧 **Easy Setup**: Simple installation and configuration process

## Installation

### 1. Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the extension directory
4. The Network Monitor extension should now appear in your extensions list

### 2. Set Up Test Server (Optional)

A test server is included to demonstrate the extension functionality:

```bash
# Make the server executable
chmod +x test-server.js

# Start the server (default port 3000)
node test-server.js

# Or specify a custom port
node test-server.js 8080
```

The test server provides:
- **Dashboard**: `http://localhost:3000/` - View received events in real-time
- **API Endpoint**: `http://localhost:3000/network-events` - Receives events from extension
- **Status Check**: `http://localhost:3000/status` - Server health check

## Usage

### 1. Basic Setup

1. **Open DevTools**: Press `F12` or right-click → "Inspect"
2. **Navigate to Network Monitor**: Find the "Network Monitor" tab in DevTools
3. **Configure Server**: Set your server details (default: localhost:3000)
4. **Add Rules**: Create monitoring rules to capture specific network requests

### 2. Creating Monitoring Rules

The extension supports several rule types:

#### Rule Types

- **Contains**: URL contains the specified text
  - Example: `/api/` matches any URL containing "/api/"
  
- **Regular Expression**: Advanced pattern matching
  - Example: `^https://api\..*\.com/v\d+/` matches versioned API endpoints
  
- **Exact Match**: URL must match exactly
  - Example: `https://api.example.com/users` matches only this exact URL
  
- **Starts With**: URL begins with the specified text
  - Example: `https://api.example.com/` matches all URLs starting with this
  
- **Ends With**: URL ends with the specified text
  - Example: `.json` matches all URLs ending with ".json"

#### Example Rules

```javascript
// Capture all API calls
{
  name: "API Calls",
  type: "contains",
  pattern: "/api/"
}

// Capture JSON responses
{
  name: "JSON Responses", 
  type: "endsWith",
  pattern: ".json"
}

// Capture specific service calls
{
  name: "User Service",
  type: "regex",
  pattern: "https://api\\.example\\.com/users/\\d+",
  flags: "i"
}
```

### 3. Starting Monitoring

1. **Configure Rules**: Add at least one monitoring rule
2. **Start Monitoring**: Click "Start Monitoring" in the DevTools panel or popup
3. **Browse**: Navigate and interact with web pages
4. **View Events**: Monitor captured events in real-time

### 4. Event Data Structure

Events forwarded to your server include:

```javascript
{
  "timestamp": 1640995200000,
  "tabId": 123,
  "requestId": "1234.56",
  "url": "https://api.example.com/users",
  "method": "GET",
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json",
    "content-length": "1234"
  },
  "responseBody": {
    "content": "{'users': [...]}",
    "encoding": "utf8"
  },
  "matchingRules": ["API Calls", "JSON Responses"]
}
```

## Server Integration

### Custom Server Setup

Create your own server to receive network events:

#### Node.js Example

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Enable CORS for extension
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Receive network events
app.post('/network-events', (req, res) => {
  const event = req.body;
  
  console.log('Network Event:', {
    url: event.url,
    method: event.method,
    status: event.status,
    responseSize: event.responseBody.content?.length || 0
  });
  
  // Process the event data
  processNetworkEvent(event);
  
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```

#### Python Flask Example

```python
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for extension

@app.route('/network-events', methods=['POST'])
def receive_event():
    event = request.json
    
    print(f"Network Event: {event['method']} {event['url']} - {event['status']}")
    
    # Process the event data
    process_network_event(event)
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
```

### Configuration Options

Configure the server connection in the DevTools panel:

- **Host**: Server hostname (default: localhost)
- **Port**: Server port (default: 3000)  
- **Endpoint**: API endpoint path (default: /network-events)

## Troubleshooting

### Common Issues

1. **Extension Not Loading**
   - Ensure all files are in the same directory
   - Check Chrome Extensions page for error messages
   - Verify manifest.json is valid

2. **DevTools Panel Not Appearing**
   - Refresh the page after installing the extension
   - Check if the extension is enabled
   - Look for the "Network Monitor" tab in DevTools

3. **Events Not Being Captured**
   - Verify monitoring is started
   - Check that rules are configured correctly
   - Ensure the target requests match your rules

4. **Server Connection Issues**
   - Verify server is running and accessible
   - Check CORS configuration on your server
   - Test connection using the "Test Connection" button

5. **Missing Response Bodies**
   - Some responses may not be available due to browser security
   - Binary responses are base64 encoded
   - Large responses may be truncated

### Debug Mode

Enable debug logging by opening the extension's background page:

1. Go to `chrome://extensions/`
2. Find "Network Monitor" extension
3. Click "background page" or "service worker"
4. Check console for debug messages

## File Structure

```
network-monitor-extension/
├── manifest.json           # Extension manifest
├── background.js          # Background service worker
├── devtools.html         # DevTools page entry
├── devtools.js           # DevTools integration
├── panel.html            # Main DevTools panel UI
├── panel.js              # Panel functionality
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── test-server.js        # Test server for demonstration
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## API Reference

### Chrome Extension Messages

The extension uses Chrome's messaging API for communication:

#### Background Script Messages

- `startMonitoring` - Start monitoring a tab
- `stopMonitoring` - Stop monitoring a tab
- `updateRules` - Update monitoring rules
- `updateServerConfig` - Update server configuration
- `getRules` - Get current rules
- `getServerConfig` - Get current server config

#### Event Data Format

Events sent to your server follow this structure:

```typescript
interface NetworkEvent {
  timestamp: number;           // Event timestamp
  tabId: number;              // Chrome tab ID
  requestId: string;          // Unique request ID
  url: string;                // Request URL
  method: string;             // HTTP method
  status: number;             // HTTP status code
  statusText: string;         // HTTP status text
  headers: Record<string, string>; // Response headers
  responseBody: {
    content: string | null;   // Response content
    encoding: 'utf8' | 'base64' | null; // Content encoding
    error?: string;           // Error if content unavailable
  };
  matchingRules: string[];    // Names of matching rules
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Chrome extension documentation
3. Open an issue with detailed information about your problem

---

**Happy monitoring!** 🔍📡