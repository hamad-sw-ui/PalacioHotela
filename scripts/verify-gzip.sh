#!/usr/bin/env bash
# Diagnostic : que contient vraiment le HTML servi ?
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- est-ce du HTML ? ---"
head -c 120 /tmp/home.html
echo ""
echo "--- est-ce compressé (gzip brut) ? ---"
file /tmp/home.html
echo "--- décompresser manuellement si gzip ---"
if file /tmp/home.html | grep -qi gzip; then
  mv /tmp/home.html /tmp/home.gz
  gunzip -c /tmp/home.gz > /tmp/home2.html
  wc -c /tmp/home2.html
  echo "--- recherche 'reservation' dans le HTML décompressé ---"
  grep -oiE 'reservation' /tmp/home2.html | head -3
  grep -oiE '.{25}reservation.{15}' /tmp/home2.html | head -4
fi
