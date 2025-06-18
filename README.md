# HTTP Request Watcher Chrome Extension

A Chrome extension that monitors HTTP requests and executes custom JavaScript code when requests match specified endpoints.

## Features

- Monitor HTTP requests to specific endpoints
- Support for different HTTP methods (GET, POST, PUT, DELETE, PATCH, or any method)
- Execute custom JavaScript code on matching requests
- View results in real-time
- Persistent configuration and results storage

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the extension folder
4. The extension icon should appear in your browser toolbar

## Usage

### 1. Configure the Endpoint

- Click on the extension icon to open the popup
- Enter the HTTP endpoint you want to monitor (e.g., `https://api.example.com/data`)
- Select the HTTP method to watch for (or choose "Any Method")
- You can use wildcards in the endpoint (e.g., `https://api.example.com/*`)

### 2. Write Custom JavaScript Code

In the JavaScript code textarea, write a function named `index` that will process the HTTP response:

```javascript
function index(response) {
  // response object contains:
  // - url: the request URL
  // - method: HTTP method (GET, POST, etc.)
  // - status: HTTP status code
  // - headers: response headers object
  // - body: response body (parsed as JSON if possible)
  // - requestData: request data/options
  
  // Your processing logic here
  const data = response.body;
  
  // Return the result you want to display
  return `Processed ${data.length} items`;
}
```

### 3. Start Watching

- Click "Start Watching" to begin monitoring requests
- The status will change to "Active"
- Navigate to websites that make requests to your specified endpoint

### 4. View Results

- Results will appear in the "Results" section of the popup
- Each result shows the timestamp, URL, method, status, and your function's output
- Use "Clear Results" to clear the history

## Example Use Cases

### 1. API Response Logging
```javascript
function index(response) {
  console.log('API Response:', response);
  return `Status: ${response.status}, Data: ${JSON.stringify(response.body)}`;
}
```

### 2. Data Transformation
```javascript
function index(response) {
  if (response.body && Array.isArray(response.body)) {
    const count = response.body.length;
    const firstItem = response.body[0];
    return `Found ${count} items. First: ${JSON.stringify(firstItem)}`;
  }
  return 'No array data found';
}
```

### 3. Error Detection
```javascript
function index(response) {
  if (response.status >= 400) {
    return `⚠️ Error ${response.status}: ${response.body.message || 'Unknown error'}`;
  }
  return `✅ Success: ${response.body.success ? 'OK' : 'Failed'}`;
}
```

### 4. Data Extraction
```javascript
function index(response) {
  try {
    const data = response.body;
    if (data.users) {
      const usernames = data.users.map(u => u.name).join(', ');
      return `Users: ${usernames}`;
    }
    return 'No users found';
  } catch (error) {
    return `Error processing: ${error.message}`;
  }
}
```

## Technical Details

### Supported Response Types

The extension automatically detects and parses:
- JSON responses (parsed as objects)
- Text responses (as strings)
- Other content types (as text)

### Security Considerations

- The extension runs in a sandboxed environment
- Custom JavaScript code is executed safely without access to the page context
- Only specified endpoints are monitored

### Limitations

- Due to Chrome extension security policies, some response bodies may not be fully accessible
- The extension works best with JavaScript-initiated requests (fetch, XMLHttpRequest)
- CORS policies may limit access to some cross-origin requests

## Troubleshooting

### No Results Appearing

1. Make sure the endpoint URL exactly matches the requests being made
2. Check that the HTTP method is correct
3. Verify your JavaScript code has a function named `index`
4. Check the browser console for any errors

### JavaScript Errors

- Ensure your `index` function handles potential undefined values
- Use try-catch blocks for error handling
- Test your code logic before starting the watcher

### Extension Not Working

1. Reload the extension in `chrome://extensions/`
2. Check that all required permissions are granted
3. Ensure the website allows the extension to run

## File Structure

```
├── manifest.json      # Extension configuration
├── popup.html         # User interface
├── popup.js           # Popup logic
├── background.js      # Background service worker
├── content.js         # Content script for request interception
└── README.md          # This file
```

## Development

To modify or extend the extension:

1. Edit the relevant files
2. Reload the extension in Chrome
3. Test your changes

The extension uses Chrome Extension Manifest V3 and modern JavaScript features.
