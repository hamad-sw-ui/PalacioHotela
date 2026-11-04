:
curl -s http://127.0.0.1:3000/ > /tmp/home2.html
wc -c /tmp/home2.html
echo "--- hrefs ---"
grep -oE 'href="/[a-z-]{2,24}"' /tmp/home2.html | sort -u | head -10
echo "--- images ---"
grep -oE 'src="/images/[^" ]{5,50}' /tmp/home2.html | sort -u | head -8
grep -oE 'src="/uploads/[^" ]{5,50}' /tmp/home2.html | sort -u | head -5
echo "--- upload img tags ---"
grep -oE '<img[^>]{5,120}' /tmp/home2.html | head -4
