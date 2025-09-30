#!/bin/bash

# CC Task Manager - Environment Setup Script
# This script installs all prerequisites for development

set -e

echo "🔧 CC Task Manager - Environment Setup"
echo "======================================"
echo ""

# Check if script is run with sudo
if [ "$EUID" -eq 0 ]; then
  echo "⚠️  Please run without sudo. The script will prompt for sudo when needed."
  exit 1
fi

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Installing global Node.js tools...${NC}"
echo ""

# Install pnpm globally
if command -v pnpm &> /dev/null; then
  echo -e "${GREEN}✓${NC} pnpm already installed ($(pnpm --version))"
else
  echo "Installing pnpm..."
  sudo npm install -g pnpm
  echo -e "${GREEN}✓${NC} pnpm installed"
fi

# Install PM2 globally
if command -v pm2 &> /dev/null; then
  echo -e "${GREEN}✓${NC} PM2 already installed ($(pm2 --version))"
else
  echo "Installing PM2..."
  sudo npm install -g pm2
  echo -e "${GREEN}✓${NC} PM2 installed"
fi

echo ""
echo -e "${BLUE}🐳 Checking Docker...${NC}"
echo ""

# Check Docker
if command -v docker &> /dev/null; then
  echo -e "${GREEN}✓${NC} Docker installed ($(docker --version))"
else
  echo -e "${YELLOW}⚠${NC}  Docker not found"
  echo "   Please install Docker from: https://docs.docker.com/get-docker/"
  exit 1
fi

# Check Docker Compose
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
  echo -e "${GREEN}✓${NC} Docker Compose installed ($(docker compose version))"
else
  echo -e "${YELLOW}⚠${NC}  Docker Compose not found"
  echo "   Please install Docker Compose from: https://docs.docker.com/compose/install/"
  exit 1
fi

echo ""
echo -e "${BLUE}📦 Installing project dependencies...${NC}"
echo ""

# Install project dependencies
cd "$(dirname "$0")"
pnpm install

echo ""
echo -e "${GREEN}✅ Environment setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Configure your .env files if needed"
echo "  2. Start development: npm run docker:up && pm2 start ecosystem.app.config.js"
echo "  3. Or use the all-in-one command: npm run dev"
echo ""