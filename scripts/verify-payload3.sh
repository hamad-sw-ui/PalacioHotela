#!/usr/bin/env bash
# Le HTML servi ne contient pas le payload hero. Le bouton est servi via le payload RSC
# (chunké). Vérifier directement le payload RSC avec l'encodage u002F (slash encodé).
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- toutes les lettres 'res' dans le payload (chunk inline script inline) ---"
grep -oE 'self\.__next_f\.push\(\[1,"[^"]{0,120}' /tmp/home.html | grep -oiE 'res[a-z]{3,8}' | head -5
echo "--- il y a-t-il des chunks self.__next_f.push([1,"c:...(composant client) ? ---"
grep -cE 'self\.__next_f\.push\(\[1,"[a-z0-9]+:' /tmp/home.html
echo "--- extraits de composants client (composant chargé dynamiquement) ---"
grep -oE 'self\.__next_f\.push\(\[1,"[a-z0-9]+:.{0,150}' /tmp/home.html | head -3
