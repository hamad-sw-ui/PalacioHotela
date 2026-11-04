:
echo "=== TITLE + HERO (contenus personnalises) ==="
curl -s http://127.0.0.1:3000/ | grep -oE '<title>[^<]*</title>' | head -1
curl -s http://127.0.0.1:3000/ | grep -oE 'h1[^>]*>[^<]{5,80}' | head -2
echo "=== IMAGES Uploads servies ==="
UP=$(find /var/www/palacio/public/uploads -type f -name '*.jpg' -o -type f -name '*.png' -o -type f -name '*.webp' | head -1)
echo "fichier test: $UP"
RELUP=${UP#/var/www/palacio/public}
curl -s -o /dev/null -w "upload http: %{http_code}\n" "http://127.0.0.1:3000$RELUP"
echo "=== API health ==="
curl -s http://127.0.0.1:3000/api/health 2>/dev/null | head -c 200; echo
curl -s -o /dev/null -w 'api/health: %{http_code}\n' http://127.0.0.1:3000/api/health
echo "=== DB preservation ==="
sudo -n -u postgres psql -d palacio -tAc "select 'site_settings', count(*) from site_settings union all select 'catalog_items', count(*) from catalog_items union all select 'content_pages', count(*) from content_pages union all select 'users', count(*) from users union all select 'contact_messages', count(*) from contact_messages union all select 'notifications', count(*) from notifications union all select 'activity_logs', count(*) from activity_logs union all select 'bookings', count(*) from bookings union all select 'quote_requests', count(*) from quote_requests"
echo "=== SETTINGS (id + hotel_name only) ==="
sudo -n -u postgres psql -d palacio -tAc "select id, hotel_name from site_settings"
echo "=== uploads count + sha ==="
find /var/www/palacio/public/uploads -type f | wc -l
sha256sum /var/www/palacio/public/uploads/*/* 2>/dev/null | sha256sum
echo "=== PM2 logs erreurs ==="
pm2 logs palaciohotel --lines 20 --nostream 2>/dev/null | grep -iE 'error|fatal' | head -5
echo "(vide = aucune erreur)"