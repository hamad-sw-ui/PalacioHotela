#!/usr/bin/env bash
# Le texte RSC est encodé : chercher directement le texte encodé RSC.
# Test du texte "Réservation" encodé (u00E9 = é)
set -u
curl -s -m 12 -o /tmp/home.html http://localhost:3000/
echo "--- occurrences de 'reservation' (sans casse, encodé RSC) ---"
grep -oiE 'reservation' /tmp/home.html | head -3
echo "--- occurrences de 'u002Freservation' ou '002Freservation' ---"
grep -oiE 'u002Freservation|002Freservation' /tmp/home.html | head -3
echo "--- occurrences de 'hero-button' ou 'btn-gold' (bouton accueil) ---"
grep -oE 'hero-buttons|btn-gold' /tmp/home.html | head -3
