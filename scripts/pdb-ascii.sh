:
echo "=== DUMP PRE-DEPLOY ==="
TS=$(date +%Y%m%d_%H%M%S)
OUT=/var/backups/palacio/palacio-pre-deploy-${TS}.dump
sudo -n -u postgres pg_dump -Fc -d palacio -f "$OUT" 2>&1
echo "dump file: $OUT"
ls -la "$OUT"
echo "=== INTEGRITY ==="
sudo -n -u postgres pg_restore --list "$OUT" 2>&1 | head -3
sudo -n -u postgres pg_restore --list "$OUT" 2>/dev/null | grep -c 'TABLE DATA'
echo "=== .env backup (no content shown) ==="
cp -a /var/www/palacio/.env /var/backups/palacio/.env-pre-deploy-${TS}
ls -la /var/backups/palacio/.env-pre-deploy-${TS}
sha256sum /var/www/palacio/.env /var/backups/palacio/.env-pre-deploy-${TS}
echo "=== TABLE COUNTS ==="
sudo -n -u postgres psql -d palacio -tAc "select relname, n_live_tup from pg_stat_user_tables where schemaname='public' order by relname"
echo "=== UPLOADS INVENTORY ==="
find /var/www/palacio/public/uploads -type f | wc -l
du -sh /var/www/palacio/public/uploads
echo "=== UPLOADS ARCHIVE ==="
TS2=$(date +%Y%m%d_%H%M%S)
tar -cf /var/backups/palacio/uploads-pre-deploy-${TS2}.tar -C /var/www/palacio/public uploads
ls -la /var/backups/palacio/uploads-pre-deploy-${TS2}.tar
tar -tf /var/backups/palacio/uploads-pre-deploy-${TS2}.tar | wc -l
