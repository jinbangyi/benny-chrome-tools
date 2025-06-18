// logs.js - Handles the logs page functionality

document.addEventListener('DOMContentLoaded', function() {
  const refreshButton = document.getElementById('refreshLogs');
  const clearButton = document.getElementById('clearLogs');
  const exportButton = document.getElementById('exportLogs');
  const autoRefreshCheckbox = document.getElementById('autoRefresh');
  const logLevelFilter = document.getElementById('logLevel');
  const logSourceFilter = document.getElementById('logSource');
  const maxLogsSelect = document.getElementById('maxLogs');
  const logsContent = document.getElementById('logsContent');
  
  let autoRefreshInterval = null;
  let currentLogs = [];

  // Event listeners
  refreshButton.addEventListener('click', loadLogs);
  clearButton.addEventListener('click', clearLogs);
  exportButton.addEventListener('click', exportLogs);
  autoRefreshCheckbox.addEventListener('change', toggleAutoRefresh);
  logLevelFilter.addEventListener('change', filterLogs);
  logSourceFilter.addEventListener('change', filterLogs);
  maxLogsSelect.addEventListener('change', filterLogs);

  // Initialize
  loadLogs();
  loadSettings();

  // Load logs from storage
  async function loadLogs() {
    try {
      const result = await chrome.storage.local.get(['extensionLogs']);
      currentLogs = result.extensionLogs || [];
      filterLogs();
      updateStats();
    } catch (error) {
      console.error('Error loading logs:', error);
      showError('Failed to load logs: ' + error.message);
    }
  }

  // Filter and display logs
  function filterLogs() {
    const levelFilter = logLevelFilter.value;
    const sourceFilter = logSourceFilter.value;
    const maxLogs = maxLogsSelect.value;

    let filteredLogs = currentLogs;

    // Filter by level
    if (levelFilter !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === levelFilter);
    }

    // Filter by source
    if (sourceFilter !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.source === sourceFilter);
    }

    // Limit number of logs
    if (maxLogs !== 'all') {
      const limit = parseInt(maxLogs);
      filteredLogs = filteredLogs.slice(-limit);
    }

    displayLogs(filteredLogs);
  }

  // Display logs in the UI
  function displayLogs(logs) {
    if (!logs || logs.length === 0) {
      logsContent.innerHTML = '<div class="no-logs">No logs match the current filters.</div>';
      return;
    }

    const logsHtml = logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const levelClass = log.level || 'info';
      const source = log.source || 'unknown';
      
      return `
        <div class="log-entry ${levelClass}">
          <span class="log-timestamp">${timestamp}</span>
          <span class="log-source">[${source.toUpperCase()}]</span>
          <div class="log-message">${escapeHtml(log.message)}</div>
        </div>
      `;
    }).join('');

    logsContent.innerHTML = logsHtml;
    
    // Scroll to bottom to show latest logs
    logsContent.scrollTop = logsContent.scrollHeight;
  }

  // Update statistics
  function updateStats() {
    const total = currentLogs.length;
    const errors = currentLogs.filter(log => log.level === 'error').length;
    const warnings = currentLogs.filter(log => log.level === 'warn').length;
    const info = currentLogs.filter(log => log.level === 'info').length;

    document.getElementById('totalLogs').textContent = total;
    document.getElementById('errorLogs').textContent = errors;
    document.getElementById('warnLogs').textContent = warnings;
    document.getElementById('infoLogs').textContent = info;
  }

  // Clear all logs
  async function clearLogs() {
    if (!confirm('Are you sure you want to clear all logs?')) {
      return;
    }

    try {
      await chrome.storage.local.set({ extensionLogs: [] });
      currentLogs = [];
      filterLogs();
      updateStats();
      showSuccess('Logs cleared successfully');
    } catch (error) {
      console.error('Error clearing logs:', error);
      showError('Failed to clear logs: ' + error.message);
    }
  }

  // Export logs to file
  function exportLogs() {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalLogs: currentLogs.length,
        logs: currentLogs
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `extension-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('Logs exported successfully');
    } catch (error) {
      console.error('Error exporting logs:', error);
      showError('Failed to export logs: ' + error.message);
    }
  }

  // Toggle auto-refresh
  function toggleAutoRefresh() {
    if (autoRefreshCheckbox.checked) {
      autoRefreshInterval = setInterval(loadLogs, 2000); // Refresh every 2 seconds
      showSuccess('Auto-refresh enabled');
    } else {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
      }
      showSuccess('Auto-refresh disabled');
    }
    saveSettings();
  }

  // Load saved settings
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get(['logsPageSettings']);
      const settings = result.logsPageSettings || {};
      
      if (settings.autoRefresh) {
        autoRefreshCheckbox.checked = true;
        toggleAutoRefresh();
      }
      
      if (settings.logLevel) {
        logLevelFilter.value = settings.logLevel;
      }
      
      if (settings.logSource) {
        logSourceFilter.value = settings.logSource;
      }
      
      if (settings.maxLogs) {
        maxLogsSelect.value = settings.maxLogs;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Save settings
  async function saveSettings() {
    try {
      const settings = {
        autoRefresh: autoRefreshCheckbox.checked,
        logLevel: logLevelFilter.value,
        logSource: logSourceFilter.value,
        maxLogs: maxLogsSelect.value
      };
      
      await chrome.storage.local.set({ logsPageSettings: settings });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  // Show success message
  function showSuccess(message) {
    showNotification(message, 'success');
  }

  // Show error message
  function showError(message) {
    showNotification(message, 'error');
  }

  // Show notification
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      animation: slideIn 0.3s ease;
      background-color: ${type === 'error' ? '#dc3545' : '#28a745'};
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Save settings when filters change
  logLevelFilter.addEventListener('change', saveSettings);
  logSourceFilter.addEventListener('change', saveSettings);
  maxLogsSelect.addEventListener('change', saveSettings);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
  });
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);
