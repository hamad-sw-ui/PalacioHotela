#!/usr/bin/env bash
# Vérification HTTP des routes du site (déployé) — exécuter depuis le VPS.
set -u
echo "--- health ---"
curl -s -m 8 http://localhost:3000/api/health
echo ""
echo "--- codes HTTP des routes publiques ---"
for route in / /reservation /hebergements /contact /compte /devis; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 12 "http://localhost:3000${route}")
  echo "${code} ${route}"
done
echo "--- le bouton accueil pointe vers /reservation ? ---"
HOME_HTML=$(curl -s -m 12 http://localhost:3000/)
echo "$HOME_HTML" | grep -o 'href="/reservation"' | head -1
echo "--- logs PM2 récents : erreurs ? ---"
pm2 logs palaciohotel --lines 40 --nostream --no-color 2>/dev/null | grep -icE "error|unhandled" || true
