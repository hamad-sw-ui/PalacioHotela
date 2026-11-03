:
echo "=== RELEASE CHECK ==="
cd /var/www/palacio-release
echo "BUILD_ID: $(cat .next/BUILD_ID)"
echo "standalone: $(ls .next/standalone >/dev/null 2>&1 && echo oui || echo non)"
echo "0016: $(ls drizzle/0016_site_settings_location.sql 2>/dev/null || echo ABSENT)"
echo "0017: $(sha256sum drizzle/0017_compatibility_schema.sql | cut -d' ' -f1)"
echo "journal tags: $(grep -oE '\"tag\": \"[^\"]+\"' drizzle/meta/_journal.json | wc -l)"
echo "migrations dir: $(ls drizzle/*.sql | wc -l) fichiers"
echo "deploy APP_NAME: $(grep -oE 'APP_NAME=\"[^\"]+\"' deploy.sh)"
echo "=== JOURNAL LIST ==="
grep -oE '\"tag\": \"[^\"]+\"' drizzle/meta/_journal.json
echo "=== DB HISTORY (hash 16 chars) ==="
sudo -n -u postgres psql -d palacio -tAc "select id, substring(hash,1,16) from drizzle.__drizzle_migrations order by id"
echo "=== LOCAL 0017 hash ==="
sha256sum /var/www/palacio/drizzle/0017_compatibility_schema.sql 2>/dev/null | cut -d' ' -f1