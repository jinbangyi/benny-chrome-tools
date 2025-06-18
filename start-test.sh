#!/bin/bash
# Test script for the Chrome extension with proxy integration

echo "🚀 Starting HTTP Request Watcher with Proxy Integration Test"
echo "============================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Start the proxy server
echo "📡 Starting proxy server..."
node proxy-server.js &
PROXY_PID=$!

# Wait a moment for proxy to start
sleep 2

# Start the test server
echo "🔧 Starting test server..."
node test-server.js &
TEST_PID=$!

# Wait a moment for test server to start
sleep 2

echo ""
echo "✅ Both servers are running!"
echo ""
echo "📋 Next steps:"
echo "1. Load the Chrome extension in developer mode"
echo "2. Open the extension popup"
echo "3. Configure endpoint: http://localhost:3000/api/metrics"
echo "4. Set JavaScript code: BUILDIN_birdeye-metrics"
echo "5. Click 'Start Watching'"
echo "6. Open test page: http://localhost:3000/test.html"
echo "7. Click 'Test Metrics API' button"
echo ""
echo "🔍 Monitor the extension popup for results"
echo "📊 Check logs at: chrome-extension://[id]/logs.html"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
trap "echo '🛑 Stopping servers...'; kill $PROXY_PID $TEST_PID 2>/dev/null; exit 0" INT
wait
