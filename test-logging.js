// test-logging.js - Test script to verify the logging functionality

console.log('Test script loaded for logging verification');

// Function to test the BUILDIN_birdeye-metrics function
function testBirdeyeMetrics() {
    console.log('Testing BUILDIN_birdeye-metrics function...');
    
    const testResponse = {
        url: 'http://localhost:3000/api/metrics',
        method: 'POST',
        status: 200,
        headers: {'content-type': 'application/json'},
        body: {
            "success": true,
            "results": [
                {
                    "timestamp": 1747612800,
                    "PRICE_DATA": 5173157.063999999
                },
                {
                    "timestamp": 1747699200,
                    "PRICE_DATA": 6524387.016000001
                },
                {
                    "timestamp": 1747785600,
                    "PRICE_DATA": 2353555.92
                },
                {
                    "timestamp": 1748044800,
                    "PRICE_DATA": 1349997.7440000002
                },
                {
                    "timestamp": 1748131200,
                    "PRICE_DATA": 1750203.384
                }
            ],
            "items": ["PRICE_DATA"]
        }
    };
    
    // This would be called by the extension
    console.log('Sample response for testing:', testResponse);
    console.log('Expected function to be called: BUILDIN_birdeye-metrics');
    
    return 'Test data prepared for BUILDIN_birdeye-metrics function';
}

// Function to simulate extension behavior
function simulateExtensionLogging() {
    console.log('=== Extension Logging Test ===');
    console.info('This is an info message');
    console.warn('This is a warning message');
    console.error('This is an error message');
    console.debug('This is a debug message');
    
    console.log('Testing different data types:');
    console.log('String:', 'Hello World');
    console.log('Number:', 42);
    console.log('Boolean:', true);
    console.log('Object:', {test: 'value', number: 123});
    console.log('Array:', [1, 2, 3, 'test']);
    
    console.log('=== End Extension Logging Test ===');
}

// Export for testing
if (typeof window !== 'undefined') {
    window.testBirdeyeMetrics = testBirdeyeMetrics;
    window.simulateExtensionLogging = simulateExtensionLogging;
    
    // Auto-run tests
    console.log('Running automatic logging tests...');
    simulateExtensionLogging();
    testBirdeyeMetrics();
}
