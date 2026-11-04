#!/usr/bin/env bash
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- le bouton hero est-il servi ? (le payload RSC chunké encode le slash en u002F) ---"
grep -oiE 'Réservation|Reservation|u002Freservation|002Freservation' /tmp/home.html | head -5
echo "--- le HTML chunké contient-il 'reservation' ? ---"
grep -oE 'reservation' /tmp/home.html | wc -l
