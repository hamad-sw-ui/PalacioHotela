:
echo "=== COUNTS REELS ==="
sudo -n -u postgres psql -d palacio -tAc "select 'site_settings', count(*) from site_settings union all select 'catalog_items', count(*) from catalog_items union all select 'content_pages', count(*) from content_pages union all select 'bookings', count(*) from bookings union all select 'quote_requests', count(*) from quote_requests union all select 'users', count(*) from users union all select 'contact_messages', count(*) from contact_messages union all select 'activity_logs', count(*) from activity_logs union all select 'notifications', count(*) from notifications"
echo "=== EMRPINTES FICHIERS IMPORTANTS ==="
sha256sum /var/www/palacio/public/uploads/*/* 2>/dev/null | sha256sum
find /var/www/palacio/public/uploads -type f | wc -l
echo "=== USERS (sans secrets) ==="
sudo -n -u postgres psql -d palacio -tAc "select id, email, role from users"