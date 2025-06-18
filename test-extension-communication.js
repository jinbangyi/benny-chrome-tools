// Test script to verify extension message communication
// Run this in the browser console when the extension popup is open

console.log('Testing extension communication...');

// Test 1: Check if chrome.runtime is available
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('✅ Chrome runtime is available');
  
  // Test 2: Send a simple message to background script
  chrome.runtime.sendMessage({ action: 'getProxyStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Message failed:', chrome.runtime.lastError.message);
    } else {
      console.log('✅ Message response:', response);
      
      if (response && response.status) {
        console.log('✅ Proxy status received:', response.status);
      } else {
        console.warn('⚠️ No proxy status in response');
      }
    }
  });
  
} else {
  console.error('❌ Chrome runtime not available');
}

// Test 3: Check if we can fetch from proxy server directly
fetch('http://localhost:8081/status')
  .then(response => {
    console.log('✅ Direct fetch to proxy server successful, status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('✅ Proxy server response:', data);
  })
  .catch(error => {
    console.error('❌ Direct fetch to proxy server failed:', error.message);
  });
