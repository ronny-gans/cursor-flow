#!/bin/bash

# Cursor Flow - Start Script for macOS
# Убивает процессы на портах, запускает серверы, открывает браузер

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

# Убить процесс на порту frontend
FRONTEND_PID=$(lsof -ti:$FRONTEND_PORT 2>/dev/null)
if [ -n "$FRONTEND_PID" ]; then
    echo "   Killing frontend process (PID: $FRONTEND_PID)"
    kill -9 $FRONTEND_PID 2>/dev/null
fi

# Убить процесс на порту backend
BACKEND_PID=$(lsof -ti:$BACKEND_PORT 2>/dev/null)
if [ -n "$BACKEND_PID" ]; then
    echo "   Killing backend process (PID: $BACKEND_PID)"
    kill -9 $BACKEND_PID 2>/dev/null
fi

sleep 1
echo "✅ Ports cleared"
echo ""

# ============================================
# 2. Запускаем Backend (FastAPI)
# ============================================
echo "🐍 Starting Backend (FastAPI) on port $BACKEND_PORT..."
cd "$PROJECT_DIR/backend"

# Активируем venv если есть
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Запускаем uvicorn в фоне
uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PROCESS=$!
echo "   Backend PID: $BACKEND_PROCESS"

# ============================================
# 3. Запускаем Frontend (Vite)
# ============================================
echo "⚛️  Starting Frontend (Vite) on port $FRONTEND_PORT..."
cd "$PROJECT_DIR"

# Запускаем npm dev в фоне
npm run dev &
FRONTEND_PROCESS=$!
echo "   Frontend PID: $FRONTEND_PROCESS"

echo ""
echo "⏳ Waiting for servers to start..."
sleep 3

# ============================================
# 4. Открываем браузер
# ============================================
echo "🌐 Opening browser..."
open "http://localhost:$FRONTEND_PORT"

echo ""
echo "============================================"
echo "✅ All services started!"
echo ""
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo "   API Docs: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "============================================"

# ============================================
# 5. Ждём и обрабатываем Ctrl+C
# ============================================
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $FRONTEND_PROCESS 2>/dev/null
    kill $BACKEND_PROCESS 2>/dev/null
    
    # Дополнительно убиваем по портам на всякий случай
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null
    
    echo "👋 Bye!"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Держим скрипт активным
wait
