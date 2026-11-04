#!/usr/bin/env bash
# Le HTML servi vient de cache (il ne contient pas le payload). Force un refresh
# via un chemin bypass et vérifie le HTML du bouton hero.
set -u
echo "--- avec cache-control no-cache ---"
curl -s -m 12 --compressed -H 'Cache-Control: no-cache' -o /tmp/home-nocache.html http://localhost:3000/
grep -c 'hero-buttons' /tmp/home-nocache.html
grep -oE '.{20}hero-buttons.{250}' /tmp/home-nocache.html | head -1
