echo "=== catalogue rendering ==="
curl -s http://127.0.0.1:3000/hebergements > /tmp/hb2.html
wc -c /tmp/hb2.html
grep -c 'Chambre' /tmp/hb2.html || true
grep -oE 'Suite[^"<]{0,30}' /tmp/hb2.html | head -3
grep -oE '95 ?000|165 ?000|275 ?000' /tmp/hb2.html | head -3
echo "=== uploads in catalogue payload ==="
grep -oE 'uploads[^" ]{5,60}' /tmp/hb2.html | sort -u | head -6
echo "=== images in catalogue ==="
grep -oE '"/images/[^" ]{5,50}' /tmp/hb2.html | sort -u | head -6
