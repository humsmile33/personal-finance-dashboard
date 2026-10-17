#!/usr/bin/env bash
# Shinhan SOL Personal Finance Dashboard Launcher

PORT=8080
echo "=========================================================="
echo "  신한 SOL 개인자산관리 & 매크로 현금흐름 대시보드"
echo "  URL: http://localhost:$PORT"
echo "=========================================================="

# Check if port is in use, find another if needed
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; do
    PORT=$((PORT+1))
done

echo "Starting local server at http://localhost:$PORT ..."
# Open browser
if which open > /dev/null; then
    (sleep 1 && open "http://localhost:$PORT") &
fi

python3 -m http.server $PORT
