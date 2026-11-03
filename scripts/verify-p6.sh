#!/usr/bin/env bash
# /hebergements est une page statique servie avec le HTML complet, / est rendue
# dynamiquement (composant client avec états). Vérifions le HTML brut de / :
# le payload RSC encode les guillemets dans les chunks JS. Extraire les chunks
# complets et chercher la route avec le slash encodé (u002F en JSON string).
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- le payload RSC de / contient-il 'home-page' (classe CSS du main) ? ---"
grep -c 'home-page' /tmp/home.html
echo "--- contient-il 'hero' ? ---"
grep -oiE 'hero' /tmp/home.html | head -2
grep -c 'hero' /tmp/home.html
