#!/usr/bin/env bash
# Le HTML servi contient-il le payload RSC Next.js (les textes sont encodés) ?
# Test direct du texte encodé RSC : "reservation" apparaît encodé "\\u002Freservation"
set -u
curl -s -m 12 -o /tmp/home.html http://localhost:3000/
echo "--- recherche 'reservation' encodé RSC (u002F) ---"
grep -oE 'reservation' /tmp/home.html | head -2
grep -cE 'u002Freservation|002Freservation' /tmp/home.html || true
echo "--- recherche du bouton 'Book my stay' / 'Réserver mon séjour' ---"
grep -oE 'Réserver mon séjour|Book my stay' /tmp/home.html | head -2
echo "--- recherche de la classe 'hero-buttons' ---"
grep -oE 'hero-buttons' /tmp/home.html | head -1
