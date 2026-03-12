#!/usr/bin/env bash
# Create an API key for entity Peewah.
# Usage: ADMIN_SECRET=your-secret ./scripts/create-api-key-peewah.sh [credits]
# Default: 100 credits. Example: ADMIN_SECRET=xxx ./scripts/create-api-key-peewah.sh 500

set -e
CREDITS="${1:-100}"
ENTITY_ID="4acaf733-ea85-40c6-9d4b-63522bd8b207"
API_URL="${API_URL:-http://localhost:4022}"

if [ -z "$ADMIN_SECRET" ]; then
  echo "Set ADMIN_SECRET in the environment. Example:"
  echo "  export ADMIN_SECRET=your-secret"
  echo "  $0 $CREDITS"
  exit 1
fi

echo "Creating API key for Peewah with $CREDITS credits..."
curl -s -X POST "$API_URL/admin/api-keys" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"entity_id\": \"$ENTITY_ID\", \"initial_credits\": $CREDITS, \"name\": \"Peewah\"}" | jq .

echo ""
echo "⚠️  Guarda el valor de 'api_key' arriba: solo se muestra una vez."
