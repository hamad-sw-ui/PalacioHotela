#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- le payload RSC chunké encode les caractères spéciaux : chercher le texte encodé ---"
grep -oE 'r00E9servation|r00E9server|r00E9server|Réservation|Réservation' /tmp/home.html | head -5
grep -cE 'R00E9servation|R00E9server' /tmp/home.html || true
echo "--- le HTML chunké contient-il 'reservation' (toutes casse) ? ---"
grep -oiE 'reservation' /tmp/home.html | wc -l
