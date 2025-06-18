// safe-functions.js - Predefined safe functions for the extension

// Registry of safe functions that can be executed
const SAFE_FUNCTIONS = {
  'BUILDIN_birdeye-metrics': function(response) {
    try {
      let data;
      
      if (response.body) {
        data = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      } else {
        throw new Error('No response body found');
      }
      
      if (!data.success || !Array.isArray(data.results)) {
        throw new Error(`Invalid data format - expected success:true and results array ${JSON.stringify(data)}`);
      }
      
      // Group and sum by month
      const monthlyTotals = {};
      
      data.results.forEach(item => {
        const date = new Date(item.timestamp * 1000);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyTotals[monthKey]) {
          monthlyTotals[monthKey] = {
            month: monthKey,
            totalPriceData: 0,
            recordCount: 0,
            averagePriceData: 0
          };
        }
        
        monthlyTotals[monthKey].totalPriceData += item.PRICE_DATA;
        monthlyTotals[monthKey].recordCount += 1;
      });
      
      const results = Object.values(monthlyTotals).map(monthData => {
        monthData.averagePriceData = monthData.totalPriceData / monthData.recordCount;
        return monthData;
      });
      
      results.sort((a, b) => a.month.localeCompare(b.month));
      
      const grandTotal = results.reduce((sum, month) => sum + month.totalPriceData, 0);
      const totalRecords = results.reduce((sum, month) => sum + month.recordCount, 0);
      
      const highest = results.reduce((max, current) => 
        current.totalPriceData > max.totalPriceData ? current : max
      );
      const lowest = results.reduce((min, current) => 
        current.totalPriceData < min.totalPriceData ? current : min
      );
      
      function formatNumber(num) {
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(num);
      }
      
      return `📊 Monthly PRICE_DATA Summary:
        
📈 Overview:
• Total Months: ${results.length}
• Total Records: ${totalRecords}
• Grand Total: $${formatNumber(grandTotal)}
• Overall Average: $${formatNumber(grandTotal / totalRecords)}

🏆 Extremes:
• Highest Month: ${highest.month} ($${formatNumber(highest.totalPriceData)})
• Lowest Month: ${lowest.month} ($${formatNumber(lowest.totalPriceData)})

📋 Monthly Breakdown:
${results.map(month => 
    `${month.month}: Total=$${formatNumber(month.totalPriceData)}, Records=${month.recordCount}, Avg=$${formatNumber(month.averagePriceData)}`
).join('\n')}

🔍 Analysis:
• Average per month: $${formatNumber(grandTotal / results.length)}
• Records per month: ${Math.round(totalRecords / results.length)}`;
      
    } catch (error) {
      return `❌ Error processing data: ${error.message}`;
    }
  },
  
  'BUILDIN_simple-log': function(response) {
    return `Request Details:
URL: ${response.url}
Method: ${response.method}
Status: ${response.status}
Body: ${JSON.stringify(response.body, null, 2).substring(0, 500)}...`;
  },
  
  'BUILDIN_count-records': function(response) {
    try {
      let data = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      if (data.results && Array.isArray(data.results)) {
        return `Found ${data.results.length} records in the response`;
      }
      return 'No results array found in response';
    } catch (error) {
      return `Error counting records: ${error.message}`;
    }
  }
};

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SAFE_FUNCTIONS;
}
