echo "=== RENDU H1 ==="
curl -s http://127.0.0.1:3000/ | grep -oE '<h1[^>]*>[^<]{10,90}' | head -2
echo "=== NAV FR/EN ==="
curl -s http://127.0.0.1:3000/ | grep -oE 'href="/[a-z-]*"' | sort -u | head -8
echo "=== domaine public ==="
curl -s -o /dev/null -w 'https: %{http_code}\n' https://palaciohotel.cm/ 2>/dev/null || true
echo "=== nginx ==="
systemctl is-active nginx
echo "=== API auth (POST sans creds) ==="
curl -s -o /dev/null -w 'api/auth: %{http_code}\n' -X POST http://127.0.0.1:3000/api/auth -H 'Content-Type: application/json' -d '{"action":"login"}'
echo "=== api chat ==="
curl -s -o /dev/null -w 'api/chat: %{http_code}\n' -X POST http://127.0.0.1:3000/api/chat -H 'Content-Type: application/json' -d '{}'
echo "=== api quote ==="
curl -s -o /dev/null -w 'api/quote: %{http_code}\n' -X POST http://127.0.0.1:3000/api/quotes -H 'Content-Type: application/json' -d '{}'
echo "=== api contact ==="
curl -s -o /dev/null -w 'api/contact: %{http_code}\n' -X POST http://127.0.0.1:3000/api/contact -H 'Content-Type: application/json' -d '{}'
echo "=== pm2 final ==="
pm2 status | grep palaciohotel
