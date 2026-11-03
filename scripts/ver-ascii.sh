:
cd /var/www/palacio
for p in next drizzle-orm drizzle-kit react; do v=$(node -p "require('$p/package.json').version" 2>/dev/null || echo ERR); echo "$p=$v"; done
echo "=== npm ci? ==="
npm ls next drizzle-orm 2>/dev/null | head -4
echo "=== cron backup ==="
ls /etc/cron.d/ | grep -i palacio