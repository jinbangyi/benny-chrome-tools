// DevTools integration for Network Monitor Extension

// Create a panel in DevTools
chrome.devtools.panels.create(
  'Network Monitor',
  'icons/icon16.png',
  'panel.html',
  (panel) => {
    console.log('Network Monitor panel created');
    
    // Handle panel show/hide events
    panel.onShown.addListener((window) => {
      console.log('Network Monitor panel shown');
      // Send message to panel that it's visible
      window.postMessage({ type: 'PANEL_SHOWN' }, '*');
    });

    panel.onHidden.addListener(() => {
      console.log('Network Monitor panel hidden');
    });
  }
);