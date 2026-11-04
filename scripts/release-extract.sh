set -e
cd /var/www/palacio-release
echo "--- extraction ---"
tar -xf /tmp/release-staging.tar
echo "--- verif apres extraction ---"
echo "0016 present? $(test -f drizzle/0016_site_settings_location.sql && echo OUI || echo NON)"
echo ".env present? $(test -f .env && echo OUI || echo NON)"
echo "uploads ecrase? $(ls public/uploads/media | wc -l) fichiers"
echo "node_modules present? $(test -d node_modules && echo OUI || echo NON)"
echo "--- drizzle complet ---"
ls drizzle/ | tr '\n' ' '
echo
md5sum drizzle/0017_compatibility_schema.sql
echo "--- journal ---"
grep -c '"tag"' drizzle/meta/_journal.json
rm -f /tmp/release-staging.tar
echo "--- archive temporaire supprimee ---"
