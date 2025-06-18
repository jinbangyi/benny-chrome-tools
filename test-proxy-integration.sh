#!/bin/bash
# Comprehensive test script for proxy integration

echo "🧪 Running comprehensive proxy integration tests..."
echo "=================================================="

# Test 1: Check if proxy server is running
echo "📡 Test 1: Checking proxy server status..."
PROXY_STATUS=$(curl -s -w "%{http_code}" http://localhost:8081/status -o /tmp/proxy_status.json)
if [ "$PROXY_STATUS" = "200" ]; then
    echo "✅ Proxy server is running on port 8081"
    echo "   Status: $(cat /tmp/proxy_status.json)"
else
    echo "❌ Proxy server not responding (HTTP $PROXY_STATUS)"
    echo "   Make sure to run: node proxy-server.js"
    exit 1
fi

# Test 2: Check proxy configuration
echo ""
echo "🔧 Test 2: Checking proxy configuration..."
curl -s http://localhost:8081/config | python3 -m json.tool 2>/dev/null || echo "Config response: $(curl -s http://localhost:8081/config)"

# Test 3: Test proxy request forwarding
echo ""
echo "🔄 Test 3: Testing proxy request forwarding..."
PROXY_TEST=$(curl -s -w "%{http_code}" -X POST http://localhost:8081/proxy \
    -H "Content-Type: application/json" \
    -H "X-Target-URL: http://localhost:3000/api/metrics" \
    -d '{"test": "data"}' \
    -o /tmp/proxy_test.json)

if [ "$PROXY_TEST" = "200" ]; then
    echo "✅ Proxy request forwarding works"
    echo "   Response: $(cat /tmp/proxy_test.json)"
else
    echo "❌ Proxy request forwarding failed (HTTP $PROXY_TEST)"
    echo "   Make sure test server is running: node test-server.js"
fi

# Test 4: Check if test server is running
echo ""
echo "🧪 Test 4: Checking test server status..."
TEST_STATUS=$(curl -s -w "%{http_code}" http://localhost:3000/api/metrics -o /tmp/test_response.json)
if [ "$TEST_STATUS" = "200" ]; then
    echo "✅ Test server is running on port 3000"
    echo "   Response: $(cat /tmp/test_response.json)"
else
    echo "❌ Test server not responding (HTTP $TEST_STATUS)"
    echo "   Make sure to run: node test-server.js"
fi

# Test 5: Configure proxy for testing
echo ""
echo "🎯 Test 5: Configuring proxy for extension testing..."
CONFIG_RESULT=$(curl -s -w "%{http_code}" -X POST http://localhost:8081/config \
    -H "Content-Type: application/json" \
    -d '{"isWatching": true, "endpoint": "http://localhost:3000/api/metrics", "method": "GET", "jsCode": "BUILDIN_simple-log"}' \
    -o /tmp/config_result.json)

if [ "$CONFIG_RESULT" = "200" ]; then
    echo "✅ Proxy configured for extension testing"
    echo "   Config result: $(cat /tmp/config_result.json)"
else
    echo "❌ Failed to configure proxy (HTTP $CONFIG_RESULT)"
fi

# Test 6: Test complete flow
echo ""
echo "🔗 Test 6: Testing complete request flow..."
FLOW_TEST=$(curl -s -w "%{http_code}" -X GET http://localhost:8081/proxy \
    -H "X-Target-URL: http://localhost:3000/api/metrics" \
    -o /tmp/flow_test.json)

if [ "$FLOW_TEST" = "200" ]; then
    echo "✅ Complete request flow works"
    echo "   Response: $(cat /tmp/flow_test.json)"
else
    echo "❌ Complete request flow failed (HTTP $FLOW_TEST)"
fi

# Check results
echo ""
echo "📊 Checking proxy results..."
curl -s http://localhost:8081/results | python3 -m json.tool 2>/dev/null || echo "Results: $(curl -s http://localhost:8081/results)"

echo ""
echo "🎉 Test Summary:"
echo "================"
echo "✅ If all tests passed, the proxy integration is working correctly"
echo "📋 Next steps for Chrome extension:"
echo "   1. Load the extension in Chrome (chrome://extensions/)"
echo "   2. Open the extension popup"
echo "   3. The proxy status should show '✅ Proxy Server Running'"
echo "   4. Configure endpoint: http://localhost:3000/api/metrics"
echo "   5. Set JavaScript: BUILDIN_simple-log"
echo "   6. Click 'Start Watching'"
echo "   7. Visit http://localhost:3000 and click 'Test Metrics API'"
echo ""
echo "🔍 If the extension still shows proxy not running, check:"
echo "   - Browser console for errors"
echo "   - Extension console for service worker logs"
echo "   - CORS or network policy restrictions"

# Cleanup
rm -f /tmp/proxy_status.json /tmp/proxy_test.json /tmp/test_response.json /tmp/config_result.json /tmp/flow_test.json
