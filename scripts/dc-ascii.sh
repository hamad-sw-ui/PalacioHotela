:
echo "=== DOMAINE PUBLIC ==="
grep -rE 'server_name' /etc/nginx/sites-enabled/ 2>/dev/null | head -3
ls /etc/nginx/sites-enabled/ 2>/dev/null
echo "=== test https local ==="
curl -sk -o /dev/null -w 'https-localhost: %{http_code}\n' https://127.0.0.1/ 2>/dev/null
curl -s -o /dev/null -w 'http-localhost: %{http_code}\n' http://127.0.0.1/ 2>/dev/null
echo "=== H1 sur la page ==="
curl -s http://127.0.0.1:3000/ > /tmp/home.html
grep -oE '<h1[^>]*>.{0,60}' /tmp/home.html | head -2
grep -c 'Palacio' /tmp/home.html
echo "=== liens nav ==="
grep -oE 'href="[^"]{2,30}"' /tmp/home.html | sort -u | head -12
