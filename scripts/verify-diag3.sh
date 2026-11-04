#!/usr/bin/env bash
# Diagnostic 2 : le HTML servi contient-il vraiment les routes ? (payload RSC)
# Les textes RSC Next.js encodent les caractères spéciaux en \\uXXXX, mais les lettres
# ASCII restent ASCII. Si "reservation" n'apparaît nulle part, c'est que la page d'accueil
# servi ne contient pas de liens vers la réservation (probablement un payload RSC chunké).
set -u
curl -s -m 12 --compressed -o /tmp/home.html http://localhost:3000/
echo "--- occurrences de routes connues dans le payload ---"
foreach_known() { :; }
for known in hebergements compte contact devis; do
  count=$(grep -oiE "$known" /tmp/home.html | head -1 | wc -l)
  echo "$known => $count"
done
echo "--- taille ---"
wc -c /tmp/home.html
echo "--- le payload RSC est-il présent (script __NEXT_DATA__ ou self.__next_f) ? ---"
grep -c 'self.__next_f' /tmp/home2.html 2>/dev/null || grep -c 'self.__next_f' /tmp/home.html || true
