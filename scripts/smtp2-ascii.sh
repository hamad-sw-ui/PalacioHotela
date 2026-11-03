:
source /var/www/palacio/.env 2>/dev/null
TOK=$(curl -s -X POST http://127.0.0.1:3000/api/auth -H 'Content-Type: application/json' -d "{\"action\":\"login\",\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | grep -oE '"token":"[^"]+' | cut -d'"' -f4)
echo "=== smtp-test (draft, sans envoi) ==="
curl -s -X POST http://127.0.0.1:3000/api/admin/smtp-test -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{}' | head -c 300
echo
echo "=== data GET (dashboard) ==="
curl -s http://127.0.0.1:3000/api/admin/data -H "Authorization: Bearer $TOK" | head -c 250
echo
echo "=== manage GET ==="
curl -s http://127.0.0.1:3000/api/admin/manage -H "Authorization: Bearer $TOK" | head -c 120
echo