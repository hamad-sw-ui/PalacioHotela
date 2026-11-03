:
echo "=== PG processes ==="
systemctl is-active postgresql || systemctl is-active postgresql@18-main
echo "=== nginx ==="
systemctl is-active nginx
echo "=== pm2 final ==="
pm2 status | grep palaciohotel
echo "=== erreurs runtime dernier 5 min ==="
find /root/.pm2/logs/palaciohotel-error.log -mmin -6 | wc -l
echo "=== uploads final ==="
find /var/www/palacio/public/uploads -type f | wc -l
sha256sum /var/www/palacio/public/uploads/*/* 2>/dev/null | sha256sum
echo "=== users final ==="
sudo -n -u postgres psql -d palacio -tAc "select id, email, role from users"
echo "=== BUILD_ID final ==="
cat /var/www/palacio/.next/BUILD_ID
echo "=== staging toujours present (rollback) ==="
ls /var/www/palacio-release/.next/BUILD_ID && cat /var/www/palacio-release/.next/BUILD_ID
echo "=== backups ==="
ls -la /var/backups/palacio/ | grep -E 'pre-deploy|code-pre'
echo "=== migrations count (ne doit pas changer) ==="
sudo -n -u postgres psql -d palacio -tAc "select count(*) from drizzle.__drizzle_migrations"