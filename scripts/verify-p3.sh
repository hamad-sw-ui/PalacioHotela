#!/usr/bin/env bash
# Le payload RSC Next.js encode les caractères spéciaux : chercher le texte encodé RSC
# "reservation" encodé \u002Freservation
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- occurrences de 'reservation' (insensible casse, encodé RSC) ---"
grep -oiE 'reservation' /tmp/home.html | head -3
echo "--- occurrence de 'u002F' ou '002F' (encodage RSC du slash) ---"
grep -oiE 'u002F|002F' /tmp/home.html | head -3
echo "--- taille ---"
wc -c /tmp/home.html
