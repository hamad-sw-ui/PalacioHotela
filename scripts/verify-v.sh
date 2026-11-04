#!/usr/bin/env bash
# Vérification définitive du HTML servi.
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- nombre de liens vers /reservation (toutes formes d'encodage) ---"
grep -oiE 'reservation' /tmp/home.html | wc -l
echo "--- toutes occurrences d'occurrences chunkées du payload RSC (1:hex...) ---"
grep -oE '1:\"[a-zA-Z0-9]{6,9}\",' /tmp/home.html | head -3
echo "--- le HTML contient-il le payload RSC de la page d'accueil ? ---"
grep -oE 'palacio|PALACIO' /tmp/home.html | wc -l
