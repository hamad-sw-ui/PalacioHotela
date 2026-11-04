#!/usr/bin/env bash
# Le HTML servi est compressé ? Test direct avec --compressed.
set -u
curl -s -m 12 --compressed -o /tmp/home2.html -w 'HTTP %{http_code} - %{size_download} bytes\n' http://localhost:3000/
wc -c /tmp/home2.html
echo "--- recherche 'reservation' ---"
grep -c 'reservation' /tmp/home2.html || true
grep -oE '.{20}reservation.{15}' /tmp/home2.html | head -3
