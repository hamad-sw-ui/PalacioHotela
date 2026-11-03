echo "=== SMTP test (via API admin settings save) ==="
source /var/www/palacio/.env 2>/dev/null
TOK=$(curl -s -X POST http://127.0.0.1:3000/api/auth -H 'Content-Type: application/json' -d "{\"action\":\"login\",\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | grep -oE '"token":"[^"]+' | cut -d'"' -f4)
echo "token obtenu: ${TOK:0:20}..."
echo "=== test smtp via api ==="
curl -s -X POST http://127.0.0.1:3000/api/admin/settings/test -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{}' | head -c 200
echo
echo "=== actions admin disponibles ==="
curl -s -X POST http://127.0.0.1:3000/api/admin/data -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"action":"list","entity":"catalog_items"}' | head -c 150
echo
echo "=== notifications count via api ==="
curl -s -X POST http://127.0.0.1:3000/api/admin/data -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"action":"list","entity":"notifications"}' | head -c 100
echo
