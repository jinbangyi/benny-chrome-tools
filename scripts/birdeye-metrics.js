// Chrome Extension Code - Copy and paste this into the extension's JavaScript code field

function index(response) {
    try {
        // Extract data from the response object
        let data;
        
        if (response.body) {
            // If response.body is already parsed
            data = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
        } else {
            throw new Error('No response body found');
        }
        
        if (!data.success || !Array.isArray(data.results)) {
            console.log(data)
            throw new Error(`Invalid data format - expected success:true and results array ${data}`);
        }
        
        // Group and sum by month
        const monthlyTotals = {};
        if (!data.results || data.results.length === 0) {
            return 'No data available to process.';
        }
        if (data.results[0].timestamp === undefined || data.results[0].PRICE_DATA === undefined) {
            return 'Invalid data structure - expected timestamp and PRICE_DATA fields';
        }
        
        data.results.forEach(item => {
            // Convert Unix timestamp to date
            const date = new Date(item.timestamp * 1000);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // Sum PRICE_DATA for each month
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
        
        // Calculate averages and format results
        const results = Object.values(monthlyTotals).map(monthData => {
            monthData.averagePriceData = monthData.totalPriceData / monthData.recordCount;
            return monthData;
        });
        
        // Sort by month
        results.sort((a, b) => a.month.localeCompare(b.month));
        
        // Create summary
        const grandTotal = results.reduce((sum, month) => sum + month.totalPriceData, 0);
        const totalRecords = results.reduce((sum, month) => sum + month.recordCount, 0);
        
        // Find highest and lowest months
        const highest = results.reduce((max, current) => 
            current.totalPriceData > max.totalPriceData ? current : max
        );
        const lowest = results.reduce((min, current) => 
            current.totalPriceData < min.totalPriceData ? current : min
        );
        
        // Helper function to format numbers
        function formatNumber(num) {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(num);
        }
        
        // Return formatted summary
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
        return `❌ Error processing data: ${error.message}
        
🔍 Debug Info:
• Response URL: ${response.url || 'N/A'}
• Response Status: ${response.status || 'N/A'}
• Response Method: ${response.method || 'N/A'}
• Body Type: ${typeof response.body}
• Body Preview: ${JSON.stringify(response.body).substring(0, 200)}...`;
    }
}
