#!/usr/bin/env bash
# Test final : fraîcheur des erreurs PM2 et HTML servi.
set -u
echo "--- HTML servi : dernier test ---"
curl -s -m 12 --compressed -o /tmp/home.html -w 'HTTP %{http_code} - %{size_download} bytes\n' http://localhost:3000/
echo "--- occurrences de 'reservation' ---"
grep -c 'reservation' /tmp/home.html | head -1
echo "--- dernières erreurs PM2 ---"
stat -c '%y %n' /root/.pm2/logs/palaciohotel-error.log 2>/dev/null
echo "--- heure actuelle ---"
date '+%Y-%m-%d %H:%M:%S'
