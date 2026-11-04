#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- occurrence de 'u002F' dans le HTML servi (nombre total) ---"
grep -oE 'u002F' /tmp/home.html | wc -l
echo "--- occurrence de '002F' dans le HTML servi (nombre total) ---"
grep -oE '002F' /tmp/home.html | wc -l
echo "--- occurrence de 'u002F' extraites ---"
grep -oE 'u002F[a-z]{3,12}' /tmp/home.html | sort | uniq -c | head -8
