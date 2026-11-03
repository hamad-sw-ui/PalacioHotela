echo "=== payload RSC: contenus personnalises embarques ==="
grep -oE 'Yaound[^"<]{0,40}' /tmp/home3.html | sort -u | head -4
grep -oE 'chambres et suites[^"<]{0,40}' /tmp/home3.html | head -2
echo "=== uploads references dans payload ==="
grep -oE 'uploads/media/[a-z0-9-]+\.jpg' /tmp/home3.html | sort -u | head -6
echo "=== hebergements payload ==="
curl -s http://127.0.0.1:3000/hebergements > /tmp/hb.html
grep -oE 'uploads/media/[a-z0-9-]+\.(jpg|png|webp)' /tmp/hb.html | sort -u | head -8
grep -oE '"price":[0-9]+' /tmp/hb.html | sort -u | head -6
echo "=== upload files on disk vs referenced ==="
find /var/www/palacio/public/uploads -type f | wc -l
