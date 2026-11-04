:
cd /var/www/palacio
node -p "require('drizzle-orm/package.json').version" 2>&1
node -p "require('drizzle-kit/package.json').version" 2>&1
ls /etc/cron.d/
cat /etc/cron.d/palacio-backup 2>/dev/null | head -3
echo "=== build marker ==="
ls -la /var/www/palacio/.next/BUILD_ID
echo "=== PM2 config ==="
pm2 describe palaciohotel 2>/dev/null | grep -E 'script|cwd|interpreter|node'