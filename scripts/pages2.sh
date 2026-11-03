grep -oE 'href="/[a-z-]{2,24}"' /tmp/home.html | sort -u | head -10
echo "=== autres pages ==="
for p in /contact /devis /hebergements /disponibilites /compte /reservation; do curl -s "http://127.0.0.1:3000$p" > /tmp/p.html; T=$(grep -oE '<title>[^<]*' /tmp/p.html | head -1); C=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$p"); echo "$p [$C] $T"; done
echo "=== EN locale ==="
curl -s -o /dev/null -w 'home?locale=en: %{http_code}\n' 'http://127.0.0.1:3000/?locale=en'
echo "=== images dans home ==="
grep -oE 'src="/images/[^"]+' /tmp/home.html | sort -u | head -6
grep -oE 'src="/uploads/[^"]+' /tmp/home.html | sort -u | head -4
