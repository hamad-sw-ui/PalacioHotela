#!/usr/bin/env bash
# Vérification définitive via le navigateur headless Playwright côté VPS :
# tester le rendu final et cliquer sur le bouton hero pour vérifier l'URL de destination.
# Test simple d'abord : récupérer le HTML finalisé par JS avec un HTTP client léger.
set -u
echo "--- comparaison avec la page hebergements (doit contenir 'hebergements') ---"
curl -s -m 12 --compressed -o /tmp/hb.html http://localhost:3000/hebergements
grep -oiE 'hebergements' /tmp/hb.html | head -2
grep -c 'hebergements' /tmp/hb.html
