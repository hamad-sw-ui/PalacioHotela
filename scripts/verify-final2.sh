#!/usr/bin/env bash
# Vérification du HTML accueil servi + fraîcheur des erreurs PM2.
set -u
echo "--- HTML accueil servi (extrait) ---"
curl -s -m 12 -o /tmp/home.html -w 'HTTP %{http_code} - %{size_download} bytes\n' http://localhost:3000/
grep -oE 'href="/reservation[^"]*"' /tmp/home.html | head -2
echo "--- grep nav-book ---"
grep -c 'nav-book' /tmp/home.html || true
echo "--- dernières lignes error log (avec timestamps PM2 si présents) ---"
ls -l /root/.pm2/logs/ | head -8
stat -c '%y %n' /root/.pm2/logs/palaciohotel-error.log 2>/dev/null
echo "--- Heure actuelle ---"
date '+%Y-%m-%d %H:%M:%S'
