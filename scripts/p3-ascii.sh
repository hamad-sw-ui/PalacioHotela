:
echo "=== hrefs ==="
grep -oE 'href="/[a-z-]{2,24}"' /tmp/home.html | sort -u | head -10
echo "=== images ==="
grep -oE 'src="/images/[^"]{5,60}' /tmp/home.html | sort -u | head -8
grep -oE 'src="/uploads/[^"]{5,60}' /tmp/home.html | sort -u | head -5
echo "=== galerie ==="
grep -oE 'alt="[^"]{3,50}' /tmp/home.html | sort -u | head -8
