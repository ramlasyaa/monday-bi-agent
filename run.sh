#!/bin/bash

# Monday.com BI Agent Unified Run Script
# Starts FastAPI backend, Vite React frontend, and opens a public Pinggy tunnel.

# Exit on error
set -e

# Base directories
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$BASE_DIR/backend"
FRONTEND_DIR="$BASE_DIR/frontend"

echo "=================================================="
echo " Starting Monday.com BI Agent..."
echo "=================================================="

# 1. Setup Python Virtual Environment & Install Backend Requirements
echo "1. Verifying Python Virtual Environment..."
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$BACKEND_DIR/venv"
fi

echo "Installing backend dependencies..."
"$BACKEND_DIR/venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# 2. Install Frontend Node Packages
echo "2. Verifying Node Packages..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "node_modules not found. Installing node packages..."
    npm install --prefix "$FRONTEND_DIR"
fi

# Function to kill child processes on exit
cleanup() {
    echo ""
    echo "=================================================="
    echo " Shutting down servers..."
    echo "=================================================="
    # Kill backend uvicorn
    if [ ! -z "$BACKEND_PID" ]; then
        echo "Killing backend server (PID $BACKEND_PID)..."
        kill -9 "$BACKEND_PID" 2>/dev/null || true
    fi
    # Kill frontend vite
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Killing frontend server (PID $FRONTEND_PID)..."
        kill -9 "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

# Trap Ctrl+C (SIGINT) and exit signals to clean up
trap cleanup SIGINT SIGTERM EXIT

# 3. Start FastAPI Backend Server
echo "3. Starting FastAPI Backend..."
cd "$BACKEND_DIR"
"$BACKEND_DIR/venv/bin/uvicorn" main:app --host 127.0.0.1 --port 8000 --reload > uvicorn.log 2>&1 &
BACKEND_PID=$!
echo "Backend running on PID $BACKEND_PID (http://localhost:8000)"

# 4. Start React Frontend Server
echo "4. Starting Vite React Frontend..."
cd "$FRONTEND_DIR"
npm run dev -- --port 3000 > vite.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend running on PID $FRONTEND_PID (http://localhost:3000)"

# Give servers a few seconds to initialize
echo "Waiting for servers to spin up..."
sleep 3

# Verify backend health
if curl -s http://localhost:8000/api/status > /dev/null; then
    echo "✅ Backend health check passed!"
else
    echo "⚠️ Warning: Backend health check failed. Check backend/uvicorn.log for errors."
fi

echo ""
echo "=================================================="
echo " Local URLs:"
echo " - Frontend: http://localhost:3000"
echo " - Backend API: http://localhost:8000"
echo "=================================================="
echo ""

# 5. Initialize Pinggy Tunnel for public access
echo "5. Starting Pinggy Public HTTPS Tunnel..."
echo "This will output a public HTTPS URL (e.g. https://xxx.a.free.pinggy.link)."
echo "Share this URL for testing. Press Ctrl+C to terminate both servers and the tunnel."
echo "=================================================="
echo ""

# Run ssh tunnel with keep-alive and disable host key checks for headless execution
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ServerAliveInterval=30 -p 443 -R0:localhost:3000 free.pinggy.io
