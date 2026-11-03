:
echo "=== uploads via _next/image ==="
grep -oE 'uploads(%2F|/)[a-zA-Z0-9._-]+' /tmp/hb2.html | sort -u | head -6
grep -oE 'uploads[^"'\'']{5,70}' /tmp/home3.html | sort -u | head -6
echo "=== une image upload servie ==="
U=$(find /var/www/palacio/public/uploads -type f | head -1)
echo "$U"
curl -s -o /dev/null -w "direct: %{http_code}\n" "http://127.0.0.1:3000${U#/var/www/palacio/public}"
echo "=== login admin (credentials depuis .env, jamais affiches) ==="
source /var/www/palacio/.env
curl -s -c /tmp/cj.txt -X POST http://127.0.0.1:3000/api/auth -H 'Content-Type: application/json' -d "{\"action\":\"login\",\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | head -c 120
echo
curl -s -b /tmp/cj.txt http://127.0.0.1:3000/api/admin/data | head -c 80
echo
rm -f /tmp/cj.txt
echo "=== pm2 erreurs depuis restart ==="
PM2UPTIME=$(pm2 jlist 2>/dev/null | grep -o '"pm_uptime":[0-9]*' | head -1)
echo "uptime marker: $PM2UPTIME"
grep -c "useSite" /root/.pm2/logs/palaciohotel-error.log || true
