#!/usr/bin/env bash
# Vérification HTML : le bouton hero servi par Next.js (le payload RSC est chunké mais
# les composants clients ont leur HTML servi directement). Chercher "hero-buttons".
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- le HTML servi contient-il 'hero-buttons' ? ---"
grep -c 'hero-buttons' /tmp/home.html
echo "--- le HTML servi contient-il 'btn-gold' ? ---"
grep -c 'btn-gold' /tmp/home.html
echo "--- extraits autour du bouton ---"
grep -oE '.{30}hero-buttons.{200}' /tmp/home.html | head -2
