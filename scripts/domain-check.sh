SERVER=$(grep -rE 'server_name' /etc/nginx/sites-enabled/ 2>/dev/null | head -1)
echo "server_name: $SERVER"
echo "=== test https localhost ==="
curl -sk -o /dev/null -w 'https-localhost: %{http_code}\n' https://127.0.0.1/
echo "=== test https palaciohotel ==="
curl -sk -o /dev/null -w 'https-palaciohotel: %{http_code}\n' --resolve palaciohotel.cm:443:127.0.0.1 https://palaciohotel.cm/ 2>/dev/null
echo "=== H1 home ==="
curl -s http://127.0.0.1:3000/ > /tmp/home.html
grep -oE '<h1[^>]*>' /tmp/home.html | head -2
grep -oE 'Palacio[^<"]{0,40}' /tmp/home.html | head -3
echo "=== nav hrefs ==="
grep -oE 'href="/[a-z-]{2,20}"' /tmp/home.html | sort -u | head -10
