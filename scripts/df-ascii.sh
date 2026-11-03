:
set -e
REL=/var/www/palacio-release
PROD=/var/www/palacio

echo "=== 1. COPIE CODE (rsync, exclut .env et uploads) ==="
rsync -a --delete --exclude='.env' --exclude='public/uploads' --exclude='.next/cache' --exclude='tsconfig.tsbuildinfo' --exclude='.codaignore' --exclude='scripts' --exclude='.deploy-lock-hash' "$REL/" "$PROD/"

echo "=== 2. VERIF BUILD_ID ==="
cat "$PROD/.next/BUILD_ID"

echo "=== 3. VERIF .env PRESERVE ==="
sha256sum "$PROD/.env"

echo "=== 4. VERIF UPLOADS PRESERVE ==="
find "$PROD/public/uploads" -type f | wc -l

echo "=== 5. node_modules sync ==="
rsync -a "$REL/node_modules/" "$PROD/node_modules/"

echo "=== 6. VERIF FINALE ==="
cat "$PROD/.next/BUILD_ID"
md5sum "$PROD/deploy.sh" "$PROD/src/db/schema.ts"
ls "$PROD/drizzle/0016_site_settings_location.sql" 2>/dev/null || echo "0016 ABSENT (OK)"
