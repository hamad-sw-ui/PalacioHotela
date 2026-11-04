:
echo "=== HASH0017 ==="
sudo -n -u postgres psql -d palacio -tAc "select id, hash, created_at from drizzle.__drizzle_migrations order by id desc limit 3"
echo "=== COUNT ==="
sudo -n -u postgres psql -d palacio -tAc "select count(*) from drizzle.__drizzle_migrations"
echo "=== RESTORE_TEST 0017 ==="
sudo -n -u postgres psql -d palacio_restore_test -tAc "select id, hash from drizzle.__drizzle_migrations order by id desc limit 2"
echo "=== 0017 in prod site_settings? ==="
sudo -n -u postgres psql -d palacio -tAc "select column_name from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name='quote_header_image_url'"
echo "=== CRON ==="
cat /etc/cron.d/palacio-backup 2>/dev/null
echo "=== BACKUP file list perm ==="
sudo -n -u postgres ls -la /var/backups/palacio