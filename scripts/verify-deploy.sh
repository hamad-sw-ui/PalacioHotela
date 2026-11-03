#!/usr/bin/env bash
# Vérification post-déploiement (non-régression) sur le VPS.
set -u
echo "--- health ---"
curl -s -m 8 http://localhost:3000/api/health
echo ""
echo "--- codes HTTP des routes publiques ---"
for route in / /reservation /hebergements /contact /pages/notre-histoire /compte; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 12 "http://localhost:3000${route}")
  echo "${code} ${route}"
done
echo "--- le bouton accueil pointe-t-il vers /reservation (et non /compte) ? ---"
HOME_HTML=$(curl -s -m 12 http://localhost:3000/)
echo "$HOME_HTML" | grep -o 'href="/reservation"' | head -1
echo "$HOME_HTML" | grep -c 'href="/compte?next' || true
echo "--- le header ne contient plus de bouton nav-book ? ---"
echo "$HOME_HTML" | grep -c 'nav-book' || true
echo "--- /reservation rend le formulaire d'invité (nom complet) ? ---"
curl -s -m 12 http://localhost:3000/reservation | grep -c "NOM COMPLET" || true
echo "--- logs PM2 : erreurs récentes ? ---"
pm2 logs palaciohotel --lines 30 --nostream --no-color 2>/dev/null | grep -iE "error|unhandled" | tail -5 || echo "aucune erreur récente"
