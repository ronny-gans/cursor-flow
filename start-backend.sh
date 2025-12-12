#!/bin/bash
# Start the Cursor Flow Backend Server

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -q -r backend/requirements.txt

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "WARNING: ffmpeg not found. Please install ffmpeg for video encoding."
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
fi

# Start the server
echo ""
echo "Starting Cursor Flow Backend on http://localhost:8000"
echo "Press Ctrl+C to stop"
echo ""

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
