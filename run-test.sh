#!/bin/bash

# Network Monitor Extension - Complete Test Script
# This script will set up and test the entire extension

set -e  # Exit on any error

echo "🔍 Network Monitor Extension - Complete Test Suite"
echo "═══════════════════════════════════════════════════"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROXY_PORT=3000
API_PORT=8080
EXTENSION_DIR="$(pwd)"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    if port_in_use $1; then
        print_warning "Killing existing process on port $1"
        lsof -ti :$1 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Function to wait for server to start
wait_for_server() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $name to start on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port" >/dev/null 2>&1; then
            print_success "$name is running on port $port"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    print_error "$name failed to start within 30 seconds"
    return 1
}

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    kill_port $PROXY_PORT
    kill_port $API_PORT
    
    # Kill any remaining node processes
    pkill -f "test-server.js" 2>/dev/null || true
    pkill -f "demo-api.js" 2>/dev/null || true
    
    # Remove Chrome test profile
    rm -rf "$EXTENSION_DIR/chrome-test-profile" 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command_exists curl; then
    print_error "curl is not installed. Please install curl first."
    exit 1
fi

# Check for Chrome/Chromium
CHROME_CMD=""
if command_exists google-chrome; then
    CHROME_CMD="google-chrome"
elif command_exists google-chrome-stable; then
    CHROME_CMD="google-chrome-stable"
elif command_exists chromium; then
    CHROME_CMD="chromium"
elif command_exists chromium-browser; then
    CHROME_CMD="chromium-browser"
elif [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    CHROME_CMD="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
else
    print_error "Chrome or Chromium is not installed. Please install Chrome first."
    exit 1
fi

print_success "Found Chrome: $CHROME_CMD"

# Check required files
print_status "Checking required files..."
required_files=("manifest.json" "background.js" "test-server.js" "demo-api.js" "devtools.html" "panel.html" "popup.html")

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file missing: $file"
        exit 1
    fi
done

print_success "All required files present"

# Clean up any existing processes
print_status "Cleaning up existing processes..."
kill_port $PROXY_PORT
kill_port $API_PORT

# Start proxy server
print_status "Starting proxy server on port $PROXY_PORT..."
node test-server.js $PROXY_PORT > proxy.log 2>&1 &
PROXY_PID=$!

if ! wait_for_server $PROXY_PORT "Proxy server"; then
    print_error "Failed to start proxy server"
    cat proxy.log
    exit 1
fi

# Start demo API server
print_status "Starting demo API server on port $API_PORT..."
node demo-api.js $API_PORT > api.log 2>&1 &
API_PID=$!

if ! wait_for_server $API_PORT "Demo API server"; then
    print_error "Failed to start demo API server"
    cat api.log
    exit 1
fi

# Test server endpoints
print_status "Testing server endpoints..."

if curl -s "http://localhost:$PROXY_PORT/status" | grep -q "running"; then
    print_success "Proxy server is responding"
else
    print_error "Proxy server is not responding correctly"
    exit 1
fi

if curl -s "http://localhost:$API_PORT/api/users" | grep -q "users"; then
    print_success "Demo API server is responding"
else
    print_error "Demo API server is not responding correctly"
    exit 1
fi

# Launch Chrome with extension
print_status "Launching Chrome with extension..."

CHROME_ARGS=(
    "--load-extension=$EXTENSION_DIR"
    "--disable-extensions-except=$EXTENSION_DIR"
    "--no-first-run"
    "--no-default-browser-check"
    "--disable-web-security"
    "--user-data-dir=$EXTENSION_DIR/chrome-test-profile"
    "http://localhost:$API_PORT"
)

"$CHROME_CMD" "${CHROME_ARGS[@]}" > chrome.log 2>&1 &
CHROME_PID=$!

sleep 3

if ! ps -p $CHROME_PID > /dev/null; then
    print_error "Chrome failed to start"
    cat chrome.log
    exit 1
fi

print_success "Chrome launched with extension"

# Display instructions
echo ""
echo "🎯 MANUAL TESTING INSTRUCTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 🔧 Open DevTools (F12) in the Chrome window"
echo "2. 📋 Navigate to the 'Network Monitor' tab"
echo "3. ⚙️  Configure the extension:"
echo "   - Server Host: localhost"
echo "   - Server Port: $PROXY_PORT"
echo "   - Endpoint: /network-events"
echo "4. 📝 Add a monitoring rule:"
echo "   - Rule Name: API Calls"
echo "   - Type: Contains"
echo "   - Pattern: /api/"
echo "5. 💾 Click 'Save Configuration'"
echo "6. ▶️  Click 'Start Monitoring'"
echo "7. 🧪 Click the test buttons on the demo page"
echo ""
echo "🔗 USEFUL URLS:"
echo "   📊 Proxy Dashboard: http://localhost:$PROXY_PORT/"
echo "   🎯 Demo API: http://localhost:$API_PORT/"
echo "   📈 Events API: http://localhost:$PROXY_PORT/events"
echo ""

# Run automated API tests
print_status "Running automated API tests to generate network traffic..."

sleep 5  # Give user time to configure

test_endpoints=(
    "/api/users"
    "/api/products"
    "/api/data.json"
    "/api/users/1"
    "/api/users/999"
)

for endpoint in "${test_endpoints[@]}"; do
    print_status "Testing $endpoint..."
    curl -s "http://localhost:$API_PORT$endpoint" > /dev/null
    sleep 1
done

# Test POST request
print_status "Testing POST /api/auth/login..."
curl -s -X POST "http://localhost:$API_PORT/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"password"}' > /dev/null

sleep 2

# Check if events were received
print_status "Checking if proxy server received events..."

EVENTS_COUNT=$(curl -s "http://localhost:$PROXY_PORT/events" | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")

if [ "$EVENTS_COUNT" -gt 0 ]; then
    print_success "SUCCESS! Proxy server received $EVENTS_COUNT events"
    echo ""
    echo "🎉 The Network Monitor Extension is working correctly!"
    echo ""
    echo "📋 Event Summary:"
    curl -s "http://localhost:$PROXY_PORT/events" | head -20
else
    print_warning "No events received yet by proxy server"
    echo ""
    echo "🔍 This could mean:"
    echo "   1. Extension is not configured yet"
    echo "   2. Monitoring is not started"
    echo "   3. Rules don't match the test requests"
    echo ""
    echo "Please follow the manual configuration steps above."
fi

echo ""
echo "⏳ Press ENTER to view final results and cleanup..."
read -r

# Final verification
print_status "Final verification..."

# Check proxy server logs
if [ -f "proxy.log" ]; then
    EVENT_LINES=$(grep -c "Network Event Received" proxy.log || echo "0")
    if [ "$EVENT_LINES" -gt 0 ]; then
        print_success "Proxy server logs show $EVENT_LINES events received"
    else
        print_warning "No events found in proxy server logs"
    fi
fi

# Display final status
echo ""
echo "📊 FINAL TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check server status
if curl -s "http://localhost:$PROXY_PORT/status" > /dev/null; then
    print_success "✅ Proxy server is running"
else
    print_error "❌ Proxy server is not responding"
fi

if curl -s "http://localhost:$API_PORT/" > /dev/null; then
    print_success "✅ Demo API server is running"
else
    print_error "❌ Demo API server is not responding"
fi

if ps -p $CHROME_PID > /dev/null; then
    print_success "✅ Chrome is running with extension"
else
    print_warning "⚠️  Chrome process not found"
fi

# Final event count
FINAL_EVENTS=$(curl -s "http://localhost:$PROXY_PORT/events" | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")
if [ "$FINAL_EVENTS" -gt 0 ]; then
    print_success "✅ $FINAL_EVENTS events captured by extension"
else
    print_warning "⚠️  No events captured"
fi

echo ""
echo "🏁 Test completed! Check the URLs above for detailed results."
echo ""

# Cleanup will be handled by the trap