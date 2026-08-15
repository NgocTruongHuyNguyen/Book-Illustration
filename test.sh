#!/usr/bin/env bash
set -e

echo "Running backend tests..."
(cd backend && npm test)

echo ""
echo "Running frontend tests..."
(cd frontend && npm test)