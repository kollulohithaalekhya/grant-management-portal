#!/bin/sh
# Applies pending database migrations before the API starts. `migrate deploy`
# is idempotent, so restarting the container is safe.
set -e

echo "==> Applying database migrations"
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database"
  node prisma/seed.js
fi

echo "==> Starting API"
exec "$@"
