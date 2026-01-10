#!/bin/bash

URL=${1:-"http://localhost:80/health"}
echo "Checking health of $URL..."

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$CODE" -eq 200 ]; then
    echo "✅ System Healthy (HTTP 200)"
    exit 0
else
    echo "❌ System Unhealthy (HTTP $CODE)"
    exit 1
fi
