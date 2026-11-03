# Complement d'audit LOT 4 - LECTURE SEULE (partie 2)
$cmd = @'
echo "=== NB TABLES PUBLIC ==="
sudo -n -u postgres psql -d palacio -tAc "select count(*) from pg_catalog.pg_tables where schemaname = 'public'"
echo "=== SEQUENCES SCHEMA ==="
sudo -n -u postgres psql -d palacio -tAc "select table_name from information_schema.columns where table_schema='public' and column_name='id' and column_default like 'nextval%' order by table_name"
echo "=== BACKUP LIST TEST ==="
sudo -n -u postgres pg_restore --list /var/backups/palacio/palacio-pre-0017-20261031_152526.dump 2>&1 | head -15
echo "=== BUILD_ID ==="
cat /var/www/palacio/.next/BUILD_ID 2>/dev/null
echo ""
echo "=== PM2 detail ==="
pm2 info palaciohotel 2>/dev/null | grep -E "script path|exec cwd|uptime|restarts|status|node.js" | head -12
'@
Set-Location D:\PalacioHotela
ssh -o BatchMode=yes root@2.24.49.223 "bash -lc '$($cmd -replace "'", "'\''")'"
