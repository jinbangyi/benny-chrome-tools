# Chrome Extension Usage Guide

## CSP-Safe Functions

The extension now uses predefined safe functions to avoid Content Security Policy violations. Here are the available functions:

### 1. Monthly Sum Function
**Use case**: Process financial data with timestamps and PRICE_DATA fields
**Code to paste**:
```javascript
function index(response) {
  return 'monthly-sum';
}
```
**What it does**: Groups data by month, calculates totals, averages, and provides detailed analysis

### 2. Simple Log Function
**Use case**: Basic request logging and debugging
**Code to paste**:
```javascript
function index(response) {
  return 'simple-log';
}
```
**What it does**: Shows request details, URL, method, status, and response body

### 3. Count Records Function
**Use case**: Count items in response arrays
**Code to paste**:
```javascript
function index(response) {
  return 'count-records';
}
```
**What it does**: Counts the number of records in the response

### 4. Custom Functions
For custom functions, they will work in page context but may have limitations for intercepted requests.

## Setup Instructions

1. **Install Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension folder

2. **Configure Endpoint**:
   - Click the extension icon
   - Enter your API endpoint (e.g., `https://api.example.com/metrics`)
   - Select HTTP method

3. **Choose Function**:
   - For PRICE_DATA analysis: Use the "Monthly Sum" function
   - For basic logging: Use the "Simple Log" function
   - For counting: Use the "Count Records" function

4. **Start Watching**:
   - Click "Start Watching"
   - Navigate to pages that make requests to your endpoint
   - Check the extension popup for results

## Testing

Use the `test.html` file to test different scenarios:
- Open `test.html` in Chrome
- Follow the instructions on the page
- Test with different predefined functions

## Troubleshooting

- **CSP Errors**: The extension now uses safe functions to avoid CSP violations
- **No Results**: Make sure the endpoint URL matches exactly
- **JavaScript Errors**: Use the predefined functions for best compatibility

## File Structure

```
├── manifest.json         # Extension configuration
├── popup.html            # User interface
├── popup.js              # Popup logic
├── background.js         # Background service worker
├── content.js            # Content script
├── safe-functions.js     # Predefined safe functions
├── test.html             # Test page
└── README.md             # Documentation
```
