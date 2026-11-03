#!/usr/bin/env bash
# Vérification HTTP brute des routes du site déployé — exécuter depuis le VPS.
set -u
echo "--- health ---"
curl -s -m 8 http://localhost:3000/api/health
echo ""
echo "--- codes HTTP des routes publiques ---"
for route in / /reservation /hebergements /contact /compte /devis; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 12 "http://localhost:3000${route}")
  echo "${code} ${route}"
done
echo "--- /reservation : le formulaire d'invité (NOM COMPLET) est rendu ? ---"
curl -s -m 12 http://localhost:3000/reservation | grep -c "NOM COMPLET"
