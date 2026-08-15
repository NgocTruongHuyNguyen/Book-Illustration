#!/usr/bin/env bash
set -e

echo "Starting backend and frontend..."
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""

(cd backend && npm run dev) &
BACKEND_PID=$!

(cd frontend && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT

wait