# 🚀 Quick Start Test Guide

## Installation & Setup

1. **Install the Extension**
   ```bash
   # Open Chrome and go to chrome://extensions/
   # Enable "Developer mode"
   # Click "Load unpacked" and select this folder
   ```

2. **Start Test Server**
   ```bash
   cd /home/coder/benny-chrome-tools
   node test-server.js
   ```

3. **Open Test Page**
   - Navigate to `http://localhost:3000`

## 🧪 Testing the Extension

### Step 1: Configure Extension
1. Click the extension icon in Chrome
2. Set endpoint: `http://localhost:3000/api/metrics`
3. Choose method: `POST` or `Any Method`
4. Use predefined function:
   ```javascript
   function index(response) {
     return 'BUILDIN_birdeye-metrics';
   }
   ```
5. Click "Start Watching"

### Step 2: Test Functionality
1. On the test page (`http://localhost:3000`), click:
   - **"Test Metrics API"** - Tests the BUILDIN_birdeye-metrics function
   - **"Test Simple Request"** - Tests basic request logging
   - **"Test Extension Logging"** - Generates console logs for testing

### Step 3: View Results
1. **Check Extension Results**: Look at the "Results" section in the extension popup
2. **View Logs**: Click "📋 View Logs" button to see all captured console.log output

## 🔍 What to Expect

### Extension Results
- Should show processed data from the BUILDIN_birdeye-metrics function
- Monthly breakdown of PRICE_DATA
- Totals, averages, and analysis

### Logs Page
- **Background Script Logs**: Extension service worker messages
- **Content Script Logs**: Page-level interception messages  
- **Popup Logs**: User interface interaction logs

## 📊 Available Functions

### BUILDIN_birdeye-metrics
Perfect for financial data with timestamps and PRICE_DATA:
```javascript
function index(response) {
  return 'BUILDIN_birdeye-metrics';
}
```

### BUILDIN_simple-log
Basic request logging:
```javascript
function index(response) {
  return 'BUILDIN_simple-log';
}
```

### BUILDIN_count-records
Count array items:
```javascript
function index(response) {
  return 'BUILDIN_count-records';
}
```

## 🐛 Troubleshooting

1. **No Results**: Check that endpoint URL matches exactly
2. **No Logs**: Make sure logging system is working by clicking "Test Extension Logging"
3. **CSP Errors**: Use predefined BUILDIN_ functions instead of custom code
4. **Extension Not Loading**: Check for errors in Chrome DevTools (F12)

## 📁 File Structure
```
├── manifest.json         # Extension configuration
├── popup.html/js         # User interface
├── background.js         # Service worker with logging
├── content.js            # Content script with logging
├── logs.html/js          # Logs viewer page
├── safe-functions.js     # Predefined safe functions
├── test-server.js        # Test HTTP server
└── test.html             # Test page
```

## 🎯 Success Indicators

✅ Extension popup shows "Status: Active"  
✅ Test requests generate results in popup  
✅ Logs page shows captured console messages  
✅ BUILDIN_birdeye-metrics processes your data correctly  
✅ No CSP errors in Chrome DevTools  

Happy testing! 🎉
