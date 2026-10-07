#!/usr/bin/env bash
# Prepares a local Supabase stack for the API checks: applies the migrations, creates two confirmed
# writers and writes the values the API and the Bruno collection read to $GITHUB_ENV (or prints them).
# Needs `supabase start` to have run, and psql and curl.
set -euo pipefail

cd "$(dirname "$0")/.."
eval "$(supabase status -o env | sed 's/^/export /')"

for file in $(ls db/migrations/*.sql | sort); do
  echo "applying $file"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done

# Throwaway accounts in a database that only lives for this run.
FIRST_PASSWORD="ci-$(openssl rand -hex 12)"
SECOND_PASSWORD="ci-$(openssl rand -hex 12)"
echo "::add-mask::$FIRST_PASSWORD"
echo "::add-mask::$SECOND_PASSWORD"
for who in first second; do
  password="${who^^}_PASSWORD"
  curl --fail-with-body -sS -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$who@ci.test\",\"password\":\"${!password}\",\"email_confirm\":true}" > /dev/null
done

out="${GITHUB_ENV:-/dev/stdout}"
{
  echo "SUPABASE_URL=$API_URL"
  echo "SUPABASE_ANON_KEY=$ANON_KEY"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
  echo "DATABASE_URL=${DB_URL}?sslmode=disable"
  echo "TEST_EMAIL=first@ci.test"
  echo "TEST_PASSWORD=$FIRST_PASSWORD"
  echo "SECOND_EMAIL=second@ci.test"
  echo "SECOND_PASSWORD=$SECOND_PASSWORD"
} >> "$out"
