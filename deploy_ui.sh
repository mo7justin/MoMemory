#!/bin/bash
set -euo pipefail

cd /opt/OpenMemory-MCP/ui

# Build UI container assets
pnpm install
pnpm build

cd /opt/OpenMemory-MCP

# Rebuild UI image and restart containers
docker compose up -d --no-deps --build openmemory-ui

# Clear nginx cache (if present) and restart service
sudo rm -rf /var/cache/nginx/*
sudo systemctl restart nginx

echo "UI deployment complete. nginx cache cleared and UI container rebuilt."

