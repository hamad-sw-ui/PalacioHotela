#!/usr/bin/env bash
# Vérifications finales : lien accueil + fraîcheur des erreurs PM2.
set -u
echo "--- Le HTML de la page d'accueil contient-il le lien /reservation ? ---"
curl -s -m 12 http://localhost:3000/ | grep -oE 'href="/reservation[^"]*"' | sort | uniq -c
echo "--- Contient-il encore une redirection /compte?next pour la réservation ? ---"
curl -s -m 12 http://localhost:3000/ | grep -oE '/compte\?next[^"]*' | sort | uniq -c | head -3
echo "--- Le header contient-il encore nav-book ? ---"
curl -s -m 12 http://localhost:3000/ | grep -c 'nav-book' || true
echo "--- Erreurs PM2 : horodatage des dernières lignes ---"
tail -n 200 /root/.pm2/logs/palaciohotel-error.log 2>/dev/null | tail -6
echo "--- Heure serveur actuelle ---"
date
