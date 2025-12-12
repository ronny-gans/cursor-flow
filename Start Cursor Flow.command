#!/bin/bash

# Cursor Flow - Start Script for macOS
# Двойной клик для запуска!

FRONTEND_PORT=3000
BACKEND_PORT=8000
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Cursor Flow - Starting..."
echo "📁 Project: $PROJECT_DIR"
echo ""

# ============================================
# 1. Убиваем процессы на нужных портах
# ============================================
echo "🔪 Killing processes on ports $FRONTEND_PORT and $BACKEND_PORT..."

lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null

sleep 1
echo "✅ Ports cleared"
echo ""

# ============================================
# 2. Запускаем Backend (FastAPI)
# ============================================
echo "🐍 Starting Backend (FastAPI) on port $BACKEND_PORT..."
cd "$PROJECT_DIR"

# Активируем venv если есть
if [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
elif [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Запускаем как модуль чтобы работали относительные импорты
python -m uvicorn backend.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PROCESS=$!

# ============================================
# 3. Запускаем Frontend (Vite)
# ============================================
echo "🖥️  Starting Electron app..."
cd "$PROJECT_DIR"

# Ensure Node dependencies exist (concurrently is required by npm run dev)
if [ ! -x "$PROJECT_DIR/node_modules/.bin/concurrently" ]; then
    echo ""
    echo "❌ Node dependencies are not installed."
    echo "Run this once in the project folder:"
    echo "  npm install"
    echo ""
    echo "Then re-run this script."
    exit 1
fi

# NOTE: This starts Electron and (in dev) the Vite renderer dev server internally.
npm run dev &
ELECTRON_PROCESS=$!

echo ""
echo "============================================"
echo "✅ All services started!"
echo ""
echo "   Electron: running"
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "Закрой это окно чтобы остановить серверы"
echo "============================================"

# Ждём и убиваем при закрытии окна
cleanup() {
    echo ""
    echo "🛑 Stopping..."
    kill $ELECTRON_PROCESS $BACKEND_PROCESS 2>/dev/null
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null
    exit 0
}

trap cleanup EXIT SIGINT SIGTERM
wait
