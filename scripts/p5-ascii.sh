:
curl -s http://127.0.0.1:3000/ > /tmp/home3.html
wc -c /tmp/home3.html
grep -oE 'href="[^" ]{2,30}"' /tmp/home3.html | sort -u | head -12
echo "--- images ---"
grep -oE 'src="[^" ]{5,50}"' /tmp/home3.html | sort -u | head -10
echo "--- alt ---"
grep -oE 'alt="[^"]{3,60}"' /tmp/home3.html | sort -u | head -8
