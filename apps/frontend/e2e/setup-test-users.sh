#!/bin/bash
#
# Setup Test Users Script
#
# This script creates test users in the database for E2E testing
# Run this once before running E2E tests
#
# Usage:
#   ./e2e/setup-test-users.sh

set -e

API_URL="${API_URL:-http://localhost:3005}"

echo "🔧 Setting up test users for E2E testing..."
echo "API URL: $API_URL"
echo ""

# Function to create user via API
create_user() {
  local email=$1
  local password=$2
  local username=$3
  local role=$4

  echo "Creating user: $email (role: $role)"

  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"$password\",
      \"username\": \"$username\",
      \"firstName\": \"Test\",
      \"lastName\": \"User\",
      \"role\": \"$role\"
    }")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -eq 201 ] || [ "$http_code" -eq 200 ]; then
    echo "✅ User $email created successfully"
  elif [ "$http_code" -eq 409 ] || echo "$body" | grep -q "already exists"; then
    echo "⚠️  User $email already exists (skipping)"
  else
    echo "❌ Failed to create user $email (HTTP $http_code)"
    echo "Response: $body"
  fi

  echo ""
}

# Create test users
# Password requirements: min 8 chars, lowercase, uppercase, number, special char
create_user "admin@test.com" "Admin123!" "testadmin" "admin"
create_user "user@test.com" "User123!" "testuser" "user"
create_user "viewer@test.com" "Viewer123!" "testviewer" "viewer"

echo "✅ Test user setup complete!"
echo ""
echo "Test users created:"
echo "  - admin@test.com / Admin123! (admin)"
echo "  - user@test.com / User123! (user)"
echo "  - viewer@test.com / Viewer123! (viewer)"
echo ""
echo "You can now run E2E tests with: pnpm test:e2e"
