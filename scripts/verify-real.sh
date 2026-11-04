#!/usr/bin/env bash
# Test du HTML servi (exécution réelle)
set -u
curl -s -m 12 -o /tmp/home.html http://localhost:3000/
echo "--- taille du HTML ---"
wc -c /tmp/home.html
echo "--- premiers 300 caractères ---"
head -c 300 /tmp/home.html
echo ""
echo "--- recherche 'reservation' ---"
grep -oE 'reservation' /tmp/home.html | head -3
